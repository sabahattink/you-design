import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { injectTailwind } from './html-inject.js';

const _require = createRequire(import.meta.url);

// pptxgenjs ships CJS; under NodeNext ESM we must require() it to get the
// constructor. The UMD type declaration (`export as namespace`) confuses
// `typeof PptxGenJS`, so we cast through unknown to the concrete class type.
type PptxGenCtor = new () => import('pptxgenjs').default;
const PptxGen = _require('pptxgenjs') as PptxGenCtor;

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
      await bPage.setContent(injectTailwind(pg.html), {
        waitUntil: 'networkidle',
        timeout: 30_000,
      });
      const buf = await bPage.screenshot({ fullPage: false, type: 'png' });
      screenshots.push(buf);
      await bPage.close();
    }
  } finally {
    await browser.close();
  }

  const prs = new PptxGen();
  prs.defineLayout({ name: 'LAYOUT_WIDE', width: 10, height: 7.5 });
  prs.layout = 'LAYOUT_WIDE';

  for (const shot of screenshots) {
    const slide = prs.addSlide();
    slide.addImage({
      data: `data:image/png;base64,${shot.toString('base64')}`,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });
  }

  const outDir = path.resolve(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${jobId}.pptx`);
  await prs.writeFile({ fileName: outPath });
  return outPath;
}
