# M6a — Motion Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MP4 and GIF export to the existing multi-format pipeline — each workspace page is rendered as a Playwright screenshot and stitched into an animated slideshow via FFmpeg.

**Architecture:** Reuses the BullMQ export queue, Drizzle `export_jobs` table, and download endpoint from M3. A new `export-motion.ts` handles Playwright screenshots + FFmpeg xfade chain. Motion settings (duration, transition, resolution) flow from the extended `ExportDialog` → `useExport` → API body → BullMQ job → worker. `MotionExportOptions` is validated with Zod in `packages/shared`.

**Tech Stack:** Playwright (already installed), FFmpeg (add to Dockerfile + dev machine), `node:child_process.execFile` (no new npm packages), Zod (existing), BullMQ (existing).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/shared/src/exports.ts` | Add `'mp4'`/`'gif'` to `ExportFormat`, new `MotionExportOptions` schema, extend `CreateExportBody` |
| Create | `apps/api/src/lib/export-motion.ts` | Playwright screenshots → FFmpeg stitch → MP4/GIF |
| Create | `apps/api/src/lib/export-motion.test.ts` | Unit tests for pure `buildFfmpegArgs` |
| Modify | `apps/api/src/worker.ts` | Handle `'mp4'` / `'gif'` formats in export worker |
| Modify | `apps/api/src/routes/exports.ts` | Pass `motionOptions` to job; add mp4/gif content-types |
| Modify | `docker/Dockerfile.api` | Add `ffmpeg` to apt-get in runner stage |
| Modify | `apps/web/src/lib/export/useExport.ts` | Accept `motionOptions?` in `startExport`, forward in POST body |
| Modify | `apps/web/src/components/export/ExportDialog.tsx` | Add mp4/gif options + inline motion settings panel |

---

## Task 1: Extend shared types

**Files:**
- Modify: `packages/shared/src/exports.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
// packages/shared/src/exports.ts
import { z } from 'zod';

