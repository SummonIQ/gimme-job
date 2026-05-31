import './globals.css';

import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Anton, Bebas_Neue, Space_Grotesk } from 'next/font/google';
import localFont from 'next/font/local';
import Script from 'next/script';
import { Suspense } from 'react';

const seoTitle = 'GimmeJob — AI-Powered Job Search & Application Tracker';
const seoDescription =
  'GimmeJob helps you land your dream job faster with AI-powered job search, application tracking, resume optimization, and interview preparation tools.';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://www.gimmejob.com',
  ),
  title: {
    default: seoTitle,
    template: '%s | GimmeJob',
  },
  description: seoDescription,
  icons: {
    apple: [{ sizes: '256x256', type: 'image/png', url: '/icon.png' }],
    icon: [
      { sizes: '256x256', type: 'image/png', url: '/icon.png' },
      { sizes: 'any', url: '/favicon.ico' },
    ],
    shortcut: '/icon.png',
  },
  keywords: [
    'job search',
    'job tracker',
    'application tracker',
    'resume builder',
    'AI job search',
    'career tools',
    'interview prep',
    'job application',
    'job hunting',
    'employment',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.gimmejob.com',
    siteName: 'GimmeJob',
    title: seoTitle,
    description: seoDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: seoTitle,
    description: seoDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  variable: '--font-bebas-neue',
  weight: '400',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

const anton = Anton({
  subsets: ['latin'],
  variable: '--font-anton',
  weight: '400',
});

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

import { DevBar } from '@/components/dev/dev-bar';
import { PerformanceMeasureGuard } from '@/components/dev/performance-measure-guard';
import { OnboardingProvider } from '@/components/onboarding/onboarding-context';
import { OnboardingModal } from '@/components/onboarding/onboarding-modal';
import { AppAnalyticsProvider } from '@/components/providers/applab-analytics-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`size-full ${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${bebasNeue.variable} ${anton.variable} ${geistSans.className}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <meta name="darkreader-lock" />
        {/* <script async src="https://unpkg.com/react-scan/dist/auto.global.js" /> */}
        {process.env.NODE_ENV === 'development' ? (
          <Script id="performance-measure-guard" strategy="beforeInteractive">{`
              if (typeof performance !== 'undefined') {
                const existing = performance.__gimmeJobMeasurePatched;
                if (!existing) {
                  const originalMeasure = performance.measure.bind(performance);
                  performance.__gimmeJobMeasurePatched = true;
                  performance.measure = (...args) => {
                    try {
                      return originalMeasure(...args);
                    } catch (error) {
                      const message = error && error.message ? String(error.message) : '';
                      if (message.toLowerCase().includes('cannot have a negative time stamp')) {
                        return;
                      }
                      throw error;
                    }
                  };
                }
              }
            `}</Script>
        ) : null}
      </head>
      <body
        className={'xs:bg-background h-full flex-col antialiased md:bg-sidebar'}
        suppressHydrationWarning
      >
        {process.env.NODE_ENV === 'development' ? (
          <PerformanceMeasureGuard />
        ) : null}
        <Suspense fallback={children}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AppAnalyticsProvider>
              <OnboardingProvider>
                <div className="flex h-full min-h-screen flex-col">
                  {children}
                </div>
                <OnboardingModal />
                {process.env.NODE_ENV === 'development' ? <DevBar /> : null}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    unstyled: true,
                    classNames: {
                      toast:
                        'flex items-start gap-3 w-full p-4 rounded-lg border shadow-lg backdrop-blur-sm',
                      success:
                        'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100',
                      error:
                        'bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100',
                      warning:
                        'bg-amber-50 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100',
                      info: 'bg-blue-50 dark:bg-blue-950/90 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
                      default:
                        'bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100',
                      title: 'font-semibold text-sm',
                      description: 'text-sm opacity-90',
                      icon: 'shrink-0 [&>svg]:size-5',
                      closeButton:
                        'absolute top-2 right-2 opacity-50 hover:opacity-100 transition-opacity',
                    },
                  }}
                />
              </OnboardingProvider>
            </AppAnalyticsProvider>
          </ThemeProvider>
        </Suspense>

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
