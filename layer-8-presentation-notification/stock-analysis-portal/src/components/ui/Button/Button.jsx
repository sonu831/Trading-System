import React from 'react';
import PropTypes from 'prop-types';

/**
 * Button Component
 * A reusable button component with multiple variants and sizes
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
  type = 'button',
  ...props
}) {
  const baseClasses = 'btn';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  };
  const sizeClasses = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabled && 'btn-disabled',
    loading && 'btn-loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <button
        type={type}
        className={classes}
        disabled={disabled || loading}
        onClick={onClick}
        {...props}
      >
        {loading ? (
          <>
            <span className="btn-spinner" />
            {children}
          </>
        ) : (
          children
        )}
      </button>

      <style jsx>{`
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          font-family: inherit;
        }

        /* Sizes */
        .btn-sm {
          padding: 6px 12px;
          font-size: 14px;
        }
        .btn-md {
          padding: 10px 20px;
          font-size: 16px;
        }
        .btn-lg {
          padding: 14px 28px;
          font-size: 18px;
        }

        /* Variants */
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: #16213e;
          color: #ddd;
          border: 1px solid #333;
        }
        .btn-secondary:hover:not(:disabled) {
          background: #1e2a47;
          border-color: #444;
        }

        .btn-outline {
          background: transparent;
          color: #667eea;
          border: 2px solid #667eea;
        }
        .btn-outline:hover:not(:disabled) {
          background: rgba(102, 126, 234, 0.1);
        }

        .btn-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }
        .btn-danger:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }

        .btn-ghost {
          background: transparent;
          color: #aaa;
        }
        .btn-ghost:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: #ddd;
        }

        /* States */
        .btn-disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-loading {
          position: relative;
          color: transparent;
        }

        .btn-spinner {
          position: absolute;
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'danger', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  type: PropTypes.string,
};
