# M3 Multi-Format Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export any project to HTML (instant), PDF (Playwright headless), or PPTX (screenshot slides) from a single Export button in the workspace header.

**Architecture:** BullMQ `export-queue` (already stubbed) processes PDF and PPTX jobs asynchronously. The API serves export status and file download endpoints. The web polls every 2 s and auto-downloads when done. HTML export is client-side only (no API call). Playwright runs inside the API process; the Docker image switches from Alpine to Debian-slim to support Chromium binaries.

**Tech Stack:** Drizzle ORM (export_jobs table), BullMQ (async jobs), Playwright (headless render), pdf-lib (PDF merge), pptxgenjs (PPTX slides), Zod (shared schemas), React (ExportDialog + polling hook).

---

## File Map

| Action | File |
|--------|------|
| Create | `packages/db/src/schema/export-jobs.ts` |
| Modify | `packages/db/src/schema/index.ts` |
| Create | `packages/db/migrations/0002_export_jobs.sql` |
| Create | `packages/shared/src/exports.ts` |
| Modify | `packages/shared/src/index.ts` |
| Create | `apps/api/src/lib/html-inject.ts` |
| Create | `apps/api/src/lib/export-pdf.ts` |
| Create | `apps/api/src/lib/export-pptx.ts` |
| Create | `apps/api/src/routes/exports.ts` |
| Modify | `apps/api/src/server.ts` |
| Modify | `apps/api/src/worker.ts` |
| Modify | `docker/Dockerfile.api` |
| Create | `apps/web/src/lib/export/useExport.ts` |
| Create | `apps/web/src/components/export/ExportDialog.tsx` |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx` |

---

## Task 1: DB — export_jobs schema + migration

**Files:**
- Create: `packages/db/src/schema/export-jobs.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/migrations/0002_export_jobs.sql`

- [ ] **Step 1: Create `packages/db/src/schema/export-jobs.ts`**

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const exportJobs = pgTable('export_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  format: text('format').notNull(),
  status: text('status').notNull().default('pending'),
  filePath: text('file_path'),
  errorMsg: text('error_msg'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ExportJob = typeof exportJobs.$inferSelect;
export type NewExportJob = typeof exportJobs.$inferInsert;
```

- [ ] **Step 2: Append to `packages/db/src/schema/index.ts`**

```typescript
export * from './export-jobs.js';
```

- [ ] **Step 3: Generate or write migration**

Try:
```bash
cd H:\60_OSS\you-design\packages\db && pnpm drizzle-kit generate
```

If drizzle-kit fails (ESM/CJS issue as in M2.2 and M2.3), write the migration manually.

Create `packages/db/migrations/0002_export_jobs.sql`:

```sql
CREATE TABLE "export_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "format" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "file_path" text,
  "error_msg" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

Update `packages/db/migrations/meta/_journal.json` — add entry:
```json
{ "idx": 2, "version": "7", "when": <current_timestamp_ms>, "tag": "0002_export_jobs", "breakpoints": true }
```

- [ ] **Step 4: Typecheck**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/db typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd H:\60_OSS\you-design
git add packages/db/src/schema/export-jobs.ts packages/db/src/schema/index.ts packages/db/migrations/
git commit -m "feat(db): export_jobs schema + migration"
```

---

## Task 2: Shared — exports.ts types

**Files:**
- Create: `packages/shared/src/exports.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/src/exports.ts`**

```typescript
import { z } from 'zod';

export const ExportFormat = z.enum(['html', 'pdf', 'pptx']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const CreateExportBody = z.object({
  projectId: z.string().uuid(),
  format: ExportFormat,
});

export const ExportJobStatus = z.object({
  id: z.string().uuid(),
  format: ExportFormat,
  status: z.enum(['pending', 'processing', 'done', 'failed']),
  errorMsg: z.string().nullable(),
});
export type ExportJobStatusType = z.infer<typeof ExportJobStatus>;
```

