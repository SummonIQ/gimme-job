'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { ThemeModeToggle } from '@/components/ui/theme-mode-toggle';
import { useSession } from '@/lib/auth/client';
import { cn } from '@/lib/css';

import { Logo } from '@/components/common/logo';
import { ResponsiveContainer } from './responsive-container';

const navItems = [
  { href: '/features', label: 'Features' },
  { href: '/api', label: 'API' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
];

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  return (
    <ResponsiveContainer>
      <div className="relative flex items-center justify-between py-6">
        {/* Logo — absolutely positioned so it doesn't affect nav centering */}
        <div className="absolute left-12 top-1/2 -translate-y-1/2 md:left-2">
          <Link className="flex items-center gap-2" href="/">
            <Logo
              className="h-[2.15rem]! w-[7.9rem]!"
              size="md"
              variant="forward-subtle-comet"
            />
          </Link>
        </div>

        {/* Desktop Navigation — centered independently */}
        <nav className="mx-auto hidden items-center gap-2 md:flex">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-slate-800 hover:bg-primary/8 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-primary/15 dark:hover:text-slate-50',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Auth Buttons — absolutely positioned on the right */}
        <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-3 md:flex">
          <ThemeModeToggle className="border-0 bg-transparent shadow-none hover:bg-slate-950/5 dark:hover:bg-white/10" />
          {!isLoggedIn ? (
            <span
              aria-hidden="true"
              className="mx-0.5 h-7 w-px bg-slate-300/60 dark:bg-white/15"
            />
          ) : null}
          {isLoggedIn ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Go to App</Link>
            </Button>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'text-primary transition-colors duration-200 hover:bg-white dark:hover:bg-white/10',
                )}
              >
                Sign In
              </Link>
              <Button asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          className="text-foreground hover:bg-white md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="size-5" />
          ) : (
            <Menu className="size-5" />
          )}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="rounded-2xl border border-border/60 bg-white/90 pb-4 backdrop-blur-md dark:bg-background/90 md:hidden">
          <nav className="flex flex-col gap-2 px-4 pt-4">
            {navItems.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-slate-800 hover:bg-primary/10 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-primary/15 dark:hover:text-slate-50',
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-4 flex flex-col gap-2">
              {isLoggedIn ? (
                <Button asChild className="w-full">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Go to App
                  </Link>
                </Button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={cn(
                      buttonVariants({ variant: 'ghost' }),
                      'w-full text-primary transition-colors duration-200 hover:bg-white dark:hover:bg-white/10',
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Button asChild className="w-full">
                    <Link
                      href="/signup"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Get Started
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </ResponsiveContainer>
  );
};
Header.displayName = 'Header';
export { Header };
