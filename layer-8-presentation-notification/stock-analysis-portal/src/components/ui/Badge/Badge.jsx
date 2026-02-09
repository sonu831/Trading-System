import React from 'react';
import PropTypes from 'prop-types';

/**
 * Badge Component
 * A small status indicator or label.
 * Uses background opacity pattern for a modern look.
 */
export default function Badge({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-bold whitespace-nowrap rounded-full transition-colors';
  
  const variantClasses = {
    default: 'bg-slate-700/50 text-slate-300 border border-slate-600',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    error: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    info: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  const classes = [
    baseClasses, 
    variantClasses[variant], 
    sizeClasses[size], 
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}

Badge.propTypes = {
  variant: PropTypes.oneOf(['default', 'success', 'error', 'warning', 'info']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};
