import { describe, it, expect } from 'vitest';
import { normalizeIssue } from './critic-dispatch.js';

describe('normalizeIssue', () => {
  it('fills id, status, createdAt when missing', () => {
    const issue = normalizeIssue({
      severity: 'warning',
      category: 'a11y',
      message: 'No alt',
    });
    expect(issue.id.length).toBeGreaterThan(3);
    expect(issue.status).toBe('open');
    expect(issue.createdAt).toBeTruthy();
    expect(issue.severity).toBe('warning');
  });

  it('preserves elementId and suggestion', () => {
    const issue = normalizeIssue({
      severity: 'critical',
      category: 'intent',
      message: 'CTA below fold',
      elementId: 'abc12345',
      suggestion: 'Move CTA above features section',
    });
    expect(issue.elementId).toBe('abc12345');
    expect(issue.suggestion).toBe('Move CTA above features section');
  });

  it('clamps invalid severity to warning', () => {
    const issue = normalizeIssue({
      severity: 'panic',
      category: 'a11y',
      message: 'x',
    });
    expect(issue.severity).toBe('warning');
  });

  it('clamps invalid category to craft', () => {
    const issue = normalizeIssue({
      severity: 'info',
      category: 'whatever',
      message: 'x',
    });
    expect(issue.category).toBe('craft');
  });

  it('fills empty message with placeholder', () => {
    const issue = normalizeIssue({
      severity: 'warning',
      category: 'craft',
      message: '   ',
    });
    expect(issue.message).toBe('unspecified issue');
  });
});
