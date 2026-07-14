import React from 'react';

const variantStyles = {
  default: { background: 'var(--color-surface)', border: '1px solid var(--color-border)' },
  glass: { background: 'color-mix(in srgb, var(--color-surface) 70%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' },
  outlined: { background: 'transparent', border: '2px solid var(--color-border)' },
};
const paddingStyles = { none: '0', sm: '12px', md: '20px', lg: '28px' };

/** Card — surface container. Variants: default, glass, outlined. */
export function Card({ variant = 'default', padding = 'md', hoverable = false, children, style, ...props }) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-xl)',
        transition: `all var(--duration-slow) var(--ease-standard)`,
        padding: paddingStyles[padding],
        cursor: hoverable ? 'pointer' : undefined,
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style, ...props }) {
  return (
    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--color-border)', ...style }} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, style, ...props }) {
  return <div style={{ color: 'var(--color-text-secondary)', ...style }} {...props}>{children}</div>;
}

export function CardFooter({ children, style, ...props }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 12, alignItems: 'center', ...style }} {...props}>
      {children}
    </div>
  );
}
