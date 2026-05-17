# M6a — Motion Export Design

**Goal:** Add MP4 and GIF export to the existing multi-format pipeline. Each workspace page is rendered as a screenshot by Playwright and stitched into an animated slideshow via FFmpeg. Reuses the BullMQ export queue, DB job table, and download endpoint from M3.

**Scope:** Slideshow video only (page-by-page animation). No canvas animation timeline, no CSS animation capture, no audio. YAGNI.

---

## 1. What Gets Built

```
User clicks "Export → Motion (MP4)" in WorkspaceLayout
  → MotionExportDialog opens (duration, transition, resolution, format)
  → useExport.exportMotion() POSTs to /api/v1/exports
  → BullMQ job picks it up
  → export-motion.ts: Playwright screenshots each page → FFmpeg xfade stitch → MP4 file
  → useExport polls /exports/:id → status: 'done'
  → Download button appears → GET /exports/:id/download streams file
```

---

## 2. Shared Types

### Modify `packages/shared/src/exports.ts`

```typescript
// Extend enum — add 'mp4' and 'gif'
export const ExportFormat = z.enum(['html', 'pdf', 'pptx', 'mp4', 'gif']);
export type ExportFormat = z.infer<typeof ExportFormat>;

// New: motion-specific settings (sent in CreateExportBody)
export const MotionExportOptions = z.object({
  durationPerPage: z.number().int().min(1).max(30).default(3),
  transitionDuration: z.number().min(0).max(2).default(0.5),
  fps: z.number().int().min(10).max(60).default(24),
  resolution: z.enum(['720p', '1080p']).default('720p'),
  transition: z.enum(['fade', 'slideleft', 'wipeleft']).default('fade'),
});
export type MotionExportOptions = z.infer<typeof MotionExportOptions>;

// Extend CreateExportBody — add optional motionOptions
export const CreateExportBody = z.object({
  projectId: z.string().uuid(),
  format: ExportFormat,
  motionOptions: MotionExportOptions.optional(),
});
```

Export `MotionExportOptions` from `packages/shared/src/index.ts`.

---

## 3. API: Motion Exporter

### Create `apps/api/src/lib/export-motion.ts`

Uses Playwright (already installed) + FFmpeg (added to Dockerfile) to produce MP4 or GIF.

```typescript
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import type { MotionExportOptions } from '@you-design/shared';

const execFileAsync = promisify(execFile);

const RESOLUTION = { '720p': [1280, 720], '1080p': [1920, 1080] } as const;

export async function runMotionExport(
  jobId: string,
  pages: Array<{ path: string; title: string; html: string }>,
  format: 'mp4' | 'gif',
  opts: MotionExportOptions,
): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `motion-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const [width, height] = RESOLUTION[opts.resolution];
  const screenshotPaths: string[] = [];

  // 1. Screenshot each page with Playwright
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width, height });

  try {
    for (let i = 0; i < pages.length; i++) {
      const htmlPage = pages[i]!;
      await page.setContent(htmlPage.html, { waitUntil: 'networkidle', timeout: 15_000 });
      const screenshotPath = path.join(tmpDir, `page_${String(i).padStart(3, '0')}.png`);
      await page.screenshot({ path: screenshotPath, type: 'png', fullPage: false });
      screenshotPaths.push(screenshotPath);
    }
  } finally {
    await browser.close();
  }

  // 2. Stitch with FFmpeg
  const outDir = '/app/exports';
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${jobId}.mp4`);

  await stitchWithFfmpeg(screenshotPaths, outPath, opts);

  // 3. Convert to GIF if needed
  if (format === 'gif') {
    const gifPath = path.join(outDir, `${jobId}.gif`);
    await execFileAsync('ffmpeg', [
      '-i', outPath,
      '-vf', `fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      '-loop', '0',
      gifPath,
    ]);
    fs.unlinkSync(outPath);
    return gifPath;
  }

  return outPath;
}

