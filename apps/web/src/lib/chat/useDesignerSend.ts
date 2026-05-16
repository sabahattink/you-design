'use client';

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useWorkspaceStore, selectActiveModel } from '@/lib/workspace/store';
import { streamLlm } from '@/lib/llm/client';
import { designerSystemPrompt, DESIGNER_TOOLS } from './designer-agent';
import { dispatchDesignerTool } from './designer-dispatch';
import { searchMemories } from '@/lib/projects/api';
import type { ChatMessage } from '@you-design/shared';

function toApiMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

interface ToolCallPart {
  type: 'tool-call';
  toolName: string;
  toolCallId: string;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
}

function toolInput(part: ToolCallPart): Record<string, unknown> {
  return part.input ?? part.args ?? {};
}

export function useDesignerSend(): (text: string) => Promise<void> {
  const buildMessages = useWorkspaceStore((s) => s.buildMessages);
  const contract = useWorkspaceStore((s) => s.intentContract);
  const activeModel = useWorkspaceStore((s) => selectActiveModel(s));
  const appendBuild = useWorkspaceStore((s) => s.appendBuildMessage);
  const setStreaming = useWorkspaceStore((s) => s.setStreaming);
  const projectId = useWorkspaceStore((s) => s.projectId);

  return useCallback(
    async (text: string): Promise<void> => {
      if (!contract || !activeModel) return;
      const userMsg: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      appendBuild(userMsg);
      setStreaming(true);

      let assistantText = '';
      try {
        let memories: string[] = [];
        if (projectId) {
          const openAiKey =
            activeModel?.provider === 'openai' ? (activeModel as { apiKey?: string }).apiKey : undefined;
          memories = await searchMemories(projectId, text, openAiKey).catch(() => []);
        }

        for await (const ev of streamLlm({
          model: activeModel,
          system: designerSystemPrompt(contract, memories),
          messages: toApiMessages([...buildMessages, userMsg]),
          tools: DESIGNER_TOOLS,
        })) {
          if (ev.type === 'text-delta') {
            const d = ev.data as { text?: string; textDelta?: string };
            assistantText += d.text ?? d.textDelta ?? '';
          } else if (ev.type === 'tool-call') {
            const part = ev.data as ToolCallPart;
            const result = dispatchDesignerTool(part.toolName, toolInput(part));
            appendBuild({
              id: nanoid(),
              role: 'tool',
              content: result.note,
              createdAt: new Date().toISOString(),
            });
          } else if (ev.type === 'error') {
            const part = ev.data as { error?: unknown };
            const msg =
              part.error instanceof Error
                ? part.error.message
                : typeof part.error === 'string'
                  ? part.error
                  : JSON.stringify(part.error);
            appendBuild({
              id: nanoid(),
              role: 'critic',
              content: `LLM error: ${msg}`,
              createdAt: new Date().toISOString(),
            });
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
        appendBuild({
          id: nanoid(),
          role: 'critic',
          content: `Network error: ${err instanceof Error ? err.message : String(err)}`,
          createdAt: new Date().toISOString(),
        });
      } finally {
        setStreaming(false);
      }
    },
    [contract, activeModel, buildMessages, appendBuild, setStreaming, projectId],
  );
}
