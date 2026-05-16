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
import { useDesignerSend } from '@/lib/chat/useDesignerSend';
import { selectModelForTask, estimateCost } from '@you-design/shared';
import type { ChatMessage as ChatMessageT } from '@you-design/shared';

function toApiMessages(messages: ChatMessageT[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

interface TextDeltaPart {
  text?: string;
  textDelta?: string;
}

interface ToolCallPart {
  toolName: string;
  toolCallId: string;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
}

interface ErrorPart {
  error?: unknown;
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
  const models = useWorkspaceStore((s) => s.models);
  const defaultModelId = useWorkspaceStore((s) => s.defaultModelId);
  const appendSessionCost = useWorkspaceStore((s) => s.appendSessionCost);
  const activeModel = selectModelForTask('intent', models, defaultModelId);
  const appendIntent = useWorkspaceStore((s) => s.appendIntentMessage);
  const setStreaming = useWorkspaceStore((s) => s.setStreaming);
  const setContract = useWorkspaceStore((s) => s.setIntentContract);
  const setPhase = useWorkspaceStore((s) => s.setIntentPhase);
  const latestReport = useWorkspaceStore((s) => {
    const reports = s.criticReports[s.currentPath];
    return reports?.[0] ?? null;
  });

  const sendBuild = useDesignerSend();
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

  const sendIntent = async (text: string): Promise<void> => {
    if (!activeModel) {
      noteCritic(appendIntent, 'Setup', 'No model configured. Add one in /setup.');
      return;
    }
    const userMsg: ChatMessageT = {
      id: nanoid(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    appendIntent(userMsg);
    setStreaming(true);

    const onUsage = (usage: { promptTokens: number; completionTokens: number }) => {
      const cost = estimateCost(activeModel?.modelName ?? '', usage.promptTokens, usage.completionTokens);
      if (cost !== null) appendSessionCost(cost);
      void fetch('http://localhost:3001/api/v1/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: useWorkspaceStore.getState().projectId ?? undefined,
          agent: 'intent',
          modelName: activeModel?.modelName ?? '',
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
        }),
      }).catch(() => {});
    };

    let assistantText = '';
    try {
      for await (const ev of streamLlm({
        model: activeModel,
        system: INTENT_SYSTEM_PROMPT,
        messages: toApiMessages([...intentMessages, userMsg]),
        tools: INTENT_TOOLS,
      }, undefined, onUsage)) {
        if (ev.type === 'text-delta') {
          const t = deltaText(ev.data as TextDeltaPart);
          if (t) assistantText += t;
        } else if (ev.type === 'tool-call') {
          const part = ev.data as ToolCallPart;
          const input = toolInput(part);
          if (part.toolName === 'challenge') {
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
          } else if (part.toolName === 'summarize_contract') {
            setContract(input);
            setPhase('contracted');
          }
        } else if (ev.type === 'error') {
          const part = ev.data as ErrorPart;
          const msg =
            part.error instanceof Error
              ? part.error.message
              : typeof part.error === 'string'
                ? part.error
                : JSON.stringify(part.error);
          noteCritic(appendIntent, 'LLM error', msg);
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
      noteCritic(
        appendIntent,
        'Network error',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setStreaming(false);
    }
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

  const inlineCriticIssues = React.useMemo(() => {
    if (intentPhase !== 'building' || !latestReport) return [];
    return latestReport.issues.filter((i) => i.status === 'open').slice(0, 3);
  }, [intentPhase, latestReport]);

  const hiddenInlineCount = React.useMemo(() => {
    if (!latestReport) return 0;
    const open = latestReport.issues.filter((i) => i.status === 'open').length;
    return Math.max(0, open - 3);
  }, [latestReport]);

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
        {inlineCriticIssues.length > 0 && latestReport && (
          <div className="flex flex-col gap-1 mt-1">
            <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
              Critic on {latestReport.pagePath} ({latestReport.triggeredBy})
            </div>
            {inlineCriticIssues.map((i) => (
              <CriticBubble
                key={i.id}
                issue={{ severity: i.severity, category: i.category, message: i.message }}
              />
            ))}
            {hiddenInlineCount > 0 && (
              <div className="text-xs italic text-[color:var(--color-muted)]">
                + {hiddenInlineCount} more — open the critic drawer
              </div>
            )}
          </div>
        )}
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
