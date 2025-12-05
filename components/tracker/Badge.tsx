import { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'secondary' | 'info' | 'warning' | 'success';
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'secondary', children, className = '' }: BadgeProps) {
  const variantStyles = {
    secondary: 'bg-gray-100 text-gray-800',
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    success: 'bg-green-100 text-green-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
