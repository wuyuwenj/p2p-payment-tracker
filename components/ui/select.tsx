'use client';

import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps {
  className?: string;
  children: ReactNode;
}

export function SelectTrigger({ className = '', children, onClick }: SelectTriggerProps & { onClick?: (e: React.MouseEvent) => void }) {
  const context = useContext(SelectContext);
  if (!context) throw new Error('SelectTrigger must be used within Select');

  const isCustomBadge = className.includes('bg-transparent') && className.includes('[&>svg]:hidden');
  const defaultClasses = isCustomBadge
    ? ''
    : 'flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
        context.setOpen(!context.open);
      }}
      className={`${defaultClasses} ${className}`}
    >
      {children}
      {!isCustomBadge && (
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${context.open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');

  // Map values to display labels
  const displayValue = () => {
    if (!context.value) return placeholder;
    if (context.value === 'all') return 'All Statuses';
    if (context.value === 'PENDING') return 'Pending';
    if (context.value === 'RECORDED') return 'Recorded';
    if (context.value === 'NOTIFIED') return 'Notified';
    if (context.value === 'COLLECTED') return 'Collected';
    return context.value;
  };

  return <span className="text-sm text-gray-900">{displayValue()}</span>;
}

interface SelectContentProps {
  className?: string;
  children: ReactNode;
}

export function SelectContent({ className = '', children }: SelectContentProps) {
  const context = useContext(SelectContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        context?.setOpen(false);
      }
    };

    if (context?.open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [context?.open]);

  if (!context) throw new Error('SelectContent must be used within Select');
  if (!context.open) return null;

  return (
    <div
      ref={ref}
      className={`absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg flex flex-col min-w-fit ${className}`}
      style={{ zIndex: 9999 }}
    >
      {children}
    </div>
  );
}

interface SelectItemProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function SelectItem({ value, children, className = '' }: SelectItemProps) {
  const context = useContext(SelectContext);
  if (!context) throw new Error('SelectItem must be used within Select');

  const isSelected = context.value === value;

  return (
    <button
      type="button"
      onClick={() => {
        context.onValueChange(value);
        context.setOpen(false);
      }}
      className={`w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
        isSelected ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-900'
      } ${className}`}
    >
      {children}
    </button>
  );
}
