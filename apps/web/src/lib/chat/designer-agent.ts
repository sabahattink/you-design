import { getDomain } from '@/lib/domains';

export interface DesignerContext {
  persona: { role: string };
  primaryAction: string;
  emotion: string;
  domain: string;
}

export function designerSystemPrompt(contract: DesignerContext, memories: string[] = []): string {
  const domain = getDomain(contract.domain);
  const base = `You are the Designer Agent for You Design.

The intent contract has been approved:
- Persona: ${contract.persona.role}
- Primary action: ${contract.primaryAction}
- Emotion: ${contract.emotion}
- Domain: ${domain.label}

Your job: generate or modify HTML + Tailwind pages that fulfill the contract.

DOMAIN RULES:
${domain.designerAddendum}

EXAMPLE STRUCTURE (use as a guide, not a strict template):
${domain.exampleStructure}

HARD RULES:
- Output complete HTML documents only: <html><head></head><body>...</body></html>.
- Use Tailwind utility classes only. No inline styles. No external CSS. No <style> tags.
- No JSX. No React components. No imports.
- Semantic HTML: <header>, <main>, <section>, <nav>, <footer>, <article> where appropriate.
- Default a11y: alt text on every img, label every input, aria-current on nav, focus-visible classes.
- Use <a href="/path"> for internal navigation. The host runtime intercepts these.
- Every page must reflect the persona, primary action, and emotion above.
- Be opinionated. Make real design choices. Don't ask "what color should the button be" — pick one and justify if asked later.

WHEN MODIFYING:
- If the user asks to change a specific element (text, color, layout), use update_element with the data-yd-id.
- If the user asks to add to a page, use add_element with parentId.
- If the user asks for a new page, use write_page with a path like '/pricing' or '/about'.
- After tool calls, give a one-line summary of what you did. No flattery.

START:
On your first turn after the contract, immediately call write_page with path "/" — the homepage — with a full landing page that nails the persona/action/emotion AND the domain rules above.`;

  const memoryBlock =
    memories.length > 0
      ? `\n\nProject memory (past sessions):\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
      : '';
  return `${base}${memoryBlock}`;
}

export const DESIGNER_TOOLS = [
  {
    name: 'write_page',
    description:
      'Create or fully replace a page. Use for new pages or major rewrites. HTML must be a complete document.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path starting with / (e.g. "/", "/pricing")',
        },
        title: { type: 'string', description: 'Browser tab title' },
        html: { type: 'string', description: 'Complete HTML document' },
      },
      required: ['path', 'title', 'html'],
    },
  },
  {
    name: 'update_element',
    description: 'Patch a single element identified by its data-yd-id on a given page path.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        elementId: { type: 'string' },
        patch: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            classes: { type: 'array', items: { type: 'string' } },
            attributes: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
        },
      },
      required: ['path', 'elementId', 'patch'],
    },
  },
  {
    name: 'add_element',
    description: 'Append a new HTML fragment inside a parent element (by id) on a given page.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        parentId: { type: 'string' },
        html: { type: 'string' },
      },
      required: ['path', 'parentId', 'html'],
    },
  },
  {
    name: 'navigate',
    description: 'Set the active page in the workspace.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
];
