import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChatMessage, IntentContract, Page } from '@you-design/shared';

export type IntentPhase = 'collecting' | 'contracted' | 'building';

export interface WorkspaceState {
  intentPhase: IntentPhase;
  intentMessages: ChatMessage[];
  intentContract: IntentContract | null;

  pages: Record<string, Page>;
  currentPath: string;
  selectedElementId: string | null;

  buildMessages: ChatMessage[];
  isStreaming: boolean;
}

export interface WorkspaceActions {
  reset: () => void;
  setIntentPhase: (phase: IntentPhase) => void;
  appendIntentMessage: (msg: ChatMessage) => void;
  setIntentContract: (raw: unknown) => void;
  appendBuildMessage: (msg: ChatMessage) => void;
  setStreaming: (s: boolean) => void;
  upsertPage: (page: Page) => void;
  removePage: (path: string) => void;
  setCurrentPath: (path: string) => void;
  setSelectedElement: (id: string | null) => void;
  updateCurrentPageHtml: (html: string) => void;
}

const INITIAL: WorkspaceState = {
  intentPhase: 'collecting',
  intentMessages: [],
  intentContract: null,
  pages: {},
  currentPath: '/',
  selectedElementId: null,
  buildMessages: [],
  isStreaming: false,
};

function normalizeContract(raw: unknown): IntentContract | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const personaRaw = r.persona;
  const persona =
    typeof personaRaw === 'string'
      ? { role: personaRaw }
      : (personaRaw as { role: string } | undefined) ?? { role: 'unknown' };
  const successMetric = r.successMetric as string | undefined;
  const successMetrics = Array.isArray(r.successMetrics)
    ? (r.successMetrics as Array<{ name: string; target: string }>)
    : successMetric
      ? [{ name: successMetric, target: successMetric }]
      : [];
  return {
    persona,
    primaryAction: String(r.primaryAction ?? ''),
    emotion: (r.emotion as IntentContract['emotion']) ?? 'minimal',
    domain: (r.domain as IntentContract['domain']) ?? 'general',
    successMetrics,
    constraints: Array.isArray(r.constraints) ? (r.constraints as string[]) : [],
  };
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      reset: () => set(INITIAL),
      setIntentPhase: (intentPhase) => set({ intentPhase }),
      appendIntentMessage: (msg) =>
        set((s) => ({ intentMessages: [...s.intentMessages, msg] })),
      setIntentContract: (raw) => set({ intentContract: normalizeContract(raw) }),
      appendBuildMessage: (msg) =>
        set((s) => ({ buildMessages: [...s.buildMessages, msg] })),
      setStreaming: (isStreaming) => set({ isStreaming }),
      upsertPage: (page) =>
        set((s) => ({ pages: { ...s.pages, [page.path]: page } })),
      removePage: (path) =>
        set((s) => {
          const next = { ...s.pages };
          delete next[path];
          return { pages: next };
        }),
      setCurrentPath: (currentPath) =>
        set({ currentPath, selectedElementId: null }),
      setSelectedElement: (selectedElementId) => set({ selectedElementId }),
      updateCurrentPageHtml: (html) => {
        const path = get().currentPath;
        const page = get().pages[path];
        if (!page) return;
        const updated: Page = {
          ...page,
          html,
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ pages: { ...s.pages, [path]: updated } }));
      },
    }),
    {
      name: 'you-design:workspace:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        intentPhase: state.intentPhase,
        intentMessages: state.intentMessages,
        intentContract: state.intentContract,
        pages: state.pages,
        currentPath: state.currentPath,
        buildMessages: state.buildMessages,
      }),
    },
  ),
);
