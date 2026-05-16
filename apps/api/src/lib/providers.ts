import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { ModelConfig, ProviderType } from '@you-design/shared';
import { env } from '../config.js';

function envKey(provider: ProviderType): string | undefined {
  switch (provider) {
    case 'anthropic':
      return env.ANTHROPIC_API_KEY;
    case 'openai':
      return env.OPENAI_API_KEY;
    case 'google':
      return env.GEMINI_API_KEY;
    case 'openai-compatible':
      return undefined;
  }
}

export class ProviderConfigError extends Error {
  constructor(
    message: string,
    public readonly code: 'API_KEY_MISSING' | 'BASE_URL_MISSING',
  ) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}

export function buildModel(config: ModelConfig): LanguageModel {
  const apiKey = config.apiKey?.trim() || envKey(config.provider);

  switch (config.provider) {
    case 'anthropic': {
      if (!apiKey) {
        throw new ProviderConfigError(
          'Anthropic API key missing. Add it in /setup or set ANTHROPIC_API_KEY env on the server.',
          'API_KEY_MISSING',
        );
      }
      return createAnthropic({ apiKey })(config.modelName);
    }
    case 'openai': {
      if (!apiKey) {
        throw new ProviderConfigError(
          'OpenAI API key missing. Add it in /setup or set OPENAI_API_KEY env on the server.',
          'API_KEY_MISSING',
        );
      }
      return createOpenAI({ apiKey })(config.modelName);
    }
    case 'google': {
      if (!apiKey) {
        throw new ProviderConfigError(
          'Google API key missing. Add it in /setup or set GEMINI_API_KEY env on the server.',
          'API_KEY_MISSING',
        );
      }
      return createGoogleGenerativeAI({ apiKey })(config.modelName);
    }
    case 'openai-compatible': {
      if (!config.baseURL) {
        throw new ProviderConfigError(
          'OpenAI-compatible provider requires baseURL (e.g. http://localhost:11434/v1 for Ollama).',
          'BASE_URL_MISSING',
        );
      }
      return createOpenAI({
        apiKey: apiKey || 'dummy-not-used',
        baseURL: config.baseURL,
      })(config.modelName);
    }
  }
}
