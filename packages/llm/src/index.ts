/**
 * @you-design/llm — Cost-aware multi-LLM router (M2'de implement edilecek)
 *
 * Plan:
 * - judgment / honest critic → Claude Opus 4.7
 * - main generation → Claude Sonnet 4.6
 * - fast edits / autocomplete → Claude Haiku 4.5
 * - vision (canvas analyze) → Gemini 2.0 Flash
 * - embeddings → OpenAI text-embedding-3-large (pgvector)
 *
 * M0'da sadece stub interface.
 */

export type LlmTask =
  | 'judgment'
  | 'generation'
  | 'fast-edit'
  | 'vision'
  | 'embedding';

export interface LlmRoute {
  task: LlmTask;
  provider: 'anthropic' | 'openai' | 'gemini';
  model: string;
  reason: string;
}

export function routeFor(task: LlmTask): LlmRoute {
  switch (task) {
    case 'judgment':
      return {
        task,
        provider: 'anthropic',
        model: 'claude-opus-4-7',
        reason: 'deepest reasoning for critic',
      };
    case 'generation':
      return {
        task,
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        reason: 'best coding model',
      };
    case 'fast-edit':
      return {
        task,
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
        reason: '3x cheaper, 90% capability',
      };
    case 'vision':
      return {
        task,
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        reason: 'cheapest vision model',
      };
    case 'embedding':
      return {
        task,
        provider: 'openai',
        model: 'text-embedding-3-large',
        reason: 'pgvector friendly dimensions',
      };
  }
}
