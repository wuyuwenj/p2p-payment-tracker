'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/tracker/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

export default function UserButton() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  if (!user) {
    return (
      <Button variant="secondary" size="sm" onClick={() => router.push('/auth/signin')}>
        Sign In
      </Button>
    );
  }

  const userEmail = user.email || '';
  const username = user.user_metadata?.username;
  const userAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const displayName = user.user_metadata?.name || user.user_metadata?.full_name || username || userEmail.split('@')[0];

  // Check if this is an internal email (username-based login)
  const isInternalEmail = userEmail.endsWith('@internal.local');

  // For display, prefer: displayName > username > email prefix
  const primaryText = displayName;
  // Only show email as secondary text if it's a real email (not internal)
  const secondaryText = isInternalEmail ? `@${username}` : userEmail;

  const initials = primaryText
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/signin');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-9 w-9 rounded-full focus:outline-none">
          <Avatar className="h-9 w-9">
            <AvatarImage src={userAvatar} alt={primaryText} />
            <AvatarFallback className="bg-blue-600 text-white text-sm">
              {initials || <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-gray-900 dark:text-gray-100">{primaryText}</p>
            <p className="text-xs leading-none text-gray-500 dark:text-gray-400">{secondaryText}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
