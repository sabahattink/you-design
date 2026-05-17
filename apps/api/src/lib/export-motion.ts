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
  if (!pages.length) throw new Error('At least one page required for motion export');

  const [width, height] = RESOLUTION[opts.resolution] ?? [1280, 720];
  const tmpDir = path.join(os.tmpdir(), `motion-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const screenshotPaths: string[] = [];
  // --no-sandbox required in containerized (non-root) environments
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

  try {
    const ffArgs = buildFfmpegArgs(screenshotPaths, mp4Path, opts);
    await execFileAsync('ffmpeg', ffArgs, { maxBuffer: 50 * 1024 * 1024 });
  } catch (err) {
    throw new Error(`FFmpeg MP4 encoding failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (format === 'gif') {
    const gifPath = path.join(outDir, `${jobId}.gif`);
    try {
      await execFileAsync('ffmpeg', [
        '-i', mp4Path,
        '-vf', 'fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        '-loop', '0',
        gifPath,
      ]);
    } catch (err) {
      throw new Error(`FFmpeg GIF conversion failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    fs.unlinkSync(mp4Path);
    return gifPath;
  }

  return mp4Path;
}
