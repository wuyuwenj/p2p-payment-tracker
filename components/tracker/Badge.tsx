import { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'secondary' | 'info' | 'warning' | 'success';
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'secondary', children, className = '' }: BadgeProps) {
  const variantStyles = {
    secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    info: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    warning: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    success: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
