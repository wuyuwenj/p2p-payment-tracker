'use client';

import { forwardRef } from 'react';
import Image from 'next/image';

interface AvatarProps {
  className?: string;
  children: React.ReactNode;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className = '', children }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}
      >
        {children}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';

interface AvatarImageProps {
  src?: string | null;
  alt?: string;
}

export const AvatarImage = ({ src, alt = '' }: AvatarImageProps) => {
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="aspect-square h-full w-full object-cover"
    />
  );
};

interface AvatarFallbackProps {
  className?: string;
  children: React.ReactNode;
}

export const AvatarFallback = ({ className = '', children }: AvatarFallbackProps) => {
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-gray-900 ${className}`}
    >
      {children}
    </div>
  );
};