export const ExportFormat = z.enum(['html', 'pdf', 'pptx', 'mp4', 'gif']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const MotionExportOptions = z.object({
  durationPerPage: z.number().int().min(1).max(30).default(3),
  transitionDuration: z.number().min(0).max(2).default(0.5),
  fps: z.number().int().min(10).max(60).default(24),
  resolution: z.enum(['720p', '1080p']).default('720p'),
  transition: z.enum(['fade', 'slideleft', 'wipeleft']).default('fade'),
});
export type MotionExportOptions = z.infer<typeof MotionExportOptions>;

export const CreateExportBody = z.object({
  projectId: z.string().uuid(),
  format: ExportFormat,
  motionOptions: MotionExportOptions.optional(),
});

export const ExportJobStatus = z.object({
  id: z.string().uuid(),
  format: ExportFormat,
  status: z.enum(['pending', 'processing', 'done', 'failed']),
  errorMsg: z.string().nullable(),
});
export type ExportJobStatusType = z.infer<typeof ExportJobStatus>;
```

- [ ] **Step 2: Verify `packages/shared/src/index.ts` already exports exports.ts**

It already has `export * from './exports.js';` — no change needed.

- [ ] **Step 3: Run shared typecheck**

```bash
cd packages/shared && pnpm typecheck
```

Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/exports.ts
git commit -m "feat(shared): add mp4/gif formats + MotionExportOptions schema"
```

---

## Task 2: Create API motion exporter

**Files:**
- Create: `apps/api/src/lib/export-motion.ts`
- Create: `apps/api/src/lib/export-motion.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// apps/api/src/lib/export-motion.test.ts
import { describe, it, expect } from 'vitest';
import { buildFfmpegArgs } from './export-motion.js';
import type { MotionExportOptions } from '@you-design/shared';

const defaults: MotionExportOptions = {
  durationPerPage: 3,
  transitionDuration: 0.5,
  fps: 24,
  resolution: '720p',
  transition: 'fade',
};

describe('buildFfmpegArgs', () => {
  it('single page: uses -loop 1 static encode', () => {
    const args = buildFfmpegArgs(['/tmp/p0.png'], '/out/job.mp4', defaults);
    expect(args).toContain('-loop');
    expect(args).toContain('1');
    expect(args).toContain('/tmp/p0.png');
    expect(args).toContain('/out/job.mp4');
    // no filter_complex for single page
    expect(args).not.toContain('-filter_complex');
  });

  it('two pages: includes xfade filter_complex', () => {
    const args = buildFfmpegArgs(['/tmp/p0.png', '/tmp/p1.png'], '/out/job.mp4', defaults);
    const idx = args.indexOf('-filter_complex');
    expect(idx).not.toBe(-1);
    expect(args[idx + 1]).toContain('xfade');
    expect(args[idx + 1]).toContain('fade');
    expect(args).toContain('-map');
    expect(args).toContain('[v]');
  });

  it('two pages: xfade offset equals durationPerPage', () => {
    const args = buildFfmpegArgs(['/tmp/p0.png', '/tmp/p1.png'], '/out/job.mp4', defaults);
    const filterIdx = args.indexOf('-filter_complex');
    const filter = args[filterIdx + 1]!;
    // offset=3 for first transition (durationPerPage=3, no prior transitions)
    expect(filter).toContain('offset=3');
  });

  it('three pages: two xfade segments chained', () => {
    const args = buildFfmpegArgs(
      ['/tmp/p0.png', '/tmp/p1.png', '/tmp/p2.png'],
      '/out/job.mp4',
      defaults,
    );
    const filterIdx = args.indexOf('-filter_complex');
    const filter = args[filterIdx + 1]!;
    expect(filter).toContain('[v1]');
    expect(filter).toContain('[v]');
    // Two xfade occurrences
    expect(filter.split('xfade').length - 1).toBe(2);
  });

  it('respects custom fps in output args', () => {
    const opts = { ...defaults, fps: 30 };
    const args = buildFfmpegArgs(['/tmp/p0.png'], '/out/job.mp4', opts);
    const rIdx = args.indexOf('-r');
    expect(rIdx).not.toBe(-1);
    expect(args[rIdx + 1]).toBe('30');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/api && pnpm test --reporter=verbose 2>&1 | head -30
```

Expected: `Cannot find module './export-motion.js'` or similar import error.

- [ ] **Step 3: Create the implementation**

```typescript
// apps/api/src/lib/export-motion.ts
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import type { MotionExportOptions } from '@you-design/shared';

const execFileAsync = promisify(execFile);

const RESOLUTION: Record<string, [number, number]> = {
  '720p': [1280, 720],
  '1080p': [1920, 1080],
};

interface PageData {
  path: string;
  title: string;
  html: string;
}

/** Pure function — builds the ffmpeg CLI args for stitching screenshots into MP4. */
export function buildFfmpegArgs(
  screenshotPaths: string[],
  outPath: string,
  opts: MotionExportOptions,
): string[] {
  const { durationPerPage, transitionDuration, fps, transition } = opts;
  const n = screenshotPaths.length;

  if (n === 1) {
    return [
      '-loop', '1',
      '-t', String(durationPerPage),
      '-i', screenshotPaths[0]!,
      '-vcodec', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      '-y', outPath,
    ];
  }

  const args: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i < n - 1 ? durationPerPage + transitionDuration : durationPerPage;
    args.push('-loop', '1', '-t', String(t), '-i', screenshotPaths[i]!);
  }

  let filterComplex = '';
  let lastLabel = '[0]';
  for (let i = 1; i < n; i++) {
    const offset = i * durationPerPage - (i - 1) * transitionDuration;
    const outLabel = i < n - 1 ? `[v${i}]` : '[v]';
    filterComplex += `${lastLabel}[${i}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}${outLabel};`;
    lastLabel = `[v${i}]`;
  }
  filterComplex = filterComplex.replace(/;$/, '');

  args.push(
    '-filter_complex', filterComplex,
    '-map', '[v]',
    '-vcodec', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-y', outPath,
  );

  return args;
}

export async function runMotionExport(
  jobId: string,
  pages: PageData[],
  format: 'mp4' | 'gif',
  opts: MotionExportOptions,
): Promise<string> {
  const [width, height] = RESOLUTION[opts.resolution] ?? [1280, 720];
  const tmpDir = path.join(os.tmpdir(), `motion-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const screenshotPaths: string[] = [];
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const browserPage = await browser.newPage();
  await browserPage.setViewportSize({ width, height });

  try {
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i]!;
      await browserPage.setContent(pg.html, { waitUntil: 'networkidle', timeout: 15_000 });
      const screenshotPath = path.join(tmpDir, `page_${String(i).padStart(3, '0')}.png`);
      await browserPage.screenshot({ path: screenshotPath, type: 'png' });
      screenshotPaths.push(screenshotPath);
    }
  } finally {
    await browser.close();
  }

  const outDir = '/app/exports';
  fs.mkdirSync(outDir, { recursive: true });
  const mp4Path = path.join(outDir, `${jobId}.mp4`);

  const ffArgs = buildFfmpegArgs(screenshotPaths, mp4Path, opts);
  await execFileAsync('ffmpeg', ffArgs, { maxBuffer: 50 * 1024 * 1024 });

  if (format === 'gif') {
    const gifPath = path.join(outDir, `${jobId}.gif`);
    await execFileAsync('ffmpeg', [
      '-i', mp4Path,
      '-vf', 'fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
      '-loop', '0',
      gifPath,
    ]);
    fs.unlinkSync(mp4Path);
    return gifPath;
  }

  return mp4Path;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/api && pnpm test --reporter=verbose 2>&1 | head -40
