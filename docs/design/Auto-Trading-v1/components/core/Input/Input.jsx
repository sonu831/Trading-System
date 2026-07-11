import React from 'react';

/** Input — labeled text field with error/helper text support. */
export function Input({
  type = 'text',
  label,
  error,
  helperText,
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
  id,
  style,
  ...props
}) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', fontFamily: 'var(--font-sans)' }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-tertiary)' }}>
          {label}
          {required && <span style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span>}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        style={{
          padding: '10px 14px',
          border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'inherit',
          opacity: disabled ? 0.5 : 1,
          outline: 'none',
          ...style,
        }}
        {...props}
      />
      {error && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', margin: 0 }}>{error}</p>}
      {!error && helperText && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{helperText}</p>}
    </div>
  );
}
