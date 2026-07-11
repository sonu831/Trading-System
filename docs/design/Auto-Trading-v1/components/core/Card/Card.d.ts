import { ReactNode, HTMLAttributes } from 'react';

export type CardVariant = 'default' | 'glass' | 'outlined';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * @startingPoint section="Components" subtitle="Surface container, 3 variants" viewport="700x220"
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hoverable?: boolean;
  children: ReactNode;
}

export function Card(props: CardProps): JSX.Element;
export function CardHeader(props: { children: ReactNode; className?: string }): JSX.Element;
export function CardBody(props: { children: ReactNode; className?: string }): JSX.Element;
export function CardFooter(props: { children: ReactNode; className?: string }): JSX.Element;
