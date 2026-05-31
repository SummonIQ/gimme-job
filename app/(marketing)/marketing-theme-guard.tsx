'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

export function MarketingThemeGuard() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pathname === '/api' || pathname === '/rapidapi') {
      return;
    }

    const root = document.documentElement;
    const hadDarkClass = root.classList.contains('dark');
    const previousColorScheme = root.style.colorScheme;

    root.classList.remove('dark');
    root.style.colorScheme = 'light';

    return () => {
      root.classList.toggle('dark', hadDarkClass);
      if (previousColorScheme) {
        root.style.colorScheme = previousColorScheme;
      } else {
        root.style.removeProperty('color-scheme');
      }
    };
  }, [pathname]);

  return null;
}
