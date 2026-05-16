import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config.js';

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!cached) {
    cached = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return cached;
}
