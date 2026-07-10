import React from 'react';
import PropTypes from 'prop-types';

export default function Card({
  variant = 'default',
  padding = 'md',
  hoverable = false,
  children,
  className = '',
  ...props
}) {
  const variantClasses = {
    default: 'bg-surface border border-border',
    glass: 'bg-surface/70 backdrop-blur-md border border-white/10',
    outlined: 'bg-transparent border-2 border-border',
  };
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
  };

  const classes = [
    'rounded-xl transition-all duration-300',
    variantClasses[variant] || variantClasses.default,
    paddingClasses[padding] || paddingClasses.md,
    hoverable && 'cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-primary',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`text-lg font-semibold text-text-primary mb-4 pb-3 border-b border-border ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '', ...props }) {
  return (
    <div className={`text-text-secondary ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={`mt-4 pt-3 border-t border-border flex gap-3 items-center ${className}`} {...props}>
      {children}
    </div>
  );
}

Card.propTypes = {
  variant: PropTypes.oneOf(['default', 'glass', 'outlined']),
  padding: PropTypes.oneOf(['none', 'sm', 'md', 'lg']),
  hoverable: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};
CardHeader.propTypes = { children: PropTypes.node.isRequired, className: PropTypes.string };
CardBody.propTypes = { children: PropTypes.node.isRequired, className: PropTypes.string };
CardFooter.propTypes = { children: PropTypes.node.isRequired, className: PropTypes.string };

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
