/**
 * @startingPoint section="Components" subtitle="One-click halt / resume w/ confirm" viewport="700x160"
 */
export interface KillSwitchButtonProps {
  active?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function KillSwitchButton(props: KillSwitchButtonProps): JSX.Element;
