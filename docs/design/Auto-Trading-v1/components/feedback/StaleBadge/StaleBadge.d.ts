/**
 * @startingPoint section="Components" subtitle="Data-freshness indicator (fresh/warn/stale)" viewport="700x120"
 */
export interface StaleBadgeProps {
  timestamp?: string;
  warnAfter?: number;
  staleAfter?: number;
  label?: string;
  className?: string;
}

export function StaleBadge(props: StaleBadgeProps): JSX.Element;
