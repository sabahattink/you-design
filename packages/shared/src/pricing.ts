export interface PricingEntry {
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICING: Record<string, PricingEntry> = {
  'claude-haiku-4-5':          { inputPer1M: 0.80,  outputPer1M: 4.00  },
  'claude-haiku-4-5-20251001': { inputPer1M: 0.80,  outputPer1M: 4.00  },
  'claude-sonnet-4-5':         { inputPer1M: 3.00,  outputPer1M: 15.00 },
  'claude-sonnet-4-6':         { inputPer1M: 3.00,  outputPer1M: 15.00 },
  'claude-opus-4-7':           { inputPer1M: 15.00, outputPer1M: 75.00 },
  'gpt-4o-mini':               { inputPer1M: 0.15,  outputPer1M: 0.60  },
  'gpt-4o':                    { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4.1-mini':              { inputPer1M: 0.40,  outputPer1M: 1.60  },
  'gpt-4.1':                   { inputPer1M: 2.00,  outputPer1M: 8.00  },
  'gemini-1.5-flash':          { inputPer1M: 0.075, outputPer1M: 0.30  },
  'gemini-1.5-flash-latest':   { inputPer1M: 0.075, outputPer1M: 0.30  },
  'gemini-1.5-pro':            { inputPer1M: 3.50,  outputPer1M: 10.50 },
  'gemini-1.5-pro-latest':     { inputPer1M: 3.50,  outputPer1M: 10.50 },
  'gemini-2.0-flash':          { inputPer1M: 0.10,  outputPer1M: 0.40  },
  'gemini-2.0-flash-exp':      { inputPer1M: 0.10,  outputPer1M: 0.40  },
};

export function estimateCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const entry = MODEL_PRICING[modelName];
  if (!entry) return null;
  return (
    (promptTokens / 1_000_000) * entry.inputPer1M +
    (completionTokens / 1_000_000) * entry.outputPer1M
  );
}
