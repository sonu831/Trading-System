import React from 'react';
import PropTypes from 'prop-types';

export default function Button({ variant = 'primary', size = 'md', disabled = false, loading = false, onClick, children, className = '', type = 'button', ...props }) {
  const sizeClasses = { sm: 'px-3 py-1.5 text-sm', md: 'px-5 py-2.5 text-base', lg: 'px-7 py-3.5 text-lg' };
  const variantClasses = {
    primary: 'bg-gradient-to-br from-primary to-accent text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/40',
    secondary: 'bg-surface hover:bg-surface-hover text-text-secondary border border-border hover:border-border',
    outline: 'bg-transparent text-primary border-2 border-primary hover:bg-primary/10',
    danger: 'bg-gradient-to-br from-error to-red-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-error/40',
    ghost: 'bg-transparent text-text-tertiary hover:bg-surface-hover hover:text-text-secondary',
  };

  const classes = `inline-flex items-center justify-center gap-2 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 font-[inherit] ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.primary} ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;

  return (
    <button type={type} className={classes} disabled={disabled || loading} onClick={onClick} {...props}>
      {loading && <span className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin" />}
      {children}
    </button>
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'danger', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool, loading: PropTypes.bool,
  onClick: PropTypes.func, children: PropTypes.node.isRequired,
  className: PropTypes.string, type: PropTypes.string,
};
