'use client';

import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';

interface DropdownMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | undefined>(undefined);

interface DropdownMenuProps {
  children: ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

interface DropdownMenuTriggerProps {
  asChild?: boolean;
  children: ReactNode;
}

export function DropdownMenuTrigger({ asChild, children }: DropdownMenuTriggerProps) {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

  if (asChild) {
    return (
      <div onClick={() => context.setOpen(!context.open)}>
        {children}
      </div>
    );
  }

  return (
    <button
      onClick={() => context.setOpen(!context.open)}
      className="focus:outline-none"
    >
      {children}
    </button>
  );
}

interface DropdownMenuContentProps {
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
  forceMount?: boolean;
}

export function DropdownMenuContent({
  children,
  className = '',
  align = 'start',
}: DropdownMenuContentProps) {
  const context = useContext(DropdownMenuContext);
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

  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');
  if (!context.open) return null;

  return (
    <div
      ref={ref}
      className={`absolute top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-50 ${
        align === 'end' ? 'right-0' : 'left-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}

interface DropdownMenuLabelProps {
  children: ReactNode;
  className?: string;
}

export function DropdownMenuLabel({ children, className = '' }: DropdownMenuLabelProps) {
  return (
    <div className={`px-4 py-2 text-sm ${className}`}>
      {children}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-gray-200" />;
}

interface DropdownMenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function DropdownMenuItem({ children, onClick, className = '' }: DropdownMenuItemProps) {
  const context = useContext(DropdownMenuContext);

  return (
    <button
      onClick={() => {
        onClick?.();
        context?.setOpen(false);
      }}
      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center ${className}`}
    >
      {children}
    </button>
  );
}
