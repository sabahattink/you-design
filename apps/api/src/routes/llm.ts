import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { streamText, jsonSchema, type ToolSet } from 'ai';
import { ModelConfig } from '@you-design/shared';
import { buildModel, ProviderConfigError } from '../lib/providers.js';

const MessageBody = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const ToolDef = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.record(z.unknown()),
});

const Body = z.object({
  model: ModelConfig,
  system: z.string(),
  messages: z.array(MessageBody),
  tools: z.array(ToolDef).optional(),
  max_tokens: z.number().int().positive().default(4096),
});

function toToolSet(rawTools: Array<z.infer<typeof ToolDef>>): ToolSet {
  const set: ToolSet = {};
  for (const t of rawTools) {
    set[t.name] = {
      description: t.description,
      // Wrap raw JSON Schema (kept in agent prompts as Anthropic-style input_schema)
      // so the AI SDK can validate args without us rewriting every schema as zod.
      inputSchema: jsonSchema(t.input_schema as never),
    };
  }
  return set;
}

export async function llmRoutes(app: FastifyInstance) {
  app.post('/llm/stream', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'INVALID_BODY', message: parsed.error.message };
    }
    const body = parsed.data;

    let model;
    try {
      model = buildModel(body.model);
    } catch (err) {
      if (err instanceof ProviderConfigError) {
        reply.code(503);
        return { error: err.code, message: err.message };
      }
      throw err;
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = streamText({
        model,
        system: body.system,
        messages: body.messages,
        tools: body.tools ? toToolSet(body.tools) : undefined,
        maxOutputTokens: body.max_tokens,
      });

      for await (const part of result.fullStream) {
        send(part.type, part);
      }

      try {
        const finishReason = await result.finishReason;
        const usage = await result.usage;
        send('finish', { finishReason, usage });
      } catch {
        send('finish', { finishReason: 'unknown' });
      }
      reply.raw.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'LLM stream error');
      send('error', { message });
      reply.raw.end();
    }
  });
}
