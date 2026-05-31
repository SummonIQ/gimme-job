'use client';

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
  // useTheme,
} from 'next-themes';
// import { useEffect } from 'react';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
