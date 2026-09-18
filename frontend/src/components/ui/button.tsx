import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20',
      destructive: 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20',
      outline: 'border border-slate-700 bg-transparent hover:bg-slate-800 text-slate-200',
      secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
      ghost: 'hover:bg-slate-800 text-slate-300 hover:text-white',
      link: 'text-emerald-400 underline-offset-4 hover:underline p-0 h-auto',
      success: 'bg-teal-600 hover:bg-teal-500 text-white',
    };

    const sizeStyles = {
      default: 'h-9 px-4 py-2 text-xs font-semibold rounded-lg',
      sm: 'h-8 px-3 text-xs rounded-md',
      lg: 'h-10 px-5 text-sm rounded-xl',
      icon: 'h-8 w-8 p-0 flex items-center justify-center rounded-lg',
    };

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 disabled:pointer-events-none disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
