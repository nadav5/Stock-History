import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'default',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-emerald-600/15 text-emerald-400 border-emerald-500/30',
    secondary: 'bg-slate-800 text-slate-300 border-slate-700',
    destructive: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    outline: 'text-slate-300 border-slate-700 hover:bg-slate-800/50',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    info: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
