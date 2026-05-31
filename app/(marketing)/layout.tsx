import type { Viewport } from 'next';
import type React from 'react';

import { Footer } from './components/layout/footer';
import { Header } from './components/layout/header';

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { color: '#ffffff', media: '(prefers-color-scheme: light)' },
    { color: '#0a0a0f', media: '(prefers-color-scheme: dark)' },
  ],
  viewportFit: 'cover',
  width: 'device-width',
};

export default function LandingLayout({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="flex h-full min-h-screen grow flex-col bg-white dark:bg-slate-950"
      {...props}
    >
      <a
        href="#marketing-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-gray-900 dark:focus:bg-background dark:focus:text-foreground"
      >
        Skip to main content
      </a>

      <header role="banner" className="absolute top-0 left-0 right-0 z-50">
        <Header />
      </header>

      <main
        id="marketing-main"
        role="main"
        tabIndex={-1}
        className="flex grow flex-col bg-white dark:bg-slate-950"
      >
        {children}
      </main>

      <footer role="contentinfo">
        <Footer />
      </footer>

      {/* <script
        dangerouslySetInnerHTML={{
          __html: `        
          !function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(key,e){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.src="https://cdn.segment.com/analytics.js/v1/" + key + "/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(t,n);analytics._loadOptions=e};analytics._writeKey="HKoUYWeOR3YyySEAZqqVZFKJ18KpQr4Y";analytics.SNIPPET_VERSION="4.13.2";
            analytics.load("HKoUYWeOR3YyySEAZqqVZFKJ18KpQr4Y");
            analytics.page();
          }}();`,
        }}
      />
      <script
        async
        data-domain="budgetbloom.com"
        defer
        src="https://plausible.io/js/plausible.js"
      /> */}
    </div>
  );
}
