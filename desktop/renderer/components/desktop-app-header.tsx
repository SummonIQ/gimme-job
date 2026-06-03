import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';

import type { DesktopAuthState } from '../desktop-api';

import gimmeJobLogoUrl from '../../../public/brand/gimme-job-logo-color.png';
import { DesktopHeaderUserMenu } from './desktop-header-user-menu';
import { DesktopNotificationsPanel } from './desktop-notifications-panel';

export type DesktopAppHeaderSection =
  | 'dashboard'
  | 'training'
  | 'scraper'
  | 'smoke-tests';

interface DesktopAppHeaderProps {
  activeSection: DesktopAppHeaderSection;
  onSectionChange: (section: DesktopAppHeaderSection) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  authState: DesktopAuthState;
  onSignOut: () => void;
}

const NAV_ITEMS: ReadonlyArray<{
  section: DesktopAppHeaderSection;
  label: string;
}> = [
  { label: 'Dashboard', section: 'dashboard' },
  { label: 'Training', section: 'training' },
  { label: 'Scraper', section: 'scraper' },
  { label: 'Smoke tests', section: 'smoke-tests' },
];

/**
 * Frameless-window title bar for the desktop. Uses the same shared
 * NavigationMenu primitive the web AppHeader uses, so the Training /
 * Scraper tabs render with identical pixel output to the web's nav
 * (gradient + shadow active state, hover transitions, accent tokens).
 */
export const DesktopAppHeader = ({
  activeSection,
  onSectionChange,
  isDarkMode,
  onToggleDarkMode,
  authState,
  onSignOut,
}: DesktopAppHeaderProps) => {
  return (
    <header
      role="banner"
      data-window-drag
      className="desktop-app-header relative h-[54px] shrink-0 border-b border-white/[0.06] bg-background/40 backdrop-blur-md"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-20">
        <img
          alt="Gimme Job"
          src={gimmeJobLogoUrl}
          className="pointer-events-auto ml-5 h-6 w-auto select-none"
          data-window-no-drag
        />
      </div>

      <NavigationMenu
        data-window-no-drag
        className="absolute left-1/2 top-0 -translate-x-1/2 h-full items-center"
      >
        <NavigationMenuList className="gap-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = item.section === activeSection;
            return (
              <NavigationMenuItem key={item.section}>
                <NavigationMenuLink
                  asChild
                  active={isActive}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    'h-7 px-2.5 py-1 !text-xs',
                    'data-[active]:shadow-[0_1px_2px_rgba(0,0,0,0.18)]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSectionChange(item.section)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>

      <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDarkMode ? 'Light mode' : 'Dark mode'}
          className="size-8 rounded-md p-0"
        >
          {isDarkMode ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <DesktopNotificationsPanel />
        <DesktopHeaderUserMenu
          authState={authState}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
};
DesktopAppHeader.displayName = 'DesktopAppHeader';
