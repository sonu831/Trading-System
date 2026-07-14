/**
 * @startingPoint section="Components" subtitle="Loss + trade-count risk envelope" viewport="700x260"
 */
export interface DailyRiskCardProps {
  dailyLoss?: number;
  maxDailyLoss?: number;
  tradesToday?: number;
  maxTrades?: number;
  halted?: boolean;
  className?: string;
}

export function DailyRiskCard(props: DailyRiskCardProps): JSX.Element;