```

Expected: `5 passed` (the 5 new tests). Pre-existing tests still pass.

- [ ] **Step 5: Run API typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/export-motion.ts apps/api/src/lib/export-motion.test.ts
git commit -m "feat(api): motion export — Playwright screenshots + FFmpeg xfade stitch"
```

---

## Task 3: Wire motion into worker + routes

**Files:**
- Modify: `apps/api/src/worker.ts`
- Modify: `apps/api/src/routes/exports.ts`

- [ ] **Step 1: Update `apps/api/src/worker.ts`**

Replace the `ExportJobData` interface and add the motion branch:

```typescript
// apps/api/src/worker.ts — full file replacement
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, schema } from '@you-design/db';
import { MotionExportOptions } from '@you-design/shared';
import { env } from './config.js';
import { redis } from './lib/redis.js';
import { runPdfExport } from './lib/export-pdf.js';
import { runPptxExport } from './lib/export-pptx.js';
import { runMotionExport } from './lib/export-motion.js';

interface ExportJobData {
  jobId: string;
  projectId: string;
  format: 'html' | 'pdf' | 'pptx' | 'mp4' | 'gif';
  pages: Array<{ path: string; title: string; html: string }>;
  motionOptions?: unknown;
}

async function main() {
  console.log('[worker] starting...');

  const exportWorker = new Worker<ExportJobData>(
    'export-queue',
    async (job) => {
      const { jobId, format, pages, motionOptions } = job.data;
      console.log(`[worker:export] job ${jobId} format=${format} pages=${pages.length}`);

      await db
        .update(schema.exportJobs)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(schema.exportJobs.id, jobId));

      try {
        let filePath: string;
        if (format === 'pdf') {
          filePath = await runPdfExport(jobId, pages);
        } else if (format === 'pptx') {
          filePath = await runPptxExport(jobId, pages);
        } else if (format === 'mp4' || format === 'gif') {
          const opts = MotionExportOptions.parse(motionOptions ?? {});
          filePath = await runMotionExport(jobId, pages, format, opts);
        } else {
          throw new Error(`Unknown format: ${format}`);
        }

        await db
          .update(schema.exportJobs)
          .set({ status: 'done', filePath, updatedAt: new Date() })
          .where(eq(schema.exportJobs.id, jobId));

        console.log(`[worker:export] job ${jobId} done → ${filePath}`);
        return { ok: true, filePath };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await db
          .update(schema.exportJobs)
          .set({ status: 'failed', errorMsg, updatedAt: new Date() })
          .where(eq(schema.exportJobs.id, jobId));

        console.error(`[worker:export] job ${jobId} failed:`, errorMsg);
        throw err;
      }
    },
    { connection: redis, concurrency: env.QUEUE_CONCURRENCY },
  );

  const llmWorker = new Worker(
    'llm-queue',
    async (job) => {
      console.log(`[worker:llm] job ${job.id} — ${job.name}`, job.data);
      return { ok: true };
    },
    { connection: redis, concurrency: env.QUEUE_CONCURRENCY },
  );

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, shutting down...`);
    await Promise.all([exportWorker.close(), llmWorker.close()]);
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  console.log('[worker] ready — listening on export-queue, llm-queue');
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Update `apps/api/src/routes/exports.ts`**

Pass `motionOptions` through to the job and add mp4/gif content-types:

