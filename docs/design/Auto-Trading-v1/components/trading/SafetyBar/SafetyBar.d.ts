import { ReactNode } from 'react';

/**
 * @startingPoint section="Components" subtitle="Sticky underlying/spot/mode/kill bar" viewport="700x100"
 */
export interface SafetyBarProps {
  underlying?: string;
  spot?: number;
  tradeModeBadge?: ReactNode;
  staleBadge?: ReactNode;
  killSwitchButton?: ReactNode;
  className?: string;
}

export function SafetyBar(props: SafetyBarProps): JSX.Element;
