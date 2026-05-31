'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { adminNavItems } from '@/components/navigation/admin-nav-config';
import { cn } from '@/lib/utils';

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

export function MobileAdminNavigation({ close }: { close: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex w-full flex-col space-y-2 overflow-y-auto p-4">
      {adminNavItems.map(item => {
        if (item.children) {
          const hasActiveChild = item.children.some(child =>
            isActiveRoute({ href: child.href, pathname }),
          );

          return (
            <div
              key={item.label}
              className={cn(
                'rounded-md border px-2 py-2',
                hasActiveChild
                  ? 'border-border/80 bg-accent/30'
                  : 'border-border/50',
              )}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <item.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {item.children.map(child => {
                  const isActive = isActiveRoute({
                    href: child.href,
                    pathname,
                  });

                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={close}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-md px-2 py-2 transition-colors',
                        isActive ? 'bg-accent/50' : 'hover:bg-accent/30',
                      )}
                    >
                      <child.icon className="mt-0.5 size-4 shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{child.label}</div>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {child.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }

        if (!item.href) {
          return null;
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={close}
            className={cn(
              'flex w-full items-start gap-3 rounded-md px-2 py-3 transition-colors',
              isActiveRoute({ href: item.href, pathname })
                ? 'bg-accent/50'
                : 'hover:bg-accent/30',
            )}
          >
            <item.icon className="mt-0.5 size-5 shrink-0" />
            <div>
              <div className="text-sm font-medium">{item.label}</div>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

MobileAdminNavigation.displayName = 'MobileAdminNavigation';