```typescript
// apps/api/src/routes/exports.ts — full file replacement
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '@you-design/db';
import { CreateExportBody } from '@you-design/shared';
import { exportQueue } from '../lib/queues.js';

export async function exportsRoutes(app: FastifyInstance) {
  // POST /exports — create job
  app.post('/exports', async (req, reply) => {
    const parsed = CreateExportBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'INVALID_BODY', message: parsed.error.message };
    }
    const { projectId, format, motionOptions } = parsed.data;

    const pages = await db
      .select({ path: schema.projectPages.path, title: schema.projectPages.title, html: schema.projectPages.html })
      .from(schema.projectPages)
      .where(eq(schema.projectPages.projectId, projectId));

    const [job] = await db
      .insert(schema.exportJobs)
      .values({ projectId, format })
      .returning();

    await exportQueue.add('export', {
      jobId: job!.id,
      projectId,
      format,
      pages,
      motionOptions,
    });

    reply.code(202);
    return { jobId: job!.id };
  });

  // GET /exports/:jobId — status
  app.get('/exports/:jobId', async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const [row] = await db
      .select()
      .from(schema.exportJobs)
      .where(eq(schema.exportJobs.id, jobId));
    if (!row) {
      reply.code(404);
      return { error: 'NOT_FOUND' };
    }
    return { id: row.id, format: row.format, status: row.status, errorMsg: row.errorMsg };
  });

  // GET /exports/:jobId/download — serve file
  app.get('/exports/:jobId/download', async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const [row] = await db
      .select()
      .from(schema.exportJobs)
      .where(eq(schema.exportJobs.id, jobId));

    if (!row) { reply.code(404); return { error: 'NOT_FOUND' }; }
    if (row.status !== 'done' || !row.filePath) {
      reply.code(409);
      return { error: 'NOT_READY', status: row.status };
    }
    if (!fs.existsSync(row.filePath)) {
      reply.code(404);
      return { error: 'FILE_MISSING' };
    }

    const ext = path.extname(row.filePath).slice(1);
    const contentType =
      ext === 'pdf'  ? 'application/pdf' :
      ext === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' :
      ext === 'mp4'  ? 'video/mp4' :
      ext === 'gif'  ? 'image/gif' :
      'text/html';

    reply.header('Content-Disposition', `attachment; filename="export.${ext}"`);
    reply.header('Content-Type', contentType);
    return reply.send(fs.createReadStream(row.filePath));
  });
}
```

- [ ] **Step 3: Run API typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/worker.ts apps/api/src/routes/exports.ts
git commit -m "feat(api): wire mp4/gif into export worker and routes"
```

---

## Task 4: Add FFmpeg to Dockerfile

**Files:**
- Modify: `docker/Dockerfile.api`

- [ ] **Step 1: Add `ffmpeg` to the runner stage apt-get install**

In `docker/Dockerfile.api`, find the `RUN apt-get update && apt-get install -y` block in the `runner` stage and add `ffmpeg \` to the list:

```dockerfile
# docker/Dockerfile.api — runner stage apt-get section (replace the existing RUN apt-get block)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 \
    libasound2 libxshmfence1 libxrandr2 libpangocairo-1.0-0 \
    libcairo2 libpango-1.0-0 libatspi2.0-0 \
    ca-certificates fonts-liberation wget \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Verify FFmpeg is available on the dev machine**

```powershell
ffmpeg -version
```

If not installed: `winget install Gyan.FFmpeg` (Windows) or `brew install ffmpeg` (macOS). After install, restart the terminal.

Expected: prints FFmpeg version line, e.g. `ffmpeg version 7.x.x`.

- [ ] **Step 3: Commit**

```bash
git add docker/Dockerfile.api
git commit -m "chore(docker): add ffmpeg to api runner image"
```

---

## Task 5: Extend useExport hook

