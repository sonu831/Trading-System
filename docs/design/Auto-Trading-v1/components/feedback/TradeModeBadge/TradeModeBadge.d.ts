/**
 * @startingPoint section="Components" subtitle="Paper / Shadow / Live execution-mode flag" viewport="700x120"
 */
export interface TradeModeBadgeProps {
  mode?: 'paper' | 'shadow' | 'live';
  className?: string;
}

export function TradeModeBadge(props: TradeModeBadgeProps): JSX.Element;
