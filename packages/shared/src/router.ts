import type { ModelConfig } from './providers.js';

export type TaskType = 'intent' | 'critic' | 'designer' | 'memory';

const TASK_TIER: Record<TaskType, 'fast' | 'standard' | 'best'> = {
  intent:   'fast',
  critic:   'fast',
  memory:   'fast',
  designer: 'standard',
};

export function selectModelForTask(
  task: TaskType,
  models: ModelConfig[],
  defaultModelId: string | null,
): ModelConfig | null {
  if (models.length === 0) return null;
  const tier = TASK_TIER[task];
  const match = models.find((m) => (m.tier ?? 'standard') === tier);
  if (match) return match;
  if (defaultModelId) {
    const def = models.find((m) => m.id === defaultModelId);
    if (def) return def;
  }
  return models[0] ?? null;
}