- [ ] **Step 2: Append to `packages/shared/src/index.ts`**

```typescript
export * from './exports.js';
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/shared typecheck
git add packages/shared/src/exports.ts packages/shared/src/index.ts
git commit -m "feat(shared): export format and job status Zod schemas"
```

---

## Task 3: API — install deps + html-inject + export-pdf + export-pptx

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/lib/html-inject.ts`
- Create: `apps/api/src/lib/export-pdf.ts`
- Create: `apps/api/src/lib/export-pptx.ts`

- [ ] **Step 1: Install API dependencies**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/api add playwright pdf-lib pptxgenjs
```

Expected: packages added to `apps/api/package.json` and lock file updated.

- [ ] **Step 2: Install Playwright's Chromium browser**

```bash
cd H:\60_OSS\you-design\apps\api && npx playwright install chromium
```

Expected: Chromium downloaded to `~/.cache/ms-playwright/` (used at dev time; Docker handles prod).

- [ ] **Step 3: Create `apps/api/src/lib/html-inject.ts`**

```typescript
export function injectTailwind(html: string): string {
  const cdnScript = '<script src="https://cdn.tailwindcss.com"></script>';
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${cdnScript}`);
  }
  return `<!DOCTYPE html><html><head>${cdnScript}</head><body>${html}</body></html>`;
}
```

- [ ] **Step 4: Create `apps/api/src/lib/export-pdf.ts`**

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { injectTailwind } from './html-inject.js';

interface PageData {
  path: string;
  title: string;
  html: string;
}

export async function runPdfExport(jobId: string, pages: PageData[]): Promise<string> {
  const browser = await chromium.launch();
  const pdfBuffers: Uint8Array[] = [];

  try {
    for (const pg of pages) {
      const bPage = await browser.newPage();
      await bPage.setContent(injectTailwind(pg.html), { waitUntil: 'networkidle', timeout: 30_000 });
      const buf = await bPage.pdf({ format: 'A4', printBackground: true });
      pdfBuffers.push(buf);
      await bPage.close();
    }
  } finally {
    await browser.close();
  }

  const merged = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const src = await PDFDocument.load(buf);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }

  const outDir = path.resolve(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${jobId}.pdf`);
  fs.writeFileSync(outPath, await merged.save());
  return outPath;
}
```

- [ ] **Step 5: Create `apps/api/src/lib/export-pptx.ts`**

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';
import pptxgen from 'pptxgenjs';
import { injectTailwind } from './html-inject.js';

interface PageData {
  path: string;
  title: string;
  html: string;
}

export async function runPptxExport(jobId: string, pages: PageData[]): Promise<string> {
  const browser = await chromium.launch();
  const screenshots: Buffer[] = [];

  try {
    for (const pg of pages) {
      const bPage = await browser.newPage();
      await bPage.setViewportSize({ width: 1280, height: 960 });
      await bPage.setContent(injectTailwind(pg.html), { waitUntil: 'networkidle', timeout: 30_000 });
      const buf = await bPage.screenshot({ fullPage: false, type: 'png' });
      screenshots.push(buf);
      await bPage.close();
    }
  } finally {
    await browser.close();
  }

  const prs = new pptxgen();
  prs.defineLayout({ name: 'LAYOUT_WIDE', width: 10, height: 7.5 });
  prs.layout = 'LAYOUT_WIDE';

  for (const shot of screenshots) {
    const slide = prs.addSlide();
    slide.addImage({
      data: `data:image/png;base64,${shot.toString('base64')}`,
      x: 0, y: 0, w: '100%', h: '100%',
    });
  }

  const outDir = path.resolve(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${jobId}.pptx`);
  await prs.writeFile({ fileName: outPath });
  return outPath;
}
```

- [ ] **Step 6: Typecheck**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/api typecheck
```

Fix any errors (e.g. pptxgenjs types, pdf-lib types).

- [ ] **Step 7: Commit**

