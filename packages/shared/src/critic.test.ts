import { describe, it, expect } from 'vitest';
import { CriticReport, AgentType } from './critic';

const baseIssue = {
  id: 'i1', severity: 'warning' as const, category: 'copy' as const,
  message: 'test', status: 'open' as const, createdAt: new Date().toISOString(),
};

describe('CriticReport agentType', () => {
  it('defaults agentType to critic when omitted', () => {
    const report = CriticReport.parse({
      id: 'r1', pagePath: '/', triggeredBy: 'test',
      issues: [baseIssue], createdAt: new Date().toISOString(),
    });
    expect(report.agentType).toBe('critic');
  });

  it('accepts copywriter agentType', () => {
    const report = CriticReport.parse({
      id: 'r2', pagePath: '/', triggeredBy: 'test', agentType: 'copywriter',
      issues: [], createdAt: new Date().toISOString(),
    });
    expect(report.agentType).toBe('copywriter');
  });

  it('AgentType enum has 4 values', () => {
    const result = AgentType.safeParse('dev');
    expect(result.success).toBe(true);
  });
});
