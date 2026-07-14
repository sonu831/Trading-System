import React from 'react';

const sizeStyles = {
  sm: { padding: '2px 8px', fontSize: '11px' },
  md: { padding: '4px 12px', fontSize: 'var(--text-xs)' },
  lg: { padding: '6px 16px', fontSize: 'var(--text-sm)' },
};

const variantStyles = {
  default: { background: 'var(--color-border)', color: 'var(--color-text-tertiary)' },
  success: { background: 'color-mix(in srgb, var(--color-success) 20%, transparent)', color: 'var(--color-success)' },
  error: { background: 'color-mix(in srgb, var(--color-error) 20%, transparent)', color: 'var(--color-error)' },
  warning: { background: 'color-mix(in srgb, var(--color-warning) 20%, transparent)', color: 'var(--color-warning)' },
  info: { background: 'color-mix(in srgb, var(--color-info) 20%, transparent)', color: 'var(--color-info)' },
};

/** Badge — small status/label pill. Variants: default, success, error, warning, info. */
export function Badge({ variant = 'default', size = 'md', children, style, ...props }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-xl)',
        fontWeight: 'var(--font-weight-semibold)',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-sans)',
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