```bash
cd H:\60_OSS\you-design
git add apps/api/package.json apps/api/src/lib/html-inject.ts apps/api/src/lib/export-pdf.ts apps/api/src/lib/export-pptx.ts pnpm-lock.yaml
git commit -m "feat(api): Playwright + pdf-lib + pptxgenjs deps, export helpers"
```

---

## Task 4: API — exports route + server registration

**Files:**
- Create: `apps/api/src/routes/exports.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Create `apps/api/src/routes/exports.ts`**

```typescript
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
    const { projectId, format } = parsed.data;

    // Fetch pages from DB for the job payload
    const pages = await db
      .select({ path: schema.projectPages.path, title: schema.projectPages.title, html: schema.projectPages.html })
      .from(schema.projectPages)
      .where(eq(schema.projectPages.projectId, projectId));

    // Insert job row
    const [job] = await db
      .insert(schema.exportJobs)
      .values({ projectId, format })
      .returning();

    // Enqueue
    await exportQueue.add('export', {
      jobId: job!.id,
      projectId,
      format,
      pages,
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
    return {
      id: row.id,
      format: row.format,
      status: row.status,
      errorMsg: row.errorMsg,
    };
  });

  // GET /exports/:jobId/download — serve file
  app.get('/exports/:jobId/download', async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const [row] = await db
      .select()
      .from(schema.exportJobs)
      .where(eq(schema.exportJobs.id, jobId));

    if (!row) {
      reply.code(404);
      return { error: 'NOT_FOUND' };
    }
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
      ext === 'pdf' ? 'application/pdf' :
      ext === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' :
      'text/html';

    reply.header('Content-Disposition', `attachment; filename="export.${ext}"`);
    reply.header('Content-Type', contentType);
    return reply.send(fs.createReadStream(row.filePath));
  });
}
```

- [ ] **Step 2: Create queue helper `apps/api/src/lib/queues.ts`** (if not already existing)

Check if `apps/api/src/lib/` has a `queues.ts`. If not, create it:

```typescript
import { Queue } from 'bullmq';
import { redis } from './redis.js';

export const exportQueue = new Queue('export-queue', { connection: redis });
export const llmQueue = new Queue('llm-queue', { connection: redis });
```

- [ ] **Step 3: Register in `apps/api/src/server.ts`**

Add import:
```typescript
import { exportsRoutes } from './routes/exports.js';
```

Add registration after usageRoutes:
```typescript
await app.register(exportsRoutes, { prefix: '/api/v1' });
```

- [ ] **Step 4: Typecheck**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/api typecheck
```

- [ ] **Step 5: Commit**

```bash
cd H:\60_OSS\you-design
git add apps/api/src/routes/exports.ts apps/api/src/lib/queues.ts apps/api/src/server.ts
git commit -m "feat(api): exports routes POST/GET status/GET download"
```

---

## Task 5: API — wire export worker

**Files:**
- Modify: `apps/api/src/worker.ts`

- [ ] **Step 1: Rewrite `apps/api/src/worker.ts`**

```typescript
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, schema } from '@you-design/db';
import { env } from './config.js';
import { redis } from './lib/redis.js';
import { runPdfExport } from './lib/export-pdf.js';
import { runPptxExport } from './lib/export-pptx.js';

interface ExportJobData {
  jobId: string;
  projectId: string;
  format: 'html' | 'pdf' | 'pptx';
  pages: Array<{ path: string; title: string; html: string }>;
}

async function main() {
  console.log('[worker] starting...');

  const exportWorker = new Worker<ExportJobData>(
    'export-queue',
    async (job) => {
      const { jobId, format, pages } = job.data;
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

- [ ] **Step 2: Typecheck**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/api typecheck
```

- [ ] **Step 3: Commit**

```bash
cd H:\60_OSS\you-design
git add apps/api/src/worker.ts
git commit -m "feat(api): export worker — PDF via Playwright + pdf-lib, PPTX via Playwright screenshots + pptxgenjs"
```

