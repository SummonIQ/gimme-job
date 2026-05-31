---
applyTo: "**/*.ts,**/*.tsx,**/*.d.ts"
---
# TypeScript Instructions

- Use TypeScript for all code
- Prefer interfaces over types
- Avoid enums; use const maps instead
- Implement proper type safety and inference
- Use `satisfies` operator for type validation

```typescript
// ✅ Good - keys sorted, values explicit
enum Status {
  Active: 'active',
  Completed: 'completed',
  Pending: 'pending',
};```
