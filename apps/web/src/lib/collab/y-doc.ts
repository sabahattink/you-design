import { createProvider, type ProviderBundle } from './provider.js';

interface Entry {
  projectId: string;
  bundle: ProviderBundle;
  refCount: number;
}

let current: Entry | null = null;

export interface YDocHandle extends ProviderBundle {
  dispose: () => void;
}

function teardown(entry: Entry): void {
  try {
    entry.bundle.provider.destroy();
  } catch {
    // ignore
  }
  try {
    entry.bundle.persistence.destroy();
  } catch {
    // ignore
  }
  try {
    entry.bundle.doc.destroy();
  } catch {
    // ignore
  }
}

export function acquireYDoc(projectId: string): YDocHandle {
  if (current && current.projectId !== projectId) {
    teardown(current);
    current = null;
  }
  if (!current) {
    current = { projectId, bundle: createProvider(projectId), refCount: 0 };
  }
  current.refCount += 1;
  const captured = current;
  return {
    ...captured.bundle,
    dispose: () => {
      captured.refCount -= 1;
      if (captured.refCount <= 0 && current === captured) {
        teardown(captured);
        current = null;
      }
    },
  };
}
