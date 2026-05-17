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
