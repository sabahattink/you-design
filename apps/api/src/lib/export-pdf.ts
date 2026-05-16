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
