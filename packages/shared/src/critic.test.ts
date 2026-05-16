import { describe, it, expect } from 'vitest';
import { Severity, CriticIssue, CriticReport } from './critic.js';

describe('critic schemas', () => {
  it('parses a valid issue with defaults', () => {
    const issue = CriticIssue.parse({
      id: 'i1',
      severity: 'warning',
      category: 'a11y',
      message: 'Image missing alt text',
      createdAt: new Date().toISOString(),
    });
    expect(issue.status).toBe('open');
    expect(issue.elementId).toBeUndefined();
  });

  it('rejects invalid severity', () => {
    expect(() =>
      CriticIssue.parse({
        id: 'i1',
        severity: 'panic',
        category: 'a11y',
        message: 'x',
        createdAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it('parses a report with multiple issues', () => {
    const report = CriticReport.parse({
      id: 'r1',
      pagePath: '/',
      triggeredBy: 'write_page',
      issues: [
        {
          id: 'i1',
          severity: 'critical',
          category: 'a11y',
          message: 'No alt',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    });
    expect(report.issues).toHaveLength(1);
  });

  it('Severity enum accepts critical/warning/info', () => {
    expect(Severity.parse('critical')).toBe('critical');
    expect(Severity.parse('warning')).toBe('warning');
    expect(Severity.parse('info')).toBe('info');
  });
});
