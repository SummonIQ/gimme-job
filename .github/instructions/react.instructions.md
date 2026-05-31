---
applyTo: "**/*.tsx"
---
# React Instructions

## Component Architecture
- Favor React Server Components (RSC) where possible
- Minimize `'use client'`, `useEffect`, and `useState`
- Implement proper error boundaries
- Use Suspense for async operations
- Optimize for performance and Web Vitals
- Use controlled components for form inputs

## Component Definition
```tsx
// Standard component
const ComponentName = () => {
  // Component logic
};
ComponentName.displayName = "ComponentName";

export { ComponentName };

// With props
export interface ComponentNameProps {
  title: string;
  isActive?: boolean;
}

const ComponentName = ({ title, isActive }: ComponentNameProps) => {
  // Component logic
};
```

## Hooks Best Practices
- Implement hooks correctly (`useState`, `useEffect`, `useContext`, `useReducer`, `useMemo`, `useCallback`)
- Follow the Rules of Hooks (only call at top level, only from React functions)
- Create custom hooks to extract reusable logic
- Use `React.memo()` for component memoization when appropriate
- Use `useCallback` for memoizing functions passed as props
- Use `useMemo` for expensive computations
- Avoid inline function definitions in render
- Use cleanup functions in `useEffect` to prevent memory leaks

## State Management
- Use `useActionState` instead of deprecated `useFormState`
- Leverage enhanced `useFormStatus` with new properties (`data`, `method`, `action`)
- Implement URL state management with `nuqs`
- Minimize client-side state

## Patterns
- Prefer composition over inheritance
- Use children prop and render props pattern for flexible components
- Implement `React.lazy()` and Suspense for code splitting
- Use refs sparingly and mainly for DOM access
- Use short-circuit evaluation and ternary operators for conditional rendering
