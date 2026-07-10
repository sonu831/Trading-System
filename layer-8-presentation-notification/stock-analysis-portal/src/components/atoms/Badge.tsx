import React from 'react';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ variant = 'default', size = 'md', children, className = '', ...props }: BadgeProps) {
  const sizeClasses: Record<BadgeSize, string> = { sm: 'px-2 py-0.5 text-[11px]', md: 'px-3 py-1 text-xs', lg: 'px-4 py-1.5 text-sm' };
  const variantClasses: Record<BadgeVariant, string> = {
    default: 'bg-border text-text-tertiary',
    success: 'bg-success/20 text-success',
    error: 'bg-error/20 text-error',
    warning: 'bg-warning/20 text-warning',
    info: 'bg-info/20 text-info',
  };
  const classes = `inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;
  return <span className={classes} {...props}>{children}</span>;
}
