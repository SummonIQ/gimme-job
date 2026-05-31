---
applyTo: "**/*.prisma,lib/db/**/*.ts,prisma/**/*"
---
# Prisma ORM Instructions

Always use the latest version of Prisma.js.

## Schema Design
- Use meaningful, domain-driven model names
- Use `@id` for primary keys
- Use `@unique` for natural unique identifiers
- Use `@relation` for explicit relationship definitions
- Keep schemas normalized and DRY
- Implement soft delete with `deletedAt` timestamp
- Use Prisma's native type decorators

## Client Usage
- Always use type-safe Prisma client operations
- Prefer transactions for complex, multi-step operations
- Use Prisma middleware for cross-cutting concerns (logging, soft delete, auditing)
- Handle optional relations explicitly
- Use Prisma's filtering and pagination capabilities

## Database Migrations
- Create migrations for schema changes
- Use descriptive migration names
- Review migrations before applying
- Never modify existing migrations
- Keep migrations idempotent

## Error Handling
```typescript
// Catch Prisma-specific errors
try {
  await prisma.user.create({ data });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle known errors (e.g., unique constraint violation)
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    // Handle validation errors
  }
}
```

## Performance
- Use `select` and `include` judiciously
- Avoid N+1 query problems
- Use `findMany` with `take` and `skip` for pagination
- Leverage Prisma's `distinct` for unique results
- Profile and optimize database queries

## Security
- Never expose raw Prisma client in APIs
- Use input validation before database operations
- Implement row-level security
- Sanitize and validate all user inputs

## Architecture
- Keep Prisma-related code in dedicated repositories/modules
- Separate data access logic from business logic
- Create repository patterns for complex queries
- Use dependency injection for Prisma services
