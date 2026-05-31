'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin/listings', label: 'Analytics' },
  { href: '/admin/listings/ingestion', label: 'Ingestion' },
  { href: '/admin/listings/manual', label: 'Manual' },
] as const;

function ListingsPageTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Listings sections"
      className="relative flex w-fit items-center rounded-lg bg-muted p-1 text-muted-foreground"
    >
      {tabs.map(tab => {
        const active =
          tab.href === '/admin/listings'
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'bg-primary/15 text-primary'
                : 'hover:text-foreground/80',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export { ListingsPageTabs };
