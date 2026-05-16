import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAnthropic } from '../lib/anthropic.js';

const ContentBlock = z.object({
  type: z.enum(['text', 'tool_use', 'tool_result']),
  text: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.unknown().optional(),
  tool_use_id: z.string().optional(),
  content: z.unknown().optional(),
  is_error: z.boolean().optional(),
});

const MessageBody = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(ContentBlock)]),
});

const ToolDef = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.record(z.unknown()),
});

const Body = z.object({
  system: z.string(),
  messages: z.array(MessageBody),
  tools: z.array(ToolDef).optional(),
  model: z.string().default('claude-sonnet-4-5'),
  max_tokens: z.number().int().positive().default(4096),
});

export async function llmRoutes(app: FastifyInstance) {
  app.post('/llm/stream', { schema: { body: Body } }, async (req, reply) => {
    const anthropic = getAnthropic();
    if (!anthropic) {
      reply.code(503);
      return {
        error: 'LLM_NOT_CONFIGURED',
        message:
          'ANTHROPIC_API_KEY is not set on the API server. Add it to .env and restart.',
      };
    }

    const body = req.body as z.infer<typeof Body>;

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
      const stream = anthropic.messages.stream({
        model: body.model,
        max_tokens: body.max_tokens,
        system: body.system,
        messages: body.messages as never,
        tools: body.tools as never,
      });

      for await (const event of stream) {
        send(event.type, event);
      }

      const final = await stream.finalMessage();
      send('final', final);
      reply.raw.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'LLM stream error');
      send('error', { message });
      reply.raw.end();
    }
  });
}
