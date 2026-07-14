/**
 * @startingPoint section="Components" subtitle="CALLS · STRIKE · PUTS ladder" viewport="700x320"
 */
export interface OptionChainRow {
  strike: number;
  ce?: { ltp: number; bid: number; ask: number; oi: number };
  pe?: { ltp: number; bid: number; ask: number; oi: number };
}

export interface OptionChainGridProps {
  rows: OptionChainRow[];
  spot?: number;
  atm?: number;
  expiry?: string;
  className?: string;
}

export function OptionChainGrid(props: OptionChainGridProps): JSX.Element;