**Files:**
- Modify: `apps/web/src/lib/export/useExport.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
// apps/web/src/lib/export/useExport.ts
'use client';

import { useState, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import type { ExportFormat, MotionExportOptions } from '@you-design/shared';
import { injectPostHog } from './inject-posthog';

const API_BASE = 'http://localhost:3001/api/v1';
const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 5 * 60 * 1000;

export type ExportStatus = 'idle' | 'pending' | 'processing' | 'done' | 'failed';

export function useExport() {
  const pages = useWorkspaceStore((s) => s.pages);
  const projectId = useWorkspaceStore((s) => s.projectId);
  const projectName = useWorkspaceStore((s) => s.projectName);

  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const exportHtml = useCallback(() => {
    const allPages = Object.values(pages);
    const analyticsConfig = useWorkspaceStore.getState().analyticsConfig;
    const combined = allPages
      .map((p) => {
        const html = analyticsConfig
          ? injectPostHog(p.html, analyticsConfig.postHogApiKey, analyticsConfig.postHogHost, p.path)
          : p.html;
        return `<!-- Page: ${p.path} -->\n${html}`;
      })
      .join('\n\n');
    const blob = new Blob([combined], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'export'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pages, projectName]);

  const pollJob = useCallback((jobId: string) => {
    const poll = async () => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT) {
        setStatus('failed');
        setError('Export timed out after 5 minutes.');
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/exports/${jobId}`);
        const data = (await res.json()) as { status: string; errorMsg?: string | null };

        if (data.status === 'done') {
          setStatus('done');
          const a = document.createElement('a');
          a.href = `${API_BASE}/exports/${jobId}/download`;
          a.click();
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.errorMsg ?? 'Export failed.');
        } else {
          setStatus(data.status as ExportStatus);
          timerRef.current = setTimeout(() => void poll(), POLL_INTERVAL);
        }
      } catch {
        setStatus('failed');
        setError('Could not reach export API.');
      }
    };
    void poll();
  }, []);

  const startExport = useCallback(
    async (format: ExportFormat, motionOptions?: MotionExportOptions) => {
      setError(null);

      if (format === 'html') {
        exportHtml();
        return;
      }

      if (!projectId) {
        setError('Save the project first before exporting.');
        return;
      }

      setStatus('pending');
      startedAt.current = Date.now();

      try {
        const body: Record<string, unknown> = { projectId, format };
        if (motionOptions) body.motionOptions = motionOptions;

        const res = await fetch(`${API_BASE}/exports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { jobId?: string; error?: string };
        if (!data.jobId) {
          setStatus('failed');
          setError(data.error ?? 'Failed to create export job.');
          return;
        }
        pollJob(data.jobId);
      } catch {
        setStatus('failed');
        setError('Could not reach export API.');
      }
    },
    [projectId, exportHtml, pollJob],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus('idle');
    setError(null);
  }, [stopPolling]);

  return { startExport, status, error, reset };
}
```

- [ ] **Step 2: Run web typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/export/useExport.ts
git commit -m "feat(web): extend useExport to forward motionOptions in export POST"
```

---

## Task 6: Extend ExportDialog with motion settings

**Files:**
- Modify: `apps/web/src/components/export/ExportDialog.tsx`

- [ ] **Step 1: Replace the file contents**

When mp4 or gif is selected, show an inline motion settings panel below the format selector.

```typescript
// apps/web/src/components/export/ExportDialog.tsx
'use client';

import * as React from 'react';
import { useExport } from '@/lib/export/useExport';
import type { ExportFormat, MotionExportOptions } from '@you-design/shared';

interface Props {
  onClose: () => void;
}

const FORMATS: Array<{ id: ExportFormat; label: string; desc: string }> = [
  { id: 'html',  label: 'HTML', desc: 'Single file, instant download' },
  { id: 'pdf',   label: 'PDF',  desc: 'Print-ready, all pages' },
  { id: 'pptx',  label: 'PPTX', desc: 'Slide deck, one slide per page' },
  { id: 'mp4',   label: 'MP4',  desc: 'Animated slideshow video' },
  { id: 'gif',   label: 'GIF',  desc: 'Animated GIF, smaller file' },
];

const STATUS_MSG: Record<string, string> = {
  pending:    'Queued…',
  processing: 'Rendering…',
  done:       'Done — downloading…',
  failed:     'Export failed.',
};

const DEFAULT_MOTION: MotionExportOptions = {
  durationPerPage:   3,
  transitionDuration: 0.5,
  fps:               24,
  resolution:        '720p',
  transition:        'fade',
};

export function ExportDialog({ onClose }: Props) {
  const [selected, setSelected] = React.useState<ExportFormat>('html');
  const [motion, setMotion] = React.useState<MotionExportOptions>(DEFAULT_MOTION);
  const { startExport, status, error, reset } = useExport();

  const isMotion = selected === 'mp4' || selected === 'gif';
  const isWorking = status === 'pending' || status === 'processing';
  const isDone    = status === 'done';

  const handleExport = () => {
    void startExport(selected, isMotion ? motion : undefined);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-lg shadow-2xl w-80 flex flex-col">
        <div className="p-4 border-b border-[color:var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold text-sm">Export Project</h2>
          <button
            onClick={handleClose}
            className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              disabled={isWorking}
              className={`px-3 py-2 rounded border text-left text-sm transition-colors ${
                selected === f.id
                  ? 'border-[color:var(--color-fg)] bg-[color:var(--color-border)]'
                  : 'border-[color:var(--color-border)]'
              } disabled:opacity-50`}
            >
              <span className="font-medium">{f.label}</span>
              <span className="ml-2 text-xs text-[color:var(--color-muted)]">{f.desc}</span>
            </button>
          ))}

          {isMotion && (
            <div className="mt-2 p-3 rounded border border-[color:var(--color-border)] bg-[color:var(--color-border)]/30 flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <label className="w-28 text-[color:var(--color-muted)]">Duration/page</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={motion.durationPerPage}
                  onChange={(e) => setMotion((m) => ({ ...m, durationPerPage: Number(e.target.value) }))}
                  className="w-16 px-1 py-0.5 rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-center"
                />
                <span className="text-[color:var(--color-muted)]">s</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="w-28 text-[color:var(--color-muted)]">Transition</label>
                <select
                  value={motion.transition}
                  onChange={(e) => setMotion((m) => ({ ...m, transition: e.target.value as MotionExportOptions['transition'] }))}
                  className="flex-1 px-1 py-0.5 rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg)]"
                >
                  <option value="fade">Fade</option>
                  <option value="slideleft">Slide left</option>
                  <option value="wipeleft">Wipe left</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="w-28 text-[color:var(--color-muted)]">Resolution</label>
                <select
                  value={motion.resolution}
                  onChange={(e) => setMotion((m) => ({ ...m, resolution: e.target.value as MotionExportOptions['resolution'] }))}
                  className="flex-1 px-1 py-0.5 rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg)]"
                >
                  <option value="720p">720p (1280×720)</option>
                  <option value="1080p">1080p (1920×1080)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {status !== 'idle' && (
          <div className="px-4 pb-2 text-xs text-[color:var(--color-muted)]">
            {error ?? STATUS_MSG[status]}
          </div>
        )}

        <div className="p-4 border-t border-[color:var(--color-border)] flex gap-2">
          <button
            onClick={handleExport}
            disabled={isWorking || isDone}
            className="flex-1 px-3 py-1.5 rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm disabled:opacity-50"
          >
            {isWorking ? 'Exporting…' : 'Export'}
          </button>
          <button
            onClick={handleClose}
            className="px-3 py-1.5 rounded border border-[color:var(--color-border)] text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full typecheck**

```bash
cd H:\60_OSS\you-design && pnpm typecheck
```

Expected: all 6 workspaces exit 0.

- [ ] **Step 3: Run all tests**

```bash
cd H:\60_OSS\you-design && pnpm test
```

Expected: all tests pass (including the 5 new `buildFfmpegArgs` tests).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/export/ExportDialog.tsx
git commit -m "feat(web): add MP4/GIF export options with inline motion settings panel"
```

---

## Task 7: Tag and push

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Tag v0.9.0-alpha**

```bash
git tag v0.9.0-alpha
git push origin v0.9.0-alpha
```

Expected: tag appears on GitHub.

---

## Dev Setup Note (one-time)

FFmpeg must be in PATH on the dev machine for the worker to function:

```powershell
# Windows
winget install Gyan.FFmpeg
# Then restart terminal and verify:
ffmpeg -version
```

The Docker image includes FFmpeg via the Dockerfile change in Task 4 — no action needed for production.

---

## Manual Smoke Test (after all tasks)

1. Start API: `cd apps/api && pnpm dev`
2. Start web: `cd apps/web && pnpm dev`
3. Open `http://localhost:3000/app`
4. Create/load a project with at least 2 pages
5. Click **Export** → select **MP4** → set duration to 2s → click **Export**
6. Wait for status → "Done — downloading…"
7. Open downloaded `.mp4` — should be a slideshow of the pages with fade transition
8. Repeat with **GIF** — should download a `.gif`
