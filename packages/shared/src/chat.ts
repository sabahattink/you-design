import { z } from 'zod';

export const Role = z.enum(['user', 'assistant', 'critic', 'tool', 'system']);
export type Role = z.infer<typeof Role>;

export const ToolCall = z.object({
  id: z.string(),
  name: z.string(),
  args: z.record(z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCall>;

export const ToolResult = z.object({
  toolCallId: z.string(),
  result: z.unknown(),
  isError: z.boolean().default(false),
});
export type ToolResult = z.infer<typeof ToolResult>;

export const ChatMessage = z.object({
  id: z.string(),
  role: Role,
  content: z.string(),
  toolCalls: z.array(ToolCall).optional(),
  toolResults: z.array(ToolResult).optional(),
  createdAt: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ElementPatch = z.object({
  text: z.string().optional(),
  classes: z.array(z.string()).optional(),
  attributes: z.record(z.string()).optional(),
});
export type ElementPatch = z.infer<typeof ElementPatch>;

export const Page = z.object({
  id: z.string(),
  path: z.string().regex(/^\/[a-z0-9\-/]*$/),
  title: z.string(),
  html: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Page = z.infer<typeof Page>;
