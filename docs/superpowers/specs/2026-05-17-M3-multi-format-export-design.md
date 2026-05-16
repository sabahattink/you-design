# M3 — Multi-Format Export Design

**Goal:** Export any project to HTML, PDF, or PPTX with one click. HTML is instant; PDF and PPTX are async BullMQ jobs processed by a Playwright-enabled API worker.

**Scope:** Three formats — HTML (client-side), PDF (Playwright headless → pdf-lib merge), PPTX (Playwright screenshot → pptxgenjs slides). Export status shown via polling. No motion/iOS export yet (M6+).

---

## 1. Export Flow

```
User clicks Export → ExportDialog opens → selects format

HTML  → assemble pages from store → blob download (no API)
PDF   → POST /api/v1/exports → jobId → poll every 2s → auto-download when done
PPTX  → POST /api/v1/exports → jobId → poll every 2s → auto-download when done
```

**PDF approach:** Playwright renders each project page (`page.setContent(injectedHtml)`), calls `page.pdf({ format: 'A4', printBackground: true })`, resulting buffers merged with `pdf-lib` into one document (one PDF page per project page).

**PPTX approach:** Screenshot-based — Playwright takes a full-page PNG screenshot of each project page. `pptxgenjs` creates one slide per screenshot at 10" × 7.5" with the PNG as a full-bleed background image. Output is visually faithful but not text-editable (text parsing deferred to M4+).

**HTML approach:** Client-side only — inject Tailwind CDN into each page's HTML, wrap in a minimal `<!DOCTYPE html>` shell, combine all pages with anchor links, download as a single `.html` file via `<a download>`.

---

## 2. Data Model

### New table: `export_jobs` (`packages/db/src/schema/export-jobs.ts`)

```typescript
export const exportJobs = pgTable('export_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  format: text('format').notNull(),          // 'html' | 'pdf' | 'pptx'
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'done' | 'failed'
  filePath: text('file_path'),               // absolute path on server when done
  errorMsg: text('error_msg'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Drizzle migration: `drizzle-kit generate` → `0002_export_jobs.sql`

### New shared types (`packages/shared/src/exports.ts`)

```typescript
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

Export from `packages/shared/src/index.ts`.

---

## 3. API Endpoints (`apps/api/src/routes/exports.ts`)

```
POST /api/v1/exports
  Body: { projectId: string; format: 'html' | 'pdf' | 'pptx' }
  Action: fetch project pages from DB, insert export_job row (status: pending),
          enqueue BullMQ job with { jobId, projectId, format, pages }
  Response: { jobId: string }

GET  /api/v1/exports/:jobId
  Response: { id, format, status, errorMsg }

GET  /api/v1/exports/:jobId/download
  Condition: status must be 'done', filePath must exist
  Response: file stream with Content-Disposition: attachment; filename=<name>.<ext>
  Error: 404 if not found, 409 if not ready
```

Server registration: `await app.register(exportsRoutes, { prefix: '/api/v1' })`.

---

## 4. BullMQ Export Worker (`apps/api/src/worker.ts`)

The existing `export-queue` handler is currently a stub. Replace with real logic.

### Job payload shape

```typescript
interface ExportJob {
  jobId: string;
  projectId: string;
  format: 'html' | 'pdf' | 'pptx';
  pages: Array<{ path: string; title: string; html: string }>;
}
```

### Worker logic

```
On job received:
  1. Update export_job.status = 'processing'
  2. Switch on format:
     PDF  → runPdfExport(jobId, pages)
     PPTX → runPptxExport(jobId, pages)
  3. Update export_job.status = 'done', filePath = result
  4. On error: update status = 'failed', errorMsg = err.message
```

### HTML injection helper (shared between PDF + PPTX)

```typescript
function injectTailwind(html: string): string {
  const cdnScript = '<script src="https://cdn.tailwindcss.com"></script>';
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${cdnScript}`);
  }
  return `<!DOCTYPE html><html><head>${cdnScript}</head><body>${html}</body></html>`;
}
```

### PDF export (`apps/api/src/lib/export-pdf.ts`)

```typescript
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

export async function runPdfExport(jobId: string, pages: Page[]): Promise<string> {
  const browser = await chromium.launch();
  const pdfBuffers: Buffer[] = [];

  for (const page of pages) {
    const bPage = await browser.newPage();
    await bPage.setContent(injectTailwind(page.html), { waitUntil: 'networkidle' });
    const buf = await bPage.pdf({ format: 'A4', printBackground: true });
    pdfBuffers.push(Buffer.from(buf));
    await bPage.close();
  }
  await browser.close();

  const merged = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const src = await PDFDocument.load(buf);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }

  const outDir = 'exports';
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${jobId}.pdf`);
  fs.writeFileSync(outPath, await merged.save());
  return outPath;
}
```

### PPTX export (`apps/api/src/lib/export-pptx.ts`)

