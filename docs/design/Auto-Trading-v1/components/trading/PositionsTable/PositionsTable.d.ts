/**
 * @startingPoint section="Components" subtitle="Open-position book, loud missing-stop state" viewport="700x260"
 */
export interface Position {
  id: string;
  symbol: string;
  optionType?: 'CE' | 'PE';
  lots: number;
  currentPrice: number;
  stopLoss?: number;
  pnl: number;
}

export interface PositionsTableProps {
  positions: Position[];
  className?: string;
}

export function PositionsTable(props: PositionsTableProps): JSX.Element;
