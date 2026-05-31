'use client';

import type { User } from '@/generated/prisma/browser';
import { HamburgerMenuIcon } from '@radix-ui/react-icons';
import { XIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/common/logo';
import { AdminNavigation } from '@/components/navigation/admin-navigation';
import { MainNavigation } from '@/components/navigation/main-navigation';
import { MobileAdminNavigation } from '@/components/navigation/mobile-admin-navigation';
import { MobileMainNavigation } from '@/components/navigation/mobile-main-navigation';
import { NotificationsPanel } from '@/components/notifications/notifications-panel';
import { Button } from '@/components/ui/button';
import { ThemeModeToggle } from '@/components/ui/theme-mode-toggle';
import { HeaderUserMenu } from '@/components/user/header-user-menu';
import { cn } from '@/lib/utils';
import { Responsive } from '@/components/layout/responsive';

export function AppHeader({
  user,
  isProSubscriber = false,
}: {
  user?: Pick<User, 'id' | 'image' | 'email' | 'firstName' | 'lastName'> | null;
  isProSubscriber?: boolean;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const isAdminArea = pathname.startsWith('/admin');
  const logoHref = isAdminArea ? '/' : '/dashboard';

  const bottomEdgeThicknessPx = 1;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <header role="banner" className="fixed top-0 left-0 right-0 z-40 bg-background dark:bg-transparent">
 
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            height: '200%',
            background:
              'linear-gradient(to bottom, hsl(var(--background) / 0.98) 0%, hsl(var(--background) / 0) 50%)',
            backdropFilter: 'blur(22px) saturate(160%) brightness(1.08)',
            WebkitBackdropFilter: 'blur(22px) saturate(160%) brightness(1.08)',
            maskImage:
              'linear-gradient(to bottom, black 0%, black 50%, transparent 50%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 0%, black 50%, transparent 50%, transparent 100%)',
          }}
        />

        {/* Desktop Header */}
        <Responsive
          className={cn(
            'h-14 relative z-30 px-1'
            // 'relative z-30 mx-auto flex items-center justify-between gap-3 py-3.5',
            // 'max-w-6xl',
          )}
          center={true}
        >
          <div className="absolute top-1/2 -translate-y-1/2 left-1 flex items-center gap-2">
        
    <Button
              className="lg:hidden px-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              variant="outline"
              size="sm"
              aria-label="Toggle menu"
              type="button"
            >
              {!mobileMenuOpen ? (
                <HamburgerMenuIcon className="size-5" />
              ) : (
                <XIcon className="size-5" />
              )}
            </Button>
            <Link href={logoHref} className="flex items-center space-x-2">
              <Logo
                className="h-[1.625rem]! w-[6.55rem]!"
                size="sm"
                iconVariant="briefcase"
                iconClassName="rounded-lg"
                textClassName="text-gray-900 dark:text-foreground"
                betaClassName="text-gray-500 dark:text-muted-foreground"
                variant="forward-subtle-comet"
              />
            </Link>
          </div>

          <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
            {isMounted ? (
              isAdminArea ? (
                <AdminNavigation />
              ) : (
                <MainNavigation />
              )
            ) : null}
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 right-1 flex items-center gap-2">
            {isMounted ? <ThemeModeToggle /> : <div className="h-8 w-8" /> }
            {isMounted && user ? <span className="mr-1"><NotificationsPanel /></span> : null}
            {isMounted && user ? (
              <HeaderUserMenu
                user={{
                  email: user.email || '',
                  image: user.image || '',
                  name:
                    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                    user.email ||
                    '',
                }}
                isProSubscriber={isProSubscriber}
              />
            ) : null}
          </div>
        </Responsive>


        {/* Mobile Header */}
        {mobileMenuOpen ? (
          <div
            className={cn(
              'lg:hidden relative z-10 mx-auto pb-4',
              'max-w-6xl px-6',
            )}
          >
            <div className="border-t border-border/50 pt-3">
              <div
                className={cn(
                  'rounded-2xl border border-border/60 bg-card p-2',
                  'shadow-lg shadow-black/10 dark:shadow-black/30',
                  'backdrop-blur-xl supports-backdrop-filter:bg-card/95',
                )}
              >
                {isAdminArea ? (
                  <MobileAdminNavigation
                    close={() => setMobileMenuOpen(false)}
                  />
                ) : (
                  <MobileMainNavigation
                    close={() => setMobileMenuOpen(false)}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-px"
          style={{
            background:
              'linear-gradient(to right, hsl(var(--border) / 0), hsl(var(--border) / 0.03), hsl(var(--border) / 0))',
          }}
        />

        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            height: '100%',
            transform: 'translateY(100%)',
            background: 'hsl(var(--foreground) / 0.06)',
            backdropFilter:
              'blur(16px) brightness(180%) saturate(130%) contrast(110%)',
            WebkitBackdropFilter:
              'blur(16px) brightness(180%) saturate(130%) contrast(110%)',
            pointerEvents: 'none',
            ['--thickness' as any]: `${bottomEdgeThicknessPx}px`,
            maskImage:
              'linear-gradient(to bottom, black 0, black var(--thickness), transparent var(--thickness))',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 0, black var(--thickness), transparent var(--thickness))',
          }}
        />

    </header>
  );
}
