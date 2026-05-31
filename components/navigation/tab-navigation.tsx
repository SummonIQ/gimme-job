'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/css';

export function TabNavigation({
  tabs,
  defaultValue,
}: {
  defaultValue?: string;
  tabs: Array<{
    content?: React.ReactNode;
    href: string;
    label: string;
  }>;
}) {
  const pathname = usePathname();
  const activeValue =
    tabs
      .filter(
        tab => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ??
    defaultValue ??
    tabs[0]?.href;

  return (
    <Tabs value={activeValue}>
      <TabsList>
        {tabs.map(tab => (
          <TabsTrigger asChild key={tab.href} value={tab.href}>
            <Link
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150',
              )}
              href={tab.href}
              // prefetch={true}
            >
              {tab.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map(tab =>
        tab.content === undefined ? null : (
          <TabsContent key={tab.href} value={tab.href}>
            {tab.content}
          </TabsContent>
        ),
      )}
    </Tabs>
  );
}