---

## Task 6: Docker — Playwright in API image

**Files:**
- Modify: `docker/Dockerfile.api`

- [ ] **Step 1: Read current `docker/Dockerfile.api`**

Current runner stage uses `node:22-alpine`. Alpine lacks glibc which Chromium requires. Switch runner to `node:22-slim` (Debian) and install Playwright's Chromium.

- [ ] **Step 2: Rewrite `docker/Dockerfile.api`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/llm/package.json ./packages/llm/package.json
RUN pnpm install --frozen-lockfile=false

# -----------------------------------------------------------------------------
# Builder
# -----------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @you-design/api... build

# -----------------------------------------------------------------------------
# Runner
# -----------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Chromium OS dependencies + Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 \
    libasound2 libxshmfence1 libxrandr2 libpangocairo-1.0-0 \
    libcairo2 libpango-1.0-0 libatspi2.0-0 libgtk-3-0 \
    ca-certificates fonts-liberation wget \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --gid 1001 nodejs && adduser --uid 1001 --ingroup nodejs --disabled-password --gecos "" api

COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/packages ./packages
COPY --from=builder --chown=api:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=api:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=api:nodejs /app/package.json ./package.json

# Install Playwright Chromium as root, then set ownership
RUN npx playwright install chromium --with-deps 2>/dev/null || \
    node node_modules/playwright/install.js chromium

RUN mkdir -p /app/exports && chown api:nodejs /app/exports

USER api
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
```

- [ ] **Step 3: Commit**

```bash
cd H:\60_OSS\you-design
git add docker/Dockerfile.api
git commit -m "feat(docker): switch API runner to Debian-slim, install Playwright Chromium"
```

---

## Task 7: Web — useExport hook + ExportDialog

**Files:**
- Create: `apps/web/src/lib/export/useExport.ts`
- Create: `apps/web/src/components/export/ExportDialog.tsx`

- [ ] **Step 1: Create `apps/web/src/lib/export/useExport.ts`**

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import type { ExportFormat } from '@you-design/shared';

const API_BASE = 'http://localhost:3001/api/v1';
const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export type ExportStatus = 'idle' | 'pending' | 'processing' | 'done' | 'failed';

export function useExport() {
  const pages = useWorkspaceStore((s) => s.pages);
  const projectId = useWorkspaceStore((s) => s.projectId);
  const projectName = useWorkspaceStore((s) => s.projectName);

  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number>(0);

  const stopPolling = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const exportHtml = useCallback(() => {
    const allPages = Object.values(pages);
    const combined = allPages
      .map((p) => `<!-- Page: ${p.path} -->\n${p.html}`)
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
        const data = (await res.json()) as { status: string; errorMsg?: string };

        if (data.status === 'done') {
          setStatus('done');
          // trigger download
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
    async (format: ExportFormat) => {
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
        const res = await fetch(`${API_BASE}/exports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, format }),
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
  }, []);

  return { startExport, status, error, reset };
}
```

- [ ] **Step 2: Create `apps/web/src/components/export/ExportDialog.tsx`**

```typescript
'use client';

import * as React from 'react';
import { useExport } from '@/lib/export/useExport';
import type { ExportFormat } from '@you-design/shared';

interface Props {
  onClose: () => void;
}

const FORMATS: Array<{ id: ExportFormat; label: string; desc: string }> = [
  { id: 'html', label: 'HTML', desc: 'Single file, instant download' },
  { id: 'pdf', label: 'PDF', desc: 'Print-ready, all pages' },
  { id: 'pptx', label: 'PPTX', desc: 'Slide deck, one slide per page' },
];

const STATUS_MSG: Record<string, string> = {
  pending: 'Queued…',
  processing: 'Rendering…',
  done: 'Done — downloading…',
  failed: 'Export failed.',
};

