import { LogOut, User } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { DesktopAuthState } from '../desktop-api';

interface DesktopHeaderUserMenuProps {
  readonly authState: DesktopAuthState;
  readonly onSignOut: () => void;
}

/**
 * Desktop-flavored equivalent of components/user/header-user-menu.tsx —
 * uses the same shared Avatar / DropdownMenu / Button primitives, but
 * keys the sign-out action off the desktop's auth IPC instead of the
 * web's Better Auth client.
 */
export const DesktopHeaderUserMenu = ({
  authState,
  onSignOut,
}: DesktopHeaderUserMenuProps) => {
  const isPaired = authState.status === 'paired';
  const truncatedUserId = authState.userId
    ? `${authState.userId.slice(0, 6)}…${authState.userId.slice(-4)}`
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 rounded-full p-0"
          aria-label="Account"
        >
          <Avatar className="size-7">
            <AvatarFallback>
              <User className="size-4" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {isPaired ? 'Signed in' : 'Not paired'}
            </p>
            {truncatedUserId ? (
              <p className="font-mono text-xs leading-none text-muted-foreground">
                {truncatedUserId}
              </p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        {isPaired ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-500" onClick={onSignOut}>
              <LogOut className="mr-2 size-4 text-red-500" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
DesktopHeaderUserMenu.displayName = 'DesktopHeaderUserMenu';
