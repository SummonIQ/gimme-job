'use client';

import {
  Briefcase,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  Mic,
  Send,
  Sparkles,
  Target,
  UserRound,
  Wrench,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';

const navConfig = {
  main: [
    {
      label: 'Dashboard',
      href: '/dashboard',
      exact: true,
      icon: LayoutDashboard,
    },
    {
      label: 'Inbox',
      href: '/inbox',
      icon: Inbox,
    },
    {
      label: 'Jobs',
      href: '/jobs',
      icon: Briefcase,
    },
    {
      label: 'Leads',
      href: '/leads',
      icon: ClipboardCheck,
      children: [
        {
          label: 'All Leads',
          href: '/leads',
          icon: Target,
          description: 'Browse and manage every job lead in your pipeline',
        },
        {
          label: 'Applications',
          href: '/applications',
          icon: Send,
          description: 'Every job application you have submitted',
        },
      ],
    },
    {
      label: 'My Profile',
      href: '/profile',
      icon: UserRound,
    },
    {
      label: 'Tools',
      href: '/tools',
      icon: Wrench,
      children: [
        {
          label: 'Interview Prep',
          href: '/tools/interview-prep',
          icon: Mic,
          description:
            'Research interviewers and get AI-powered interview strategies',
        },
        {
          label: 'Job Details Optimizer',
          href: '/tools/job-details-optimizer',
          icon: Sparkles,
          description: 'Optimize a resume for a job description',
        },
      ],
    },
  ],
};

export function MainNavigation() {
  const pathName = usePathname();

  const isExactActive = (path: string) => pathName === path;
  const isDescendantActive = (path: string) =>
    pathName.startsWith(`${path}/`);
  const isPathActive = (path: string) =>
    isExactActive(path) || isDescendantActive(path);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      const focusedElement = document.activeElement as HTMLElement;
      if (
        focusedElement &&
        focusedElement.closest('[data-radix-navigation-menu-content]')
      ) {
        const trigger = focusedElement
          .closest('[data-radix-navigation-menu-item]')
          ?.querySelector(
            '[data-radix-navigation-menu-trigger]',
          ) as HTMLElement;
        if (trigger) {
          trigger.focus();
        }
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <NavigationMenu className="hidden lg:flex" aria-label="Main navigation">
      <NavigationMenuList className="flex-col lg:flex-row">
        {navConfig.main.map(item => {
          if (item.children) {
            const isGroupExactActive = isExactActive(item.href);
            const isGroupParentActive =
              !isGroupExactActive &&
              (isDescendantActive(item.href) ||
                item.children.some(child => isPathActive(child.href)));

            return (
              <NavigationMenuItem key={item.label}>
                <NavigationMenuTrigger
                  data-active={isGroupExactActive ? true : undefined}
                  data-parent-active={isGroupParentActive ? true : undefined}
                  aria-expanded="false"
                  aria-haspopup="true"
                >
                  {item.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="rounded-lg bg-popover/72 backdrop-blur-2xl supports-[backdrop-filter]:bg-popover/62 dark:bg-[#15151a]/70 dark:supports-[backdrop-filter]:bg-[#15151a]/60">
                  <ul className="grid w-[min(400px,90vw)] gap-2 p-2 pb-2.5 pr-2.5 md:w-[500px]">
                    {item.children.map(child => (
                      <li key={child.label}>
                        <NavigationMenuLink
                          href={child.href}
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                          data-active={isPathActive(child.href) ? true : undefined}
                          aria-current={
                            isPathActive(child.href) ? 'page' : undefined
                          }
                        >
                          <div className="flex gap-2">
                            <div>
                              {child.icon && (
                                <child.icon className="size-4 text-foreground" />
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium leading-none">
                                {child.label}
                              </div>
                              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                {child.description}
                              </p>
                            </div>
                          </div>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            );
          }

          const isItemExactActive = isExactActive(item.href);
          const isItemParentActive =
            !isItemExactActive && !item.exact && isDescendantActive(item.href);

          return (
            <NavigationMenuItem key={item.label}>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                data-active={isItemExactActive ? true : undefined}
                data-parent-active={isItemParentActive ? true : undefined}
                href={item.href}
                aria-current={isItemExactActive ? 'page' : undefined}
              >
                {item.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

MainNavigation.displayName = 'MainNavigation';
