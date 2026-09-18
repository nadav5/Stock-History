import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Card: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div
    className={`rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md shadow-sm text-slate-100 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div className={`flex flex-col space-y-1.5 p-5 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`text-base font-bold leading-none tracking-tight text-white ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p className={`text-xs text-slate-400 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div className={`p-5 pt-0 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div className={`flex items-center p-5 pt-0 border-t border-slate-800/80 ${className}`} {...props}>
    {children}
  </div>
);
