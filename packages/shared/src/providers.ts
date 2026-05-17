import { z } from 'zod';

export const ProviderType = z.enum(['anthropic', 'openai', 'google', 'openai-compatible']);
export type ProviderType = z.infer<typeof ProviderType>;

export const ModelConfig = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  provider: ProviderType,
  modelName: z.string().min(1),
  apiKey: z.string().optional(),
  baseURL: z.string().url().optional(),
  tier: z.enum(['fast', 'standard', 'best']).default('standard'),
});
export type ModelConfig = z.infer<typeof ModelConfig>;

export interface ProviderInfo {
  type: ProviderType;
  label: string;
  needsBaseURL: boolean;
  exampleModels: readonly string[];
}

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    type: 'anthropic',
    label: 'Anthropic Claude',
    needsBaseURL: false,
    exampleModels: [
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
      'claude-opus-4-5',
      'claude-3-5-sonnet-latest',
    ],
  },
  {
    type: 'openai',
    label: 'OpenAI',
    needsBaseURL: false,
    exampleModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
  },
  {
    type: 'google',
    label: 'Google Gemini',
    needsBaseURL: false,
    exampleModels: ['gemini-2.0-flash-exp', 'gemini-1.5-pro-latest', 'gemini-1.5-flash-latest'],
  },
  {
    type: 'openai-compatible',
    label: 'OpenAI-compatible (Ollama / Groq / OpenRouter / LM Studio / vLLM / ...)',
    needsBaseURL: true,
    exampleModels: ['llama3.1', 'mixtral-8x7b', 'qwen2.5-coder'],
  },
];

export function getProviderInfo(type: ProviderType): ProviderInfo {
  const found = PROVIDERS.find((p) => p.type === type);
  if (!found) throw new Error(`Unknown provider: ${type}`);
  return found;
}

export function newModelId(): string {
  return `m_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
