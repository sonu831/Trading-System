import { ReactNode, HTMLAttributes } from 'react';

export type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

/**
 * @startingPoint section="Components" subtitle="Status pill, 5 semantic variants" viewport="700x140"
 */
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;
