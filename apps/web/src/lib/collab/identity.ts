const STORAGE_KEY = 'you-design.collab.identity.v1';

const COLORS = [
  '#e11d48',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#64748b',
  '#84cc16',
] as const;

export interface Identity {
  id: string;
  displayName: string;
  color: string;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: rfc4122-ish without true randomness guarantees.
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function pickColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0];
}

function makeFresh(): Identity {
  return {
    id: generateUuid(),
    displayName: `Guest ${Math.floor(Math.random() * 9000) + 1000}`,
    color: pickColor(),
  };
}

export function getOrCreateIdentity(): Identity {
  if (typeof window === 'undefined') {
    return { id: 'ssr', displayName: 'You', color: COLORS[0] };
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<Identity>;
      if (parsed.id && parsed.displayName && parsed.color) {
        return { id: parsed.id, displayName: parsed.displayName, color: parsed.color };
      }
    } catch {
      // fall through to regenerate
    }
  }
  const fresh = makeFresh();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function updateDisplayName(name: string): Identity {
  const current = getOrCreateIdentity();
  const trimmed = name.trim();
  const next: Identity = {
    ...current,
    displayName: trimmed || current.displayName,
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
