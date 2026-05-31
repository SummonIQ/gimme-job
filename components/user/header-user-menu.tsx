'use client';

import {
  BadgeCheck,
  Bell,
  CreditCard,
  LogOut,
  Settings,
  LayoutDashboard,
  Shield,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { signOut } from '@/lib/auth/client';

export function HeaderUserMenu({
  user,
  isProSubscriber = false,
}: {
  user: {
    email: string;
    image: string;
    name: string;
  };
  isProSubscriber?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  const { reset } = useAnalytics();

  const handleBilling = async () => {
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to open billing portal');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button className="relative size-8 rounded-full p-0" variant="ghost">
          <Avatar className="size-7">
            <AvatarImage alt={`${user.name}'s avatar`} src={user.image} />
            <AvatarFallback>
              <Skeleton className="size-7 rounded-full" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {!isProSubscriber && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/upgrade">
                  <Sparkles />
                  Upgrade to Pro
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings />
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/settings/profile">
              <BadgeCheck />
              Profile
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleBilling}>
            <CreditCard />
            Billing
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/settings/notifications">
              <Bell />
              Notifications
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {user.email === 'bright-and-early@outlook.com' && (
          <>
            <DropdownMenuItem asChild>
              <Link href={isAdmin ? '/dashboard' : '/admin'}>
                {isAdmin ? <LayoutDashboard /> : <Shield />}
                {isAdmin ? 'App' : 'Admin'}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem
          className="text-red-500"
          onClick={async () => {
            await signOut();
            reset();
            router.push('/login');
          }}
        >
          <LogOut className="text-red-500" />
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
