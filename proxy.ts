import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';
// Note: We're using a separate file for i18n middleware to avoid conflicts

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login',
    '/signup',
    '/forgot-password',
    '/verification-required',
    '/suspended',
    '/features',
    '/pricing',
    '/about',
    '/faq',
    '/'
  ];
  const isPublicRoute =
    publicRoutes.some(route => pathname.startsWith(route)) || pathname === '/';

  // If already on a public route, allow through
  if (isPublicRoute) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: 'gimme-job',
  });

  // If no session cookie is found and we're accessing a protected route, redirect to login
  if (!sessionCookie) {
    // Store the original URL as a URL parameter for redirect after login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect_to', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
