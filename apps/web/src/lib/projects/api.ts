import type { ProjectMetaType, ProjectFullType, ProjectPatchType } from '@you-design/shared';

const BASE = 'http://localhost:3001/api/v1';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function listProjects(): Promise<ProjectMetaType[]> {
  const data = await apiFetch<{ projects: ProjectMetaType[] }>('/projects');
  return data.projects;
}

export async function createProject(name: string): Promise<ProjectMetaType> {
  const data = await apiFetch<{ project: ProjectMetaType }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.project;
}

export async function loadProject(id: string): Promise<ProjectFullType> {
  const data = await apiFetch<{ project: ProjectFullType }>(`/projects/${id}`);
  return data.project;
}

export async function saveProject(id: string, patch: ProjectPatchType): Promise<void> {
  await apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/projects/${id}`, { method: 'DELETE' });
}

export async function storeMemory(
  projectId: string,
  summary: string,
  openAiKey?: string,
): Promise<void> {
  await apiFetch(`/projects/${projectId}/memories`, {
    method: 'POST',
    body: JSON.stringify({ summary, openAiKey }),
  });
}

export async function searchMemories(
  projectId: string,
  q: string,
  openAiKey?: string,
): Promise<string[]> {
  const data = await apiFetch<{ memories: string[] }>(`/projects/${projectId}/memories/search`, {
    method: 'POST',
    body: JSON.stringify({ q, openAiKey }),
  });
  return data.memories;
}
