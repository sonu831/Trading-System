import React from 'react';
import PropTypes from 'prop-types';

/**
 * Input Component
 * A reusable form input component with label, error, and helper text support
 */
export default function Input({
  type = 'text',
  label,
  error,
  helperText,
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  ...props
}) {
  const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = Boolean(error);

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-tertiary">
          {label}
          {required && <span className="text-error ml-1">*</span>}
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
        className={`px-3.5 py-2.5 border border-border rounded-lg bg-input text-text-primary text-sm font-inherit transition-all focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-text-tertiary/50 ${hasError ? 'border-error focus:border-error focus:ring-error/10' : ''} dark:[color-scheme:dark]`}
        {...props}
      />

      {error && <p className="text-xs text-error mt-0">{error}</p>}
      {!error && helperText && <p className="text-xs text-text-tertiary mt-0">{helperText}</p>}
    </div>
  );
}

Input.propTypes = {
  type: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.string,
  helperText: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  className: PropTypes.string,
};
