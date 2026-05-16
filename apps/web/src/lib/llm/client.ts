import type { ModelConfig } from '@you-design/shared';

export interface LlmRequest {
  model: ModelConfig;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
  max_tokens?: number;
}

export interface LlmEvent {
  type: string;
  data: unknown;
}

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
}

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:3001';

export async function* streamLlm(
  req: LlmRequest,
  signal?: AbortSignal,
  onUsage?: (usage: UsageInfo) => void,
): AsyncGenerator<LlmEvent> {
  const res = await fetch(`${API_BASE}/api/v1/llm/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    let parsed: { message?: string; error?: string } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON
    }
    const msg = parsed?.message || parsed?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const lines = raw.split('\n');
      let eventType = '';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) dataStr += line.slice(6);
      }
      if (eventType && dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          if (eventType === 'finish' && onUsage && parsed?.usage) {
            const u = parsed.usage as { promptTokens?: number; completionTokens?: number };
            onUsage({
              promptTokens: u.promptTokens ?? 0,
              completionTokens: u.completionTokens ?? 0,
            });
          }
          yield { type: eventType, data: parsed };
        } catch {
          // ignore malformed event
        }
      }
    }
  }
}