async function stitchWithFfmpeg(
  screenshotPaths: string[],
  outPath: string,
  opts: MotionExportOptions,
): Promise<void> {
  const { durationPerPage, transitionDuration, fps, transition } = opts;
  const n = screenshotPaths.length;

  if (n === 1) {
    // Single page: just encode as static video
    await execFileAsync('ffmpeg', [
      '-loop', '1', '-t', String(durationPerPage), '-i', screenshotPaths[0]!,
      '-vcodec', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps), '-y', outPath,
    ]);
    return;
  }

  // Multiple pages: xfade chain
  // Each page is displayed for durationPerPage, with transitionDuration overlap at boundaries.
  // Effective duration per page input = durationPerPage + transitionDuration (except last page)
  const args: string[] = [];

  for (let i = 0; i < n; i++) {
    const t = i < n - 1 ? durationPerPage + transitionDuration : durationPerPage;
    args.push('-loop', '1', '-t', String(t), '-i', screenshotPaths[i]!);
  }

  // Build xfade filter chain
  let filterComplex = '';
  let lastLabel = '[0]';
  for (let i = 1; i < n; i++) {
    const offset = i * durationPerPage - (i - 1) * transitionDuration;
    const outLabel = i < n - 1 ? `[v${i}]` : '[v]';
    filterComplex += `${lastLabel}[${i}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}${outLabel};`;
    lastLabel = `[v${i}]`;
  }
  // Remove trailing semicolon from last segment
  filterComplex = filterComplex.replace(/;$/, '');

  args.push(
    '-filter_complex', filterComplex,
    '-map', '[v]',
    '-vcodec', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps), '-y',
    outPath,
  );

  await execFileAsync('ffmpeg', args, { maxBuffer: 50 * 1024 * 1024 });
}
```

---

## 4. API Worker & Route

### Modify `apps/api/src/worker.ts`

- Extend `ExportJobData.format` type: `'html' | 'pdf' | 'pptx' | 'mp4' | 'gif'`
- Add `motionOptions?: MotionExportOptions` field to `ExportJobData`
- Add branch in worker handler:
  ```typescript
  import { runMotionExport } from './lib/export-motion.js';
  // ...
  } else if (format === 'mp4' || format === 'gif') {
    const opts = job.data.motionOptions ?? {};
    const parsed = MotionExportOptions.parse(opts);
    filePath = await runMotionExport(jobId, pages, format, parsed);
  }
  ```

### Modify `apps/api/src/routes/exports.ts`

- Extend content-type mapping:
  ```typescript
  ext === 'mp4' ? 'video/mp4' :
  ext === 'gif' ? 'image/gif' :
  ```
- Pass `motionOptions` from request body to BullMQ job data:
  ```typescript
  await exportQueue.add('export', {
    jobId: job!.id,
    projectId,
    format,
    pages,
    motionOptions: parsed.data.motionOptions,
  });
  ```

### Modify `docker/Dockerfile.api`

Add `ffmpeg` to the apt-get install list in the runner stage:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 \
    libasound2 libxshmfence1 libxrandr2 libpangocairo-1.0-0 \
    libcairo2 libpango-1.0-0 libatspi2.0-0 \
    ca-certificates fonts-liberation wget \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*
```

**Dev note:** On the dev machine, `ffmpeg` must be in PATH. Install via: `winget install Gyan.FFmpeg` (Windows) or `brew install ffmpeg` (macOS).

---

## 5. Frontend

### Create `apps/web/src/components/export/MotionExportDialog.tsx`

Dialog shown when user clicks "Export → Motion":

```
┌─ Export as Motion ────────────────────────────┐
│  Format:    [MP4 ●] [GIF]                     │
│  Duration per page:  [3] seconds              │
│  Transition:  [Fade ▼]  (fade/slide/wipe)     │
│  Resolution:  [720p ▼]  (720p/1080p)          │
│  Transition duration: [0.5] seconds           │
│                                               │
│  ℹ 3 pages × 3s = ~9s video                  │
│                                               │
│       [Cancel]  [Export Motion →]             │
└───────────────────────────────────────────────┘
```

Props: `{ open, onClose, onExport(format, opts) }`.

State: local controlled fields matching `MotionExportOptions` + `format: 'mp4' | 'gif'`.

### Modify `apps/web/src/lib/export/useExport.ts`

Add `exportMotion(format: 'mp4' | 'gif', opts: MotionExportOptions)` alongside existing `exportPdf` / `exportPptx`. Uses the same polling pattern (POST → poll /exports/:id every 2s → download on 'done').

### Modify `apps/web/src/components/workspace/WorkspaceLayout.tsx`

Add Motion button to the export toolbar (next to PDF / PPTX buttons):

```tsx
<Button size="sm" variant="outline" onClick={() => setMotionDialogOpen(true)}>
  Motion
</Button>
<MotionExportDialog
  open={motionDialogOpen}
  onClose={() => setMotionDialogOpen(false)}
  onExport={(fmt, opts) => { setMotionDialogOpen(false); exportMotion(fmt, opts); }}
/>
```

---

## 6. File Map

| Action | File |
|--------|------|
| Modify | `packages/shared/src/exports.ts` |
| Modify | `packages/shared/src/index.ts` |
| Create | `apps/api/src/lib/export-motion.ts` |
| Modify | `apps/api/src/worker.ts` |
| Modify | `apps/api/src/routes/exports.ts` |
| Modify | `docker/Dockerfile.api` |
| Modify | `apps/web/src/lib/export/useExport.ts` |
| Create | `apps/web/src/components/export/MotionExportDialog.tsx` |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx` |

**Total: 7 modifications + 2 new files = 9 files. Deliberately tight scope.**

---

## 7. Error Handling

- FFmpeg not in PATH → worker catches `ENOENT`, marks job `failed` with `errorMsg: 'ffmpeg not found — install ffmpeg on the server'`
- Single-page project → static 3s video (no xfade needed), works fine
- Page HTML large → already handled: implementation uses `page.setContent()` directly (no `data:` URL size limits)

---

## 8. Dev Setup Requirement

```bash
# Windows (dev machine) — run once
winget install Gyan.FFmpeg

# Verify
ffmpeg -version
```

Docker image automatically includes FFmpeg via Dockerfile change.
