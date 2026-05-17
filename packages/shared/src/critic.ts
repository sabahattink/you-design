import { z } from 'zod';

export const Severity = z.enum(['critical', 'warning', 'info']);
export type Severity = z.infer<typeof Severity>;

export const IssueCategory = z.enum(['intent', 'a11y', 'domain', 'copy', 'craft']);
export type IssueCategory = z.infer<typeof IssueCategory>;

export const IssueStatus = z.enum(['open', 'fixed', 'dismissed']);
export type IssueStatus = z.infer<typeof IssueStatus>;

export const AgentType = z.enum(['critic', 'copywriter', 'a11y', 'dev']);
export type AgentType = z.infer<typeof AgentType>;

export const CriticIssue = z.object({
  id: z.string().min(1),
  severity: Severity,
  category: IssueCategory,
  message: z.string().min(1),
  elementId: z.string().optional(),
  suggestion: z.string().optional(),
  status: IssueStatus.default('open'),
  createdAt: z.string().datetime(),
});
export type CriticIssue = z.infer<typeof CriticIssue>;

export const CriticReport = z.object({
  id: z.string().min(1),
  pagePath: z.string(),
  triggeredBy: z.string(),
  agentType: AgentType.default('critic'),
  issues: z.array(CriticIssue),
  createdAt: z.string().datetime(),
});
export type CriticReport = z.infer<typeof CriticReport>;
