import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
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

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
