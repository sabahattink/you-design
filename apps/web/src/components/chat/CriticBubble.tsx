import * as React from 'react';

interface FreeFormProps {
  reason: string;
  issue?: undefined;
}
interface StructuredProps {
  issue: {
    severity: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
  };
  reason?: undefined;
}
type Props = FreeFormProps | StructuredProps;

const SEVERITY_COLOR: Record<'critical' | 'warning' | 'info', string> = {
  critical: 'border-red-500 text-red-500',
  warning: 'border-amber-500 text-amber-500',
  info: 'border-sky-500 text-sky-500',
};

export function CriticBubble(props: Props) {
  if (props.issue) {
    const cls = SEVERITY_COLOR[props.issue.severity];
    return (
      <div className={`border-l-2 pl-3 py-1 text-xs ${cls}`}>
        <span className="font-semibold uppercase tracking-wider mr-2">{props.issue.severity}</span>
        <span className="text-[color:var(--color-muted)]">[{props.issue.category}]</span>{' '}
        <span className="text-[color:var(--color-fg)]">{props.issue.message}</span>
      </div>
    );
  }
  return (
    <div className="border-l-2 border-orange-500 pl-3 py-1 text-xs text-[color:var(--color-muted)]">
      <span className="font-semibold text-orange-500 uppercase tracking-wider mr-2">Critic</span>
      {props.reason}
    </div>
  );
}
