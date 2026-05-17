import { nanoid } from 'nanoid';
import type { AgentType, CriticIssue, CriticReport } from '@you-design/shared';
import { selectModelForTask, estimateCost } from '@you-design/shared';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { streamLlm, type LlmRequest } from '@/lib/llm/client';
import { normalizeIssue } from './critic-dispatch';

interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export async function runAgent(
  agentType: AgentType,
  systemPrompt: string,
  tools: AgentTool[],
  pagePath: string,
  pageHtml: string,
): Promise<void> {
  const state = useWorkspaceStore.getState();
  if (!state.intentContract) return;

  const activeModel = selectModelForTask('critic', state.models, state.defaultModelId);
  if (!activeModel) return;

  state.setAgentRunning(agentType, true);

  const contract = state.intentContract;
  const persona = typeof contract.persona === 'string' ? contract.persona : contract.persona.role;

  const fullSystem =
    `${systemPrompt}\n\nIntent contract:\n` +
    `- Persona: ${persona}\n` +
    `- Primary action: ${contract.primaryAction}\n` +
    `- Emotion: ${contract.emotion}\n` +
    `- Domain: ${contract.domain}`;

  let issues: CriticIssue[] = [];

  try {
    const req: LlmRequest = {
      model: activeModel,
      system: fullSystem,
      messages: [
        {
          role: 'user',
          content: `Page path: ${pagePath}\n\nCurrent HTML:\n\n${pageHtml}`,
        },
      ],
      tools,
      max_tokens: 2048,
    };

    for await (const ev of streamLlm(req, undefined, (usage) => {
      const cost = estimateCost(activeModel.modelName, usage.promptTokens, usage.completionTokens);
      const store = useWorkspaceStore.getState();
      if (cost !== null) store.appendSessionCost(cost);
      void fetch('http://localhost:3001/api/v1/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: store.projectId ?? undefined,
          agent: agentType,
          modelName: activeModel.modelName,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
        }),
      }).catch(() => {});
    })) {
      if (ev.type === 'tool-call') {
        const part = ev.data as {
          input?: { issues?: unknown[] };
          args?: { issues?: unknown[] };
        };
        const raw = part.input?.issues ?? part.args?.issues ?? [];
        if (Array.isArray(raw)) {
          issues = raw.map(normalizeIssue);
        }
      }
    }
  } catch (err) {
    console.warn(`[${agentType}] run failed:`, err);
    useWorkspaceStore.getState().setAgentRunning(agentType, false);
    return;
  }

  if (issues.length > 0) {
    const report: CriticReport = {
      id: nanoid(),
      pagePath,
      triggeredBy: 'manual',
      agentType,
      issues,
      createdAt: new Date().toISOString(),
    };
    useWorkspaceStore.getState().addCriticReport(report);
  }

  useWorkspaceStore.getState().setAgentRunning(agentType, false);
}
