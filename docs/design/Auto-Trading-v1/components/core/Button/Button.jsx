import React from 'react';

const sizeStyles = {
  sm: { padding: '6px 12px', fontSize: 'var(--text-sm)' },
  md: { padding: '10px 20px', fontSize: 'var(--text-base)' },
  lg: { padding: '14px 28px', fontSize: 'var(--text-lg)' },
};

const variantStyles = {
  primary: {
    background: 'linear-gradient(to bottom right, var(--color-primary), var(--color-accent))',
    color: '#fff',
  },
  secondary: {
    background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--color-primary)',
    border: '2px solid var(--color-primary)',
  },
  danger: {
    background: 'linear-gradient(to bottom right, var(--color-error), #DC2626)',
    color: '#fff',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-tertiary)',
  },
};

/** Button — primary UI action. Variants: primary, secondary, outline, danger, ghost. Sizes: sm, md, lg. */
export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
  type = 'button',
  style,
  ...props
}) {
  const busy = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        cursor: busy ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--font-weight-medium)',
        transition: `all var(--duration-base) var(--ease-standard)`,
        opacity: busy ? 0.5 : 1,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {loading && (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'currentColor',
            animation: 'auto-trading-spin 0.7s linear infinite',
          }}
        />
      )}
      {children}
      <style>{`@keyframes auto-trading-spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
