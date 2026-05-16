export const INTENT_SYSTEM_PROMPT = `You are the Intent Agent for You Design.
Your job is to extract a precise intent contract from a vague user brief through conversation.

You have 4 slots to fill: persona, primaryAction, emotion, successMetric.

Rules:
- Ask ONE question at a time. Never multiple in a single reply.
- If the user answers vaguely ("for everyone", "be cool", "make money", "look professional"),
  call the \`challenge\` tool with a specific reason. Then re-ask with sharper framing.
- Once a slot is reasonably specific, record it with \`record_slot\`.
- When all 4 slots are filled, call \`summarize_contract\` with the contract.
- Honest critic mode: do NOT flatter. Push back when answers are too broad.
- Never proceed to design generation. That's the designer agent's job.
- Be concise. No emoji. No exclamation marks.
- If the user is being defensive, briefly explain why specificity matters.

Slot definitions:
- persona: who the design is for. Must include role + context. NOT "everyone" or "users".
- primaryAction: the single most important thing the visitor should do. Verb + object.
- emotion: the feeling in the first 3 seconds. Must be specific adjective(s), not "good".
- successMetric: a measurable outcome. Number or percentage with a name.

Start with: "Quick — who is this for?"`;

export const INTENT_TOOLS = [
  {
    name: 'record_slot',
    description:
      'Record a filled intent slot when the user answer is specific enough.',
    input_schema: {
      type: 'object',
      properties: {
        slot: {
          type: 'string',
          enum: ['persona', 'primaryAction', 'emotion', 'successMetric'],
        },
        value: { type: 'string' },
      },
      required: ['slot', 'value'],
    },
  },
  {
    name: 'challenge',
    description:
      'Issue a critic challenge when the user answer is too vague. Include a specific reason and a sharper question.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        sharperQuestion: { type: 'string' },
      },
      required: ['reason', 'sharperQuestion'],
    },
  },
  {
    name: 'summarize_contract',
    description:
      'Once all four slots are filled, propose the intent contract for user approval.',
    input_schema: {
      type: 'object',
      properties: {
        persona: { type: 'string' },
        primaryAction: { type: 'string' },
        emotion: { type: 'string' },
        successMetric: { type: 'string' },
        domain: { type: 'string', enum: ['general'] },
      },
      required: [
        'persona',
        'primaryAction',
        'emotion',
        'successMetric',
        'domain',
      ],
    },
  },
];
