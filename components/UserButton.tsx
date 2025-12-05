'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
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

export default function UserButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  if (!session?.user) {
    return (
      <Button variant="secondary" size="sm" onClick={() => signIn('google')}>
        Sign In
      </Button>
    );
  }

  const userEmail = session.user.email || '';
  const userAvatar = session.user.image;
  const userName = session.user.name || userEmail;
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-9 w-9 rounded-full focus:outline-none">
          <Avatar className="h-9 w-9">
            <AvatarImage src={userAvatar} alt={userName} />
            <AvatarFallback className="bg-blue-600 text-white text-sm">
              {initials || <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-gray-900">{userName}</p>
            <p className="text-xs leading-none text-gray-500">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
