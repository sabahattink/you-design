import { describe, it, expect } from 'vitest';
import { selectModelForTask } from './router.js';
import type { ModelConfig } from './providers.js';

const fast: ModelConfig = {
  id: 'f1', label: 'Haiku', provider: 'anthropic',
  modelName: 'claude-haiku-4-5', tier: 'fast',
};
const standard: ModelConfig = {
  id: 's1', label: 'Sonnet', provider: 'anthropic',
  modelName: 'claude-sonnet-4-5', tier: 'standard',
};
const best: ModelConfig = {
  id: 'b1', label: 'Opus', provider: 'anthropic',
  modelName: 'claude-opus-4-7', tier: 'best',
};

describe('selectModelForTask', () => {
  it('picks fast tier for intent task', () => {
    const result = selectModelForTask('intent', [fast, standard], standard.id);
    expect(result?.id).toBe('f1');
  });

  it('picks standard tier for designer task', () => {
    const result = selectModelForTask('designer', [fast, standard], fast.id);
    expect(result?.id).toBe('s1');
  });

  it('falls back to default when no matching tier', () => {
    const result = selectModelForTask('intent', [standard, best], standard.id);
    expect(result?.id).toBe('s1');
  });

  it('returns null when models list is empty', () => {
    const result = selectModelForTask('designer', [], null);
    expect(result).toBeNull();
  });

  it('falls back to first model when no default id and no tier match', () => {
    const result = selectModelForTask('intent', [standard], null);
    expect(result?.id).toBe('s1');
  });
});
