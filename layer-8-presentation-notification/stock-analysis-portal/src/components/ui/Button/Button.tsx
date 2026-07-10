// @ts-nocheck
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export default function Button({ variant = 'primary', size = 'md', disabled = false, loading = false, onClick, children, className = '', type = 'button', ...props }: ButtonProps) {
  const sizeClasses: Record<ButtonSize, string> = { sm: 'px-3 py-1.5 text-sm', md: 'px-5 py-2.5 text-base', lg: 'px-7 py-3.5 text-lg' };
  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-gradient-to-br from-primary to-accent text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/40',
    secondary: 'bg-surface hover:bg-surface-hover text-text-secondary border border-border',
    outline: 'bg-transparent text-primary border-2 border-primary hover:bg-primary/10',
    danger: 'bg-gradient-to-br from-error to-red-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-error/40',
    ghost: 'bg-transparent text-text-tertiary hover:bg-surface-hover hover:text-text-secondary',
  };
  const cls = `inline-flex items-center justify-center gap-2 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 ${sizeClasses[size]} ${variantClasses[variant]} ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;

  return (
    <button type={type} className={cls} disabled={disabled || loading} onClick={onClick} {...props}>
      {loading && <span className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin" />}
      {children}
    </button>
  );
}
