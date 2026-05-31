---
applyTo: "app/**/*.ts,app/**/*.tsx"
---
# Next.js 16 Instructions

Always use the latest stable version of Next.js 16 with App Router.

## Component Architecture
- Favor React Server Components (RSC) where possible
- Prefer server actions over API endpoints where appropriate
- Implement proper error boundaries
- Use Suspense for async operations

## Caching Pattern
```typescript
// Cache data
'use cache';
cacheTag(`user:${userId}:resumes`);

// Revalidate cache
revalidateTag(`user:${userId}:resumes`);
revalidateTag(`user:${userId}:resumes:${resumeId}`);
```

## Page Components
```tsx
// Page component (default export)
export default function SomePage() {
  // Page logic
}

// Error handling (error.tsx)
'use client'
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (/* error UI */);
}
```

## Async Request APIs
```typescript
// Always use async versions of runtime APIs
const cookieStore = await cookies();
const headersList = await headers();
const { isEnabled } = await draftMode();

// Handle async params in layouts/pages
const params = await props.params;
const searchParams = await props.searchParams;
```

## Performance Optimization
- Wrap client components in Suspense with fallback
- Use dynamic loading for non-critical components
- Implement route-based code splitting
- Use Next.js Image component for optimized image loading
- Use `loading.tsx` files for managing loading states

## SEO
- Use Next.js metadata API for SEO optimization
- Use `generateMetadata()` when dynamic data is needed

## Accessibility
- Use proper ARIA attributes
- Use semantic HTML elements
