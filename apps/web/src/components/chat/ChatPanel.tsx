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
import {
  designerSystemPrompt,
  DESIGNER_TOOLS,
} from '@/lib/chat/designer-agent';
import { dispatchDesignerTool } from '@/lib/chat/designer-dispatch';
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
  const buildMessages = useWorkspaceStore((s) => s.buildMessages);
  const isStreaming = useWorkspaceStore((s) => s.isStreaming);
  const contract = useWorkspaceStore((s) => s.intentContract);
  const appendIntent = useWorkspaceStore((s) => s.appendIntentMessage);
  const appendBuild = useWorkspaceStore((s) => s.appendBuildMessage);
  const setStreaming = useWorkspaceStore((s) => s.setStreaming);
  const setContract = useWorkspaceStore((s) => s.setIntentContract);
  const setPhase = useWorkspaceStore((s) => s.setIntentPhase);

  const messages = intentPhase === 'building' ? buildMessages : intentMessages;

  const handleError = (
    appendFn: (msg: ChatMessageT) => void,
    label: string,
    message: string,
  ): void => {
    appendFn({
      id: nanoid(),
      role: 'critic',
      content: `${label}: ${message}`,
      createdAt: new Date().toISOString(),
    });
  };

  const sendIntent = async (text: string): Promise<void> => {
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
          handleError(appendIntent, 'LLM error', d.message ?? 'unknown');
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
      handleError(
        appendIntent,
        'Network error',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setStreaming(false);
    }
  };

  const sendBuild = async (text: string): Promise<void> => {
    if (!contract) return;
    const userMsg: ChatMessageT = {
      id: nanoid(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    appendBuild(userMsg);
    setStreaming(true);

    let assistantText = '';
    try {
      const history = toAnthropicMessages([...buildMessages, userMsg]);
      for await (const ev of streamLlm({
        system: designerSystemPrompt(contract),
        messages: history,
        tools: DESIGNER_TOOLS,
      })) {
        if (ev.type === 'content_block_delta') {
          const d = ev.data as { delta?: { text?: string } };
          if (d.delta?.text) assistantText += d.delta.text;
        } else if (ev.type === 'final') {
          const final = ev.data as FinalEvent;
          for (const block of final.content) {
            if (block.type === 'tool_use') {
              const result = dispatchDesignerTool(
                String(block.name ?? ''),
                (block.input ?? {}) as Record<string, unknown>,
              );
              appendBuild({
                id: nanoid(),
                role: 'tool',
                content: result.note,
                createdAt: new Date().toISOString(),
              });
            }
          }
        } else if (ev.type === 'error') {
          const d = ev.data as { message?: string };
          handleError(appendBuild, 'LLM error', d.message ?? 'unknown');
        }
      }
      if (assistantText) {
        appendBuild({
          id: nanoid(),
          role: 'assistant',
          content: assistantText,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      handleError(
        appendBuild,
        'Network error',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setStreaming(false);
    }
  };

  // Auto-trigger first homepage generation when entering building phase
  const triggered = React.useRef(false);
  React.useEffect(() => {
    if (
      intentPhase === 'building' &&
      buildMessages.length === 0 &&
      !triggered.current
    ) {
      triggered.current = true;
      void sendBuild('Generate the homepage now.');
    }
    if (intentPhase !== 'building') {
      triggered.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentPhase, buildMessages.length]);

  const send = intentPhase === 'building' ? sendBuild : sendIntent;
  const composerDisabled =
    isStreaming || intentPhase === 'contracted';

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {intentPhase === 'collecting' && intentMessages.length === 0 && (
          <div className="text-sm text-[color:var(--color-muted)]">
            Quick — who is this for?
          </div>
        )}
        {messages.map((m) =>
          m.role === 'critic' ? (
            <CriticBubble key={m.id} reason={m.content} />
          ) : m.role === 'tool' ? (
            <div
              key={m.id}
              className="text-xs text-[color:var(--color-muted)] italic"
            >
              › {m.content}
            </div>
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
        onSend={send}
        disabled={composerDisabled}
        placeholder={
          intentPhase === 'building'
            ? 'Refine or add a new page...'
            : intentPhase === 'contracted'
              ? 'Approve the contract to continue...'
              : 'Answer...'
        }
      />
    </div>
  );
}
