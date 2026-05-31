'use client';

import { usePathname } from 'next/navigation';

import { adminNavItems } from '@/components/navigation/admin-nav-config';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';

const isActiveRoute = ({
  href,
  pathname,
}: {
  href: string;
  pathname: string;
}) => {
  if (href === '/admin') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <NavigationMenu className="hidden lg:flex" aria-label="Admin navigation">
      <NavigationMenuList className="flex-col lg:flex-row">
        {adminNavItems.map(item => {
          if (item.children) {
            const hasActiveChild = item.children.some(child =>
              isActiveRoute({ href: child.href, pathname }),
            );

            return (
              <NavigationMenuItem key={item.label}>
                <NavigationMenuTrigger
                  data-active={hasActiveChild ? true : undefined}
                  aria-expanded="false"
                  aria-haspopup="true"
                >
                  {item.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[360px] gap-2 p-2 pb-2.5 pr-2.5 md:w-[420px] lg:w-[440px]">
                    {item.children.map(child => {
                      const isChildActive = isActiveRoute({
                        href: child.href,
                        pathname,
                      });

                      return (
                        <li key={child.href}>
                          <NavigationMenuLink
                            href={child.href}
                            className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                            data-active={isChildActive ? true : undefined}
                            aria-current={isChildActive ? 'page' : undefined}
                          >
                            <div className="flex gap-2">
                              <div>
                                <child.icon className="size-4 text-foreground" />
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
                      );
                    })}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            );
          }

          if (!item.href) {
            return null;
          }

          const isActive = isActiveRoute({ href: item.href, pathname });

          return (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                data-active={isActive ? true : undefined}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
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

AdminNavigation.displayName = 'AdminNavigation';