export function ExportDialog({ onClose }: Props) {
  const [selected, setSelected] = React.useState<ExportFormat>('html');
  const { startExport, status, error, reset } = useExport();

  const isWorking = status === 'pending' || status === 'processing';
  const isDone = status === 'done';

  const handleExport = () => void startExport(selected);

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

- [ ] **Step 3: Typecheck**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
```

- [ ] **Step 4: Commit**

```bash
cd H:\60_OSS\you-design
git add apps/web/src/lib/export/useExport.ts apps/web/src/components/export/ExportDialog.tsx
git commit -m "feat(web): useExport hook + ExportDialog component"
```

---

## Task 8: Web — Export button in WorkspaceLayout + final checks

**Files:**
- Modify: `apps/web/src/components/workspace/WorkspaceLayout.tsx`

- [ ] **Step 1: Read `apps/web/src/components/workspace/WorkspaceLayout.tsx` then add Export button**

Add import at top:
```typescript
import { ExportDialog } from '@/components/export/ExportDialog';
```

Add state inside component:
```typescript
  const [exportOpen, setExportOpen] = React.useState(false);
```

In the header, after the cost badge span, add:
```tsx
        <button
          onClick={() => setExportOpen(true)}
          className="ml-2 text-xs px-2 py-0.5 rounded border border-[color:var(--color-border)] hover:bg-[color:var(--color-border)]"
        >
          Export
        </button>
```

At the end of the outer `<div className="h-screen flex flex-col">`, before the closing tag, add:
```tsx
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
```

- [ ] **Step 2: Full typecheck**

```bash
cd H:\60_OSS\you-design && pnpm typecheck
```

Expected: `Tasks: 6 successful, 6 total`.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 4: Apply migration (Docker must be running)**

```bash
docker compose -f compose.dev.yml up -d
cd packages/db && pnpm drizzle-kit migrate
```

- [ ] **Step 5: Tag and push**

```bash
cd H:\60_OSS\you-design
git add apps/web/src/components/workspace/WorkspaceLayout.tsx
git commit -m "feat(web): Export button in header wires ExportDialog"
git tag v0.6.0-alpha
git push && git push --tags
```

---

## Self-Review

**Spec coverage:**
- ✅ export_jobs table (Task 1)
- ✅ Shared ExportFormat + ExportJobStatus schemas (Task 2)
- ✅ Playwright + pdf-lib + pptxgenjs installed, html-inject helper (Task 3)
- ✅ export-pdf.ts: Playwright → pdf-lib merge (Task 3)
- ✅ export-pptx.ts: Playwright screenshots → pptxgenjs slides (Task 3)
- ✅ POST /exports fetches pages from DB + enqueues BullMQ job (Task 4)
- ✅ GET /exports/:jobId status endpoint (Task 4)
- ✅ GET /exports/:jobId/download file stream (Task 4)
- ✅ Worker processes PDF and PPTX, updates status in DB (Task 5)
- ✅ Dockerfile.api switches to Debian-slim, installs Chromium (Task 6)
- ✅ HTML export client-side blob download (Task 7 — useExport.exportHtml)
- ✅ PDF/PPTX polling every 2s, auto-download when done (Task 7 — useExport.pollJob)
- ✅ 5-minute poll timeout → shows error (Task 7)
- ✅ ExportDialog with 3 format cards + status display (Task 7)
- ✅ Export button in WorkspaceLayout header (Task 8)
- ✅ ExportDialog conditional render (Task 8)

**Type consistency:**
- `ExportFormat` defined in Task 2, used in Tasks 4, 5, 7 ✅
- `ExportJobData { jobId, projectId, format, pages }` defined in Task 5 worker, matches Task 4 enqueue payload ✅
- `runPdfExport(jobId, pages)` defined in Task 3, called in Task 5 ✅
- `runPptxExport(jobId, pages)` defined in Task 3, called in Task 5 ✅
- `useExport()` returns `{ startExport, status, error, reset }` defined in Task 7, used in ExportDialog Task 7 ✅
