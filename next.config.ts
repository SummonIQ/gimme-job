import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: [
    '@adobe/helix-md2docx',
    'puppeteer',
    'puppeteer-core',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
    'jsdom',
    'serpapi',
    'pdf-parse',
    'pdfjs-dist',
    'pdfkit',
    'pg',
  ],
  experimental: {
    dynamicOnHover: true,
    preloadEntriesOnStart: true,
    prerenderEarlyExit: true,
    linkNoTouchStart: true,
    scrollRestoration: true,
    authInterrupts: true,
    optimizeServerReact: true,
    typedEnv: true,
    viewTransition: true,
    useCache: true,
    mcpServer: true,
    serverComponentsHmrCache: true,
  },
   webpack(config) {
    config.module.rules.push({ test: /\.svg$/, use: ['@svgr/webpack'] });
    return config;
  },
  images: {
    domains: ['i.pravatar.cc'],
  },
  reactStrictMode: true,
  rewrites: async () => [
    {
      destination: '/rapidapi',
      source: '/api',
    },
  ],
  turbopack: {
    rules: {
      '*.svg': {
        as: '*.js',
        loaders: ['@svgr/webpack'],
      },
    },
    resolveAlias: {
      dns: { browser: './lib/stubs/empty.js' },
      fs: { browser: './lib/stubs/empty.js' },
      net: { browser: './lib/stubs/empty.js' },
      tls: { browser: './lib/stubs/empty.js' },
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  typedRoutes: true,
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

export default withSentryConfig(nextConfig, {
  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  // automaticVercelMonitors: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options
  org: 'bright-n-early',

  project: 'gimme-job',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: '/monitoring',

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Continue build even if sourcemap upload fails
  errorHandler: (err: Error) => {
    console.warn('Sentry sourcemap upload error (non-blocking):', err.message);
  },
});
