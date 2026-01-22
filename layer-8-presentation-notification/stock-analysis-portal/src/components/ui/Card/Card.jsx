import React from 'react';
import PropTypes from 'prop-types';

/**
 * Card Component
 * A flexible container component with optional header, body, and footer sections
 */
export default function Card({
  variant = 'default',
  padding = 'md',
  hoverable = false,
  children,
  className = '',
  ...props
}) {
  const baseClasses = 'card';
  const variantClasses = {
    default: 'card-default',
    glass: 'card-glass',
    outlined: 'card-outlined',
  };
  const paddingClasses = {
    none: 'card-padding-none',
    sm: 'card-padding-sm',
    md: 'card-padding-md',
    lg: 'card-padding-lg',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    paddingClasses[padding],
    hoverable && 'card-hoverable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className={classes} {...props}>
        {children}
      </div>

      <style jsx>{`
        .card {
          border-radius: 12px;
          transition: all 0.3s;
        }

        /* Padding */
        .card-padding-none {
          padding: 0;
        }
        .card-padding-sm {
          padding: 12px;
        }
        .card-padding-md {
          padding: 20px;
        }
        .card-padding-lg {
          padding: 28px;
        }

        /* Variants */
        .card-default {
          background: #1a1a2e;
          border: 1px solid #2a2a3e;
        }

        .card-glass {
          background: rgba(26, 26, 46, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .card-outlined {
          background: transparent;
          border: 2px solid #333;
        }

        /* Hoverable */
        .card-hoverable {
          cursor: pointer;
        }
        .card-hoverable:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          border-color: #667eea;
        }
      `}</style>
    </>
  );
}

/**
 * Card Header Component
 */
export function CardHeader({ children, className = '', ...props }) {
  return (
    <>
      <div className={`card-header ${className}`} {...props}>
        {children}
      </div>
      <style jsx>{`
        .card-header {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #2a2a3e;
        }
      `}</style>
    </>
  );
}

/**
 * Card Body Component
 */
export function CardBody({ children, className = '', ...props }) {
  return (
    <>
      <div className={`card-body ${className}`} {...props}>
        {children}
      </div>
      <style jsx>{`
        .card-body {
          color: #ddd;
        }
      `}</style>
    </>
  );
}

/**
 * Card Footer Component
 */
export function CardFooter({ children, className = '', ...props }) {
  return (
    <>
      <div className={`card-footer ${className}`} {...props}>
        {children}
      </div>
      <style jsx>{`
        .card-footer {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #2a2a3e;
          display: flex;
          gap: 12px;
          align-items: center;
        }
      `}</style>
    </>
  );
}

Card.propTypes = {
  variant: PropTypes.oneOf(['default', 'glass', 'outlined']),
  padding: PropTypes.oneOf(['none', 'sm', 'md', 'lg']),
  hoverable: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

CardHeader.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

CardBody.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

CardFooter.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
