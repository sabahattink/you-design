'use client';

import * as React from 'react';
import { nanoid } from 'nanoid';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { ChatMessage } from './ChatMessage';
import { CriticBubble } from './CriticBubble';
import { Composer } from './Composer';
import { IntentContractCard } from './IntentContractCard';
import { streamLlm } from '@/lib/llm/client';
import { INTENT_SYSTEM_PROMPT, INTENT_TOOLS } from '@/lib/chat/intent-agent';
import type { ChatMessage as ChatMessageT } from '@you-design/shared';

function toAnthropicMessages(messages: ChatMessageT[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface FinalEvent {
  content: ContentBlock[];
}

export function ChatPanel() {
  const intentPhase = useWorkspaceStore((s) => s.intentPhase);
  const intentMessages = useWorkspaceStore((s) => s.intentMessages);
  const isStreaming = useWorkspaceStore((s) => s.isStreaming);
  const appendIntent = useWorkspaceStore((s) => s.appendIntentMessage);
  const setStreaming = useWorkspaceStore((s) => s.setStreaming);
  const setContract = useWorkspaceStore((s) => s.setIntentContract);
  const setPhase = useWorkspaceStore((s) => s.setIntentPhase);

  const sendIntent = async (text: string) => {
    const userMsg: ChatMessageT = {
      id: nanoid(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    appendIntent(userMsg);
    setStreaming(true);

    let assistantText = '';
    try {
      const history = toAnthropicMessages([...intentMessages, userMsg]);
      for await (const ev of streamLlm({
        system: INTENT_SYSTEM_PROMPT,
        messages: history,
        tools: INTENT_TOOLS,
      })) {
        if (ev.type === 'content_block_delta') {
          const d = ev.data as { delta?: { text?: string } };
          if (d.delta?.text) assistantText += d.delta.text;
        } else if (ev.type === 'final') {
          const final = ev.data as FinalEvent;
          for (const block of final.content) {
            if (block.type === 'tool_use') {
              if (block.name === 'challenge') {
                const reason = String(block.input?.reason ?? '');
                appendIntent({
                  id: nanoid(),
                  role: 'critic',
                  content: reason,
                  createdAt: new Date().toISOString(),
                });
                const sharper = block.input?.sharperQuestion;
                if (typeof sharper === 'string' && sharper) {
                  assistantText = sharper;
                }
              } else if (block.name === 'summarize_contract') {
                setContract(block.input ?? {});
                setPhase('contracted');
              }
            }
          }
        } else if (ev.type === 'error') {
          const d = ev.data as { message?: string };
          appendIntent({
            id: nanoid(),
            role: 'critic',
            content: `LLM error: ${d.message ?? 'unknown'}`,
            createdAt: new Date().toISOString(),
          });
        }
      }
      if (assistantText) {
        appendIntent({
          id: nanoid(),
          role: 'assistant',
          content: assistantText,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendIntent({
        id: nanoid(),
        role: 'critic',
        content: `Network error: ${message}`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {intentMessages.length === 0 && (
          <div className="text-sm text-[color:var(--color-muted)]">
            Quick — who is this for?
          </div>
        )}
        {intentMessages.map((m) =>
          m.role === 'critic' ? (
            <CriticBubble key={m.id} reason={m.content} />
          ) : (
            <ChatMessage key={m.id} msg={m} />
          ),
        )}
        {intentPhase === 'contracted' && <IntentContractCard />}
        {isStreaming && (
          <div className="text-xs text-[color:var(--color-muted)] italic">
            thinking...
          </div>
        )}
      </div>
      <Composer
        onSend={sendIntent}
        disabled={isStreaming || intentPhase !== 'collecting'}
      />
    </div>
  );
}