```typescript
import { chromium } from 'playwright';
import pptxgen from 'pptxgenjs';

export async function runPptxExport(jobId: string, pages: Page[]): Promise<string> {
  const browser = await chromium.launch();
  const prs = new pptxgen();
  prs.defineLayout({ name: 'LAYOUT_WIDE', width: 10, height: 7.5 });
  prs.layout = 'LAYOUT_WIDE';

  for (const page of pages) {
    const bPage = await browser.newPage();
    await bPage.setViewportSize({ width: 1280, height: 960 });
    await bPage.setContent(injectTailwind(page.html), { waitUntil: 'networkidle' });
    const screenshot = await bPage.screenshot({ fullPage: false, type: 'png' });
    await bPage.close();

    const slide = prs.addSlide();
    slide.addImage({
      data: `data:image/png;base64,${screenshot.toString('base64')}`,
      x: 0, y: 0, w: '100%', h: '100%',
    });
  }

  await browser.close();

  const outDir = 'exports';
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${jobId}.pptx`);
  await prs.writeFile({ fileName: outPath });
  return outPath;
}
```

---

## 5. Docker Changes

### `apps/api/Dockerfile` additions

After the base Node image and before `COPY`, add:

```dockerfile
RUN npx playwright install chromium --with-deps
```

This installs the Chromium binary and all OS-level dependencies (~500MB). Only needed in the API image.

### `compose.dev.yml`

No changes needed — the API container already exists. The `exports/` directory is created at runtime inside the container. For persistence across restarts, optionally mount a volume:

```yaml
api:
  volumes:
    - ./exports:/app/exports
```

---

## 6. Web UI

### Export button (`apps/web/src/components/workspace/WorkspaceLayout.tsx`)

Add an "Export" button to the header:
```tsx
<button onClick={() => setExportOpen(true)} className="...">
  Export
</button>
```

### ExportDialog (`apps/web/src/components/export/ExportDialog.tsx`)

```
┌─────────────────────────────┐
│  Export Project             │
│                             │
│  [HTML]  [PDF]  [PPTX]     │  ← format selector cards
│                             │
│  [Export ▼]                 │
│                             │
│  ⟳ Preparing PDF...  42%   │  ← shown while polling
│  ✓ Ready — downloading...  │  ← triggers auto-download
└─────────────────────────────┘
```

**HTML export logic (client-side):**
```typescript
function exportHtml(pages: Page[]): void {
  const combined = pages.map((p) => `<!-- ${p.path} -->\n${p.html}`).join('\n\n');
  const blob = new Blob([combined], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'export.html'; a.click();
  URL.revokeObjectURL(url);
}
```

**PDF/PPTX export logic:**
1. `POST /api/v1/exports` with `{ projectId, format, pages }`
2. Receive `{ jobId }`
3. Poll `GET /api/v1/exports/:jobId` every 2000ms
4. When `status === 'done'`: navigate to `GET /api/v1/exports/:jobId/download` (triggers browser download)
5. When `status === 'failed'`: show error message

### `useExport` hook (`apps/web/src/lib/export/useExport.ts`)

```typescript
export function useExport(): {
  startExport: (format: ExportFormat) => Promise<void>;
  status: 'idle' | 'pending' | 'processing' | 'done' | 'failed';
  error: string | null;
}
```

---

## 7. New Dependencies

| Package | Where | Purpose |
|---------|-------|---------|
| `playwright` | apps/api | Headless browser for PDF + PPTX screenshots |
| `pdf-lib` | apps/api | Merge PDF pages from multiple Playwright renders |
| `pptxgenjs` | apps/api | Generate PPTX slides from PNG screenshots |

---

## 8. Error Handling

| Failure | Behaviour |
|---------|-----------|
| Playwright launch fails | Job fails, errorMsg set, UI shows "Export failed" |
| Page render timeout (>30s) | Abort, fail job |
| Export file missing at download | 404 returned, UI shows error |
| Poll timeout (>5 min) | Stop polling, show "Export timed out" |

---

## 9. File Map

| Action | File |
|--------|------|
| Create | `packages/db/src/schema/export-jobs.ts` |
| Modify | `packages/db/src/schema/index.ts` |
| Create | `packages/db/migrations/0002_export_jobs.sql` |
| Create | `packages/shared/src/exports.ts` |
| Modify | `packages/shared/src/index.ts` |
| Create | `apps/api/src/routes/exports.ts` |
| Modify | `apps/api/src/server.ts` |
| Modify | `apps/api/src/worker.ts` |
| Create | `apps/api/src/lib/export-pdf.ts` |
| Create | `apps/api/src/lib/export-pptx.ts` |
| Modify | `apps/api/Dockerfile` (if exists) or create |
| Create | `apps/web/src/components/export/ExportDialog.tsx` |
| Create | `apps/web/src/lib/export/useExport.ts` |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx` |
