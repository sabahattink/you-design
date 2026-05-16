'use client';

import * as React from 'react';
import { nanoid } from 'nanoid';
import { useWorkspaceStore, selectActiveModel } from '@/lib/workspace/store';
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

function toApiMessages(messages: ChatMessageT[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

interface TextDeltaPart {
  type: 'text-delta';
  text?: string;
  textDelta?: string;
}

interface ToolCallPart {
  type: 'tool-call';
  toolName: string;
  toolCallId: string;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
}

interface ErrorPart {
  type: 'error';
  error?: unknown;
}

interface FinishPart {
  type: 'finish';
  finishReason?: string;
  usage?: unknown;
}

function deltaText(part: TextDeltaPart): string {
  return part.text ?? part.textDelta ?? '';
}

function toolInput(part: ToolCallPart): Record<string, unknown> {
  return part.input ?? part.args ?? {};
}

export function ChatPanel() {
  const intentPhase = useWorkspaceStore((s) => s.intentPhase);
  const intentMessages = useWorkspaceStore((s) => s.intentMessages);
  const buildMessages = useWorkspaceStore((s) => s.buildMessages);
  const isStreaming = useWorkspaceStore((s) => s.isStreaming);
  const contract = useWorkspaceStore((s) => s.intentContract);
  const activeModel = useWorkspaceStore((s) => selectActiveModel(s));
  const appendIntent = useWorkspaceStore((s) => s.appendIntentMessage);
  const appendBuild = useWorkspaceStore((s) => s.appendBuildMessage);
  const setStreaming = useWorkspaceStore((s) => s.setStreaming);
  const setContract = useWorkspaceStore((s) => s.setIntentContract);
  const setPhase = useWorkspaceStore((s) => s.setIntentPhase);

  const messages = intentPhase === 'building' ? buildMessages : intentMessages;

  const noteCritic = (
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

  const runStream = async (
    system: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    tools: typeof INTENT_TOOLS | typeof DESIGNER_TOOLS,
    onText: (s: string) => void,
    onToolCall: (name: string, input: Record<string, unknown>) => void,
    onError: (msg: string) => void,
  ): Promise<void> => {
    if (!activeModel) {
      onError('No model configured. Add one in /setup.');
      return;
    }
    try {
      for await (const ev of streamLlm({
        model: activeModel,
        system,
        messages: history,
        tools,
      })) {
        if (ev.type === 'text-delta') {
          const t = deltaText(ev.data as TextDeltaPart);
          if (t) onText(t);
        } else if (ev.type === 'tool-call') {
          const part = ev.data as ToolCallPart;
          onToolCall(part.toolName, toolInput(part));
        } else if (ev.type === 'error') {
          const part = ev.data as ErrorPart;
          const msg =
            part.error instanceof Error
              ? part.error.message
              : typeof part.error === 'string'
                ? part.error
                : JSON.stringify(part.error);
          onError(msg);
        } else if (ev.type === 'finish') {
          // no-op: finish summary; could surface usage info later
          void (ev.data as FinishPart);
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
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
    const history = toApiMessages([...intentMessages, userMsg]);
    await runStream(
      INTENT_SYSTEM_PROMPT,
      history,
      INTENT_TOOLS,
      (t) => {
        assistantText += t;
      },
      (toolName, input) => {
        if (toolName === 'challenge') {
          const reason = String(input.reason ?? '');
          appendIntent({
            id: nanoid(),
            role: 'critic',
            content: reason,
            createdAt: new Date().toISOString(),
          });
          const sharper = input.sharperQuestion;
          if (typeof sharper === 'string' && sharper) {
            assistantText = sharper;
          }
        } else if (toolName === 'summarize_contract') {
          setContract(input);
          setPhase('contracted');
        }
      },
      (msg) => noteCritic(appendIntent, 'LLM error', msg),
    );

    if (assistantText) {
      appendIntent({
        id: nanoid(),
        role: 'assistant',
        content: assistantText,
        createdAt: new Date().toISOString(),
      });
    }
    setStreaming(false);
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
    const history = toApiMessages([...buildMessages, userMsg]);
    await runStream(
      designerSystemPrompt(contract),
      history,
      DESIGNER_TOOLS,
      (t) => {
        assistantText += t;
      },
      (toolName, input) => {
        const result = dispatchDesignerTool(toolName, input);
        appendBuild({
          id: nanoid(),
          role: 'tool',
          content: result.note,
          createdAt: new Date().toISOString(),
        });
      },
      (msg) => noteCritic(appendBuild, 'LLM error', msg),
    );

    if (assistantText) {
      appendBuild({
        id: nanoid(),
        role: 'assistant',
        content: assistantText,
        createdAt: new Date().toISOString(),
      });
    }
    setStreaming(false);
  };

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
  const composerDisabled = isStreaming || intentPhase === 'contracted';

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
            thinking{activeModel ? ` (${activeModel.label})` : ''}...
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
