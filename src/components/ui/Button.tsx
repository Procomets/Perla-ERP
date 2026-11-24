import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  loadingText,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer border text-xs sm:text-sm';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs sm:text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm sm:text-base gap-2.5'
  };

  const variantClasses = {
    primary: 'bg-[#0F172A] hover:bg-[#1E293B] text-white border-transparent focus:ring-[#0F172A] shadow-2xs',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 focus:ring-slate-300 shadow-2xs',
    outline: 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 focus:ring-slate-300',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 border-transparent',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white border-transparent focus:ring-rose-500 shadow-2xs',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent focus:ring-emerald-500 shadow-2xs'
  };

  const isDisabled = disabled || loading;
  const loadingClasses = loading ? 'opacity-80 cursor-not-allowed pointer-events-none' : '';

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${loadingClasses} ${className}`}
      disabled={isDisabled}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {loading && loadingText ? loadingText : children}
    </button>
  );
};
