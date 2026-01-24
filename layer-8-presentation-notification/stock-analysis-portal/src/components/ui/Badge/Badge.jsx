import React from 'react';
import PropTypes from 'prop-types';

/**
 * Badge Component
 * A small status indicator or label
 */
export default function Badge({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  ...props
}) {
  const baseClasses = 'badge';
  const variantClasses = {
    default: 'badge-default',
    success: 'badge-success',
    error: 'badge-error',
    warning: 'badge-warning',
    info: 'badge-info',
  };
  const sizeClasses = {
    sm: 'badge-sm',
    md: 'badge-md',
    lg: 'badge-lg',
  };

  const classes = [baseClasses, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <span className={classes} {...props}>
        {children}
      </span>

      <style jsx>{`
        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        /* Sizes */
        .badge-sm {
          padding: 2px 8px;
          font-size: 11px;
        }
        .badge-md {
          padding: 4px 12px;
          font-size: 12px;
        }
        .badge-lg {
          padding: 6px 16px;
          font-size: 14px;
        }

        /* Variants */
        .badge-default {
          background: #2a2a3e;
          color: #aaa;
        }

        .badge-success {
          background: #10b981;
          color: white;
        }

        .badge-error {
          background: #ef4444;
          color: white;
        }

        .badge-warning {
          background: #f59e0b;
          color: white;
        }

        .badge-info {
          background: #3b82f6;
          color: white;
        }
      `}</style>
    </>
  );
}

Badge.propTypes = {
  variant: PropTypes.oneOf(['default', 'success', 'error', 'warning', 'info']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};
