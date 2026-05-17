import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ChatMessage,
  IntentContract,
  Page,
  ModelConfig,
  CriticReport,
  IssueStatus,
  AnalyticsConfig,
  AnalyticsSummary,
} from '@you-design/shared';
import type { CollabStatus, RemoteCursor } from '@/lib/collab/types';

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

  // Multi-provider LLM config (BYOK, stored locally).
  models: ModelConfig[];
  defaultModelId: string | null;

  // Build-phase critic state (M2.1).
  criticReports: Record<string, CriticReport[]>;
  agentsRunning: Partial<Record<'critic' | 'copywriter' | 'a11y' | 'dev', boolean>>;
  analyticsConfig: AnalyticsConfig | null;
  analyticsCache: AnalyticsSummary | null;
  projectId: string | null;
  projectName: string;
  sessionCostUsd: number;

  // Multiplayer (M5b).
  collabStatus: CollabStatus;
  remoteCursors: Record<string, RemoteCursor>;
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

  upsertModel: (model: ModelConfig) => void;
  removeModel: (id: string) => void;
  setDefaultModel: (id: string) => void;

  addCriticReport: (report: CriticReport) => void;
  updateIssueStatus: (
    reportId: string,
    issueId: string,
    status: IssueStatus,
  ) => void;
  setAgentRunning: (agent: 'critic' | 'copywriter' | 'a11y' | 'dev', running: boolean) => void;
  setAnalyticsConfig: (config: AnalyticsConfig | null) => void;
  setAnalyticsCache: (data: AnalyticsSummary | null) => void;
  clearCriticReports: (pagePath: string) => void;
  setProjectId: (id: string) => void;
  setProjectName: (name: string) => void;
  appendSessionCost: (delta: number) => void;

  setCollabStatus: (s: CollabStatus) => void;
  setRemoteCursors: (next: Record<string, RemoteCursor>) => void;
  __hydratePagesFromY: (
    next: Record<string, Page>,
    currentPath: string,
  ) => void;
}

const DEFAULT_MODEL: ModelConfig = {
  id: 'default-anthropic',
  label: 'Claude Sonnet 4.5 (env key)',
  provider: 'anthropic',
  modelName: 'claude-sonnet-4-5',
  tier: 'standard',
};

const INITIAL: WorkspaceState = {
  intentPhase: 'collecting',
  intentMessages: [],
  intentContract: null,
  pages: {},
  currentPath: '/',
  selectedElementId: null,
  buildMessages: [],
  isStreaming: false,
  models: [DEFAULT_MODEL],
  defaultModelId: DEFAULT_MODEL.id,
  criticReports: {},
  agentsRunning: {},
  analyticsConfig: null,
  analyticsCache: null,
  projectId: null,
  projectName: '',
  sessionCostUsd: 0,
  collabStatus: 'idle',
  remoteCursors: {},
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
      upsertModel: (model) =>
        set((s) => {
          const filtered = s.models.filter((m) => m.id !== model.id);
          return {
            models: [...filtered, model],
            defaultModelId: s.defaultModelId ?? model.id,
          };
        }),
      removeModel: (id) =>
        set((s) => {
          const next = s.models.filter((m) => m.id !== id);
          return {
            models: next,
            defaultModelId:
              s.defaultModelId === id ? (next[0]?.id ?? null) : s.defaultModelId,
          };
        }),
      setDefaultModel: (id) => set({ defaultModelId: id }),

      addCriticReport: (report) =>
        set((s) => {
          const existing = s.criticReports[report.pagePath] ?? [];
          const trimmed = [report, ...existing].slice(0, 5);
          return {
            criticReports: { ...s.criticReports, [report.pagePath]: trimmed },
          };
        }),
      updateIssueStatus: (reportId, issueId, status) =>
        set((s) => {
          const next: Record<string, CriticReport[]> = {};
          for (const [path, reports] of Object.entries(s.criticReports)) {
            next[path] = reports.map((r) =>
              r.id !== reportId
                ? r
                : {
                    ...r,
                    issues: r.issues.map((i) =>
                      i.id === issueId ? { ...i, status } : i,
                    ),
                  },
            );
          }
          return { criticReports: next };
        }),
      setAgentRunning: (agent, running) =>
        set((s) => ({
          agentsRunning: { ...s.agentsRunning, [agent]: running },
        })),
      setAnalyticsConfig: (analyticsConfig) => set({ analyticsConfig }),
      setAnalyticsCache: (analyticsCache) => set({ analyticsCache }),
      setProjectId: (projectId) => set({ projectId }),
      setProjectName: (projectName) => set({ projectName }),
      appendSessionCost: (delta) =>
        set((s) => ({ sessionCostUsd: s.sessionCostUsd + delta })),
      clearCriticReports: (pagePath) =>
        set((s) => {
          const next = { ...s.criticReports };
          delete next[pagePath];
          return { criticReports: next };
        }),
      setCollabStatus: (collabStatus) => set({ collabStatus }),
      setRemoteCursors: (remoteCursors) => set({ remoteCursors }),
      __hydratePagesFromY: (next, currentPath) =>
        set((s) => {
          if (pagesShallowEqual(s.pages, next) && s.currentPath === currentPath) {
            return s;
          }
          return { ...s, pages: next, currentPath };
        }),
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
        models: state.models,
        defaultModelId: state.defaultModelId,
        criticReports: state.criticReports,
        analyticsConfig: state.analyticsConfig,
        projectId: state.projectId,
        projectName: state.projectName,
      }),
    },
  ),
);

function pagesShallowEqual(
  a: Record<string, Page>,
  b: Record<string, Page>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    const pa = a[k];
    const pb = b[k];
    if (!pa || !pb) return false;
    if (
      pa.id !== pb.id ||
      pa.path !== pb.path ||
      pa.title !== pb.title ||
      pa.html !== pb.html ||
      pa.updatedAt !== pb.updatedAt
    ) {
      return false;
    }
  }
  return true;
}

export function selectActiveModel(state: WorkspaceState): ModelConfig | null {
  if (!state.defaultModelId) return state.models[0] ?? null;
  return (
    state.models.find((m) => m.id === state.defaultModelId) ??
    state.models[0] ??
    null
  );
}

export function selectIsCriticRunning(state: WorkspaceState): boolean {
  return state.agentsRunning['critic'] ?? false;
}
