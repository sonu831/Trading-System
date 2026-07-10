// @ts-nocheck
import React from 'react';

type CardVariant = 'default' | 'glass' | 'outlined';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  hoverable?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function Card({ variant = 'default', padding = 'md', hoverable = false, children, className = '', ...props }: CardProps) {
  const vc: Record<CardVariant, string> = { default: 'bg-surface border border-border', glass: 'bg-surface/70 backdrop-blur-md border border-white/10', outlined: 'bg-transparent border-2 border-border' };
  const pc: Record<CardPadding, string> = { none: 'p-0', sm: 'p-3', md: 'p-5', lg: 'p-7' };
  const cls = `rounded-xl transition-all duration-300 ${vc[variant]} ${pc[padding]} ${hoverable ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-primary' : ''} ${className}`;
  return <div className={cls} {...props}>{children}</div>;
}

export function CardHeader({ children, className = '', ...props }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-lg font-semibold text-text-primary mb-4 pb-3 border-b border-border ${className}`} {...props}>{children}</div>;
}

export function CardBody({ children, className = '', ...props }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-text-secondary ${className}`} {...props}>{children}</div>;
}

export function CardFooter({ children, className = '', ...props }: { children: React.ReactNode; className?: string }) {
  return <div className={`mt-4 pt-3 border-t border-border flex gap-3 items-center ${className}`} {...props}>{children}</div>;
}
