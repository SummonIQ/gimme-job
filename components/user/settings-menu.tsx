'use client';

import type { User } from '@/generated/prisma/browser';
import {
  BrainCircuitIcon,
  CpuIcon,
  CreditCardIcon,
  FileTextIcon,
  PaintbrushIcon,
  UserCircleIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/css';

import { buttonVariants } from '../ui/button';

const SettingsMenu = ({
  user,
  className,
  ...props
}: { user?: User } & HTMLAttributes<HTMLDivElement>) => {
  const pathName = usePathname();

  const items: Array<{
    active: boolean;
    href: string;
    icon: LucideIcon;
    label: string;
  }> = [
    {
      active: pathName === '/settings',
      href: '/settings',
      icon: UserCircleIcon,
      label: 'Account',
    },
    {
      active: pathName.startsWith('/settings/profile'),
      href: '/settings/profile',
      icon: FileTextIcon,
      label: 'Profile',
    },
    {
      active: pathName === '/settings/appearance',
      href: '/settings/appearance',
      icon: PaintbrushIcon,
      label: 'Appearance',
    },
    {
      active: pathName.startsWith('/settings/knowledge'),
      href: '/settings/knowledge',
      icon: BrainCircuitIcon,
      label: 'Knowledge',
    },
    {
      active: pathName === '/settings/ai-provider',
      href: '/settings/ai-provider',
      icon: CpuIcon,
      label: 'AI Provider',
    },
    {
      active: pathName.startsWith('/settings/billing'),
      href: '/settings/billing',
      icon: CreditCardIcon,
      label: 'Billing',
    },
  ];
  return (
    <nav
      className={cn(
        'flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1',
        className,
      )}
      {...props}
    >
      {items.map((item, i) => (
        <Link
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'justify-start rounded-md hover:bg-accent/50',
            item.active ? '!bg-accent' : 'text-foreground/70',
          )}
          href={item.href as never}
          key={item.href}
        >
          <item.icon className="size-5" />

          {item.label}
        </Link>
      ))}
    </nav>
  );
};

SettingsMenu.displayName = 'SettingsMenu';

export { SettingsMenu };
