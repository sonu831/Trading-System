import React from 'react';
import PropTypes from 'prop-types';

/**
 * Input Component
 * A reusable form input component with label, error, and helper text support.
 * Styled with Tailwind CSS for dark mode (Slate-900).
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
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
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
        className={`
          w-full px-4 py-2.5 rounded-lg text-sm transition-all duration-200
          bg-slate-900/50 border border-white/10 text-slate-200 placeholder:text-slate-600
          focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
          disabled:opacity-50 disabled:cursor-not-allowed
          ${hasError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/50 text-rose-300' : ''}
        `}
        {...props}
      />

      {error && (
        <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
          <span>⚠️</span> {error}
        </p>
      )}
      {!error && helperText && <p className="text-xs text-slate-500 mt-1 ml-1">{helperText}</p>}
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
