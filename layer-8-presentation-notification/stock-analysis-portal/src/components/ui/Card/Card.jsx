import React from 'react';
import PropTypes from 'prop-types';

/**
 * Card Component
 * A flexible container component with optional header, body, and footer sections
 * Enforces "Glassmorphism" by default.
 */
export default function Card({
  variant = 'glass',
  padding = 'md',
  hoverable = false,
  children,
  className = '',
  ...props
}) {
  const baseClasses = 'rounded-xl transition-all duration-300';
  
  const variantClasses = {
    default: 'bg-slate-900 border border-white/10 shadow-xl',
    glass: 'backdrop-blur-md bg-white/5 border border-white/10 shadow-2xl',
    outlined: 'bg-transparent border-2 border-slate-700',
    flat: 'bg-slate-800 border-none',
  };

  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const hoverClasses = hoverable 
    ? 'hover:-translate-y-1 hover:shadow-indigo-500/10 hover:border-indigo-500/30 cursor-pointer' 
    : '';

  const classes = [
    baseClasses,
    variantClasses[variant] || variantClasses.glass,
    paddingClasses[padding],
    hoverClasses,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

/**
 * Card Header Component
 */
export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`text-lg font-semibold text-slate-100 mb-4 pb-3 border-b border-white/5 ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * Card Body Component
 */
export function CardBody({ children, className = '', ...props }) {
  return (
    <div className={`text-slate-300 ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * Card Footer Component
 */
export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={`mt-4 pt-4 border-t border-white/5 flex items-center gap-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

Card.propTypes = {
  variant: PropTypes.oneOf(['default', 'glass', 'outlined', 'flat']),
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
