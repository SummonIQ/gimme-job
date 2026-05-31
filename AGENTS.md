# Agent Instructions

This document provides comprehensive guidelines for AI agents working on this codebase.

---

## Table of Contents

1. [Agent Profile](#agent-profile)
2. [Analysis Process](#analysis-process)
3. [Development Commands](#development-commands)
4. [Architecture Overview](#architecture-overview)
5. [Code Style & Structure](#code-style--structure)
6. [TypeScript](#typescript)
7. [React](#react)
8. [Next.js 16](#nextjs-16)
9. [Prisma ORM](#prisma-orm)
10. [Tailwind CSS](#tailwind-css)
11. [Sentry Integration](#sentry-integration)
12. [Linear Project Management](#linear-project-management)
13. [Safety Rules](#safety-rules)

---

## Agent Profile

You are an expert senior software engineer specializing in modern web development, with deep expertise in:

- **TypeScript** - Type-safe JavaScript
- **React 19** - UI component library
- **Next.js 16** - App Router architecture
- **Vercel AI SDK** - AI integration
- **Prisma.js ORM** - Database access
- **Shadcn UI / Radix UI** - Component libraries
- **Tailwind CSS** - Utility-first styling

You are thoughtful, precise, and focus on delivering high-quality, maintainable solutions.

---

## Analysis Process

Before responding to any request, follow these steps:

### 1. Request Analysis
- Determine task type (code creation, debugging, architecture, etc.)
- Identify languages and frameworks involved
- Note explicit and implicit requirements
- Define core problem and desired outcome
- Consider project context and constraints

### 2. Solution Planning
- Break down the solution into logical steps
- Consider modularity and reusability
- Identify necessary files and dependencies
- Evaluate alternative approaches
- Plan for testing and validation

### 3. Implementation Strategy
- Choose appropriate design patterns
- Consider performance implications
- Plan for error handling and edge cases
- Ensure accessibility compliance
- Verify best practices alignment

---

## Development Commands

### Database Operations
- \`bun db:generate\` - Generate Prisma client
- \`bun db:migrate\` - Run database migrations in development
- \`bun db:push\` - Push schema changes to database
- \`bun db:reset\` - Reset database (skip generate)
- \`bun db:studio\` - Open Prisma Studio on port 5558

### Development & Building
- \`bun dev\` - Start development server with Turbopack on port 3020
- \`bun build\` - Build the application (includes Prisma generation)
- \`bun start\` - Start production server
- \`bun lint\` - Run ESLint
- \`bun test\` - Run Jest tests
- \`bun test:a11y\` - Run accessibility tests specifically

### Utility Commands
- \`bun deps:check\` - Check for dependency updates using ncu
- \`bun yolo\` - Quick git add, commit, and push (development shortcut)

---

## Architecture Overview

### Technology Stack
- **Framework**: Next.js 16 (App Router) with React 19
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better Auth with session-based authentication
- **Styling**: Tailwind CSS with Radix UI components
- **AI Integration**: Vercel AI SDK with OpenAI
- **Real-time**: Pusher for notifications and live updates
- **Testing**: Jest with accessibility testing via @axe-core/react

### Project Structure

#### App Router Structure (\`/app\`)
- \`(app)/\` - Main authenticated application routes
- \`(marketing)/\` - Public marketing pages with separate layout
- \`api/\` - API routes organized by feature domain
- \`shared/[token]/\` - Public sharing functionality

#### Core Business Logic (\`/lib\`)
- **Job Management**: \`job-leads/\`, \`job-listings/\`, \`job-searches/\`
- **Resume Processing**: \`resumes/\` with analysis, optimization, and refinement
- **AI Features**: \`interviews/\`, \`skills/\`, resume analysis
- **Integrations**: \`api/\` (LinkedIn, Indeed), \`applications/\` (auto-submission)
- **Infrastructure**: \`auth/\`, \`db/\`, \`cache/\`, \`events/\`, \`notifications/\`

#### Database Architecture
The Prisma schema defines a comprehensive job search platform with:
- **User Management**: Users, profiles, job preferences, LinkedIn integration
- **Job Pipeline**: JobSearch → JobListing → JobLead → ApplicationSubmission
- **Resume System**: Resume → ResumeRevision with analysis and optimization
- **AI Analysis**: Job fit analysis, skill gap analysis, resume optimization
- **Notifications**: Real-time notifications with read/unread status

### Key Patterns

#### Authentication & Middleware
- Session-based auth using Better Auth
- Middleware protects authenticated routes, redirects to \`/login\` with original URL
- Public routes: \`/\`, \`/login\`, marketing pages

### AI & Automation Features
- **Job Search Automation**: Google Jobs, Indeed, LinkedIn integration
- **Resume Optimization**: ATS scoring, job-specific tailoring
- **Interview Preparation**: AI-generated questions and evaluation
- **Application Submission**: Automated form filling and submission
- **Skill Gap Analysis**: Compare resume against job requirements
- **LinkedIn Integration**: Profile import and connection suggestions

### Real-time Features
- Pusher integration for live notifications
- Job search progress tracking
- Application status updates
- Browser notifications for critical updates

### Testing Strategy
- Jest for unit tests
- Accessibility tests with jest-axe
- Run \`bun test:a11y\` for a11y-specific test suite
- Mobile responsiveness auditing tools included

---

## Code Style & Structure

### General Principles
- Write concise, readable TypeScript code
- Use functional and declarative programming patterns
- Follow DRY (Don't Repeat Yourself) principle
- Implement early returns for better readability
- Structure components logically: exports, subcomponents, helpers, types
- Use English for all code and documentation
- Always declare explicit types for variables and functions
- Avoid using \`any\`
- Create precise, descriptive types
- Use JSDoc to document public classes and methods
- Maintain a single export per file
- Write self-documenting, intention-revealing code

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes/Interfaces | PascalCase | \`UserProfile\`, \`IApiResponse\` |
| Variables/Functions | camelCase | \`getUserData\`, \`isLoading\` |
| Files/Directories | kebab-case | \`user-profile.tsx\`, \`auth-wizard/\` |
| Environment Variables | UPPERCASE | \`DATABASE_URL\`, \`API_KEY\` |
| Boolean Variables | Verb prefix | \`isLoading\`, \`hasError\`, \`canDelete\` |

- Start function names with a verb
- Prefix event handlers with "handle" (\`handleClick\`, \`handleSubmit\`)
- Use complete words, avoiding unnecessary abbreviations
  - Exceptions: \`API\`, \`URL\`, \`i\`/\`j\` for loops, \`err\` for errors, \`ctx\` for contexts
- Favor named exports for components

### Functions
- Write concise, single-purpose functions (aim for <20 lines)
- Name functions descriptively with a verb
- Use early returns to minimize complexity
- Extract complex logic to utility functions
- Leverage functional programming: \`map\`, \`filter\`, \`reduce\`
- Use arrow functions for simple operations
- Use named functions for complex logic
- Use object parameters for multiple arguments
- Maintain a single level of abstraction

### Data Handling
- Encapsulate data in composite types
- Prefer immutability
- Use \`readonly\` for unchanging data
- Use \`as const\` for literal values
- Validate data at the boundaries

### Error Handling
- Use specific, descriptive error types
- Provide context in error messages
- Use global error handling where appropriate
- Log errors with sufficient context
- Implement error boundaries to catch and handle errors gracefully
- Use cleanup functions in \`useEffect\` to prevent memory leaks

---

## TypeScript

- Use TypeScript for all code
- Prefer interfaces over types
- Avoid enums; use const maps instead
- Implement proper type safety and inference
- Use \`satisfies\` operator for type validation

\`\`\`typescript
// ✅ Good - const map
const Status = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const;

// ❌ Avoid - enum
enum Status {
  PENDING = 'pending',
  ACTIVE = 'active',
}
\`\`\`

---

## React

### Component Architecture
- Favor React Server Components (RSC) where possible
- Minimize \`'use client'\`, \`useEffect\`, and \`useState\`
- Implement proper error boundaries
- Use Suspense for async operations
- Optimize for performance and Web Vitals
- Use controlled components for form inputs

### Component Definition
\`\`\`tsx
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
\`\`\`

### Hooks Best Practices
- Implement hooks correctly (\`useState\`, \`useEffect\`, \`useContext\`, \`useReducer\`, \`useMemo\`, \`useCallback\`)
- Follow the Rules of Hooks (only call at top level, only from React functions)
- Create custom hooks to extract reusable logic
- Use \`React.memo()\` for component memoization when appropriate
- Use \`useCallback\` for memoizing functions passed as props
- Use \`useMemo\` for expensive computations
- Avoid inline function definitions in render

### State Management
- Use \`useActionState\` instead of deprecated \`useFormState\`
- Leverage enhanced \`useFormStatus\` with new properties (\`data\`, \`method\`, \`action\`)
- Implement URL state management with \`nuqs\`
- Minimize client-side state

### Patterns
- Prefer composition over inheritance
- Use children prop and render props pattern for flexible components
- Implement \`React.lazy()\` and Suspense for code splitting
- Use refs sparingly and mainly for DOM access
- Use short-circuit evaluation and ternary operators for conditional rendering

---

## Next.js 16

Always use the latest stable version of Next.js 16 with App Router.

### Component Architecture
- Favor React Server Components (RSC) where possible
- Prefer server actions over API endpoints where appropriate
- Implement proper error boundaries
- Use Suspense for async operations

### Caching Pattern
\`\`\`typescript
// Cache data
'use cache';
cacheTag(\`user:\${userId}:resumes\`);

// Revalidate cache
revalidateTag(\`user:\${userId}:resumes\`);
revalidateTag(\`user:\${userId}:resumes:\${resumeId}\`);
\`\`\`

### Page Components
\`\`\`tsx
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
\`\`\`

### Async Request APIs
\`\`\`typescript
// Always use async versions of runtime APIs
const cookieStore = await cookies();
const headersList = await headers();
const { isEnabled } = await draftMode();

// Handle async params in layouts/pages
const params = await props.params;
const searchParams = await props.searchParams;
\`\`\`

### Performance Optimization
- Wrap client components in Suspense with fallback
- Use dynamic loading for non-critical components
- Implement route-based code splitting
- Use Next.js Image component for optimized image loading
- Use \`loading.tsx\` files for managing loading states

### SEO
- Use Next.js metadata API for SEO optimization
- Use \`generateMetadata()\` when dynamic data is needed

### Accessibility
- Use proper ARIA attributes
- Use semantic HTML elements

---

## Prisma ORM

Always use the latest version of Prisma.js.

### Schema Design
- Use meaningful, domain-driven model names
- Use \`@id\` for primary keys
- Use \`@unique\` for natural unique identifiers
- Use \`@relation\` for explicit relationship definitions
- Keep schemas normalized and DRY
- Implement soft delete with \`deletedAt\` timestamp
- Use Prisma's native type decorators

### Client Usage
- Always use type-safe Prisma client operations
- Prefer transactions for complex, multi-step operations
- Use Prisma middleware for cross-cutting concerns (logging, soft delete, auditing)
- Handle optional relations explicitly
- Use Prisma's filtering and pagination capabilities

### Database Workflow
1. Always run \`bun db:generate\` after schema changes
2. Use \`bun db:migrate\` for development migrations
3. Use descriptive migration names
4. Never modify existing migrations

### Error Handling
\`\`\`typescript
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
\`\`\`

### Performance
- Use \`select\` and \`include\` judiciously
- Avoid N+1 query problems
- Use \`findMany\` with \`take\` and \`skip\` for pagination
- Leverage Prisma's \`distinct\` for unique results
- Profile and optimize database queries

### Security
- Never expose raw Prisma client in APIs
- Use input validation before database operations
- Implement row-level security
- Sanitize and validate all user inputs

### Architecture
- Keep Prisma-related code in dedicated repositories/modules
- Separate data access logic from business logic
- Create repository patterns for complex queries
- Use dependency injection for Prisma services

---

## Tailwind CSS

- Follow responsive design principles
- Use Tailwind CSS classes to ensure responsiveness across screen sizes
- Use utility classes consistently
- Extract repeated patterns to component classes when needed

---

## Sentry Integration

Use \`import * as Sentry from "@sentry/nextjs"\` to reference Sentry functionality.

### Configuration Files
- **Client**: \`instrumentation-client.ts\`
- **Server**: \`sentry.server.config.ts\`
- **Edge**: \`sentry.edge.config.ts\`

Initialization only needs to happen in these files.

### Exception Catching
\`\`\`typescript
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
\`\`\`

### Tracing - UI Actions
\`\`\`typescript
function TestComponent() {
  const handleTestButtonClick = () => {
    Sentry.startSpan(
      {
        op: 'ui.click',
        name: 'Test Button Click',
      },
      span => {
        span.setAttribute('config', 'some value');
        span.setAttribute('metric', 'some metric');
        doSomething();
      },
    );
  };
  
  return (
    <button type="button" onClick={handleTestButtonClick}>
      Test Sentry
    </button>
  );
}
\`\`\`

### Tracing - API Calls
\`\`\`typescript
async function fetchUserData(userId: string) {
  return Sentry.startSpan(
    {
      op: 'http.client',
      name: \`GET /api/users/\${userId}\`,
    },
    async () => {
      const response = await fetch(\`/api/users/\${userId}\`);
      const data = await response.json();
      return data;
    },
  );
}
\`\`\`

### Logging

Enable logging in Sentry initialization:
\`\`\`typescript
Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  enableLogs: true,
});
\`\`\`

Optional console integration:
\`\`\`typescript
Sentry.init({
  dsn: 'https://...',
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['log', 'error', 'warn'] }),
  ],
});
\`\`\`

Logger usage with \`logger.fmt\` for structured logs:
\`\`\`typescript
const { logger } = Sentry;

logger.trace('Starting database connection', { database: 'users' });
logger.debug(logger.fmt\`Cache miss for user: \${userId}\`);
logger.info('Updated profile', { profileId: 345 });
logger.warn('Rate limit reached for endpoint', {
  endpoint: '/api/results/',
  isEnterprise: false,
});
logger.error('Failed to process payment', {
  orderId: 'order_123',
  amount: 99.99,
});
logger.fatal('Database connection pool exhausted', {
  database: 'users',
  activeConnections: 100,
});
\`\`\`

---

## Linear Project Management

### Overview
- Linear is used for project management and issue tracking
- Linear is integrated via MCP (Model Context Protocol)
- **Always follow the rules** defined in \`.windsurf/rules/project-management.md\`

### Label Structure
Every Linear ticket must have labels from these three groups:

**Type** (What kind of work):
- \`Bug\` - Fixing existing functionality
- \`Feature\` - New functionality or capabilities  
- \`Refactor\` - Code improvements, technical debt, performance
- \`Task\` - General work items, research, setup

**Product Area** (What part of the application):
- \`Analytics & Reporting\` - Dashboards, metrics, reporting features
- \`Application Settings\` - System/admin configuration
- \`Authentication\` - Login, signup, password management
- \`Billing & Payments\` - Payment processing, subscriptions, invoicing
- \`Notifications\` - Email, in-app, push notifications
- \`Onboarding\` - User signup flow, initial setup
- \`Search\` - Search functionality and filters
- \`User Preferences\` - App settings (theme, language, personal preferences)
- \`User Profile\` - Public user profiles, team member visibility

**Focus** (Primary area of concern):
- \`Accessibility\` - Screen readers, keyboard navigation, WCAG compliance
- \`APIs & Integrations\` - Third-party services, external APIs
- \`Code Quality\` - Refactoring, code cleanup, maintainability
- \`Database\` - Queries, migrations, data management
- \`DevOps\` - CI/CD, deployment, monitoring
- \`Documentation\` - Technical docs, user guides, specifications
- \`Infrastructure\` - Servers, hosting, networking
- \`Localization / Internationalization\` - Multi-language support
- \`Performance\` - Speed optimization, caching, efficiency
- \`Security\` - Authentication, authorization, data protection
- \`Testing / QA\` - Test writing, automation, quality assurance
- \`UI / UX Enhancement\` - User interface improvements, user experience

### Ticket Creation Guidelines
- **Confirm before creating tickets** unless explicitly instructed otherwise
- **Include clear acceptance criteria** with functional and non-functional requirements
- **Choose appropriate labels** from all three required groups
- **Set meaningful priorities**: No Priority, Low, Medium (default), High, Urgent
- **Reference the AI rules** in \`.windsurf/rules/project-management.md\` for detailed guidance

---

## Safety Rules

### ALWAYS Follow Existing Patterns
- **CRITICAL: ALWAYS FOLLOW EXISTING PATTERNS. RESEARCH CODE PATHS IF YOU NEED TO FIRST.**
- Before writing ANY new code — UI, server, schema — first map the existing code paths that solve the same or adjacent problem and follow them exactly.
- Reports/tables: ALWAYS use `Report` from `components/data/report.tsx` driven by `getReportData` in `lib/reporting/data.ts`. If a new model needs reporting, EXTEND the union in those files; do not build a parallel pipeline.
- Pages: ALWAYS wrap content in `Page` + `PageHeader` from `components/layout/page.tsx`.
- Tabs: match the existing tab placement on similar pages — do not reinvent.
- NEVER hand-roll UI primitives (`<table>`, custom pagination, custom status pills) when shared components exist.
- If your draft diverges from the existing pattern, STOP and either match the pattern or explicitly justify the divergence to the user before continuing.

### Plan Board Work Discipline
- Agents may have only one ticket in `IN_PROGRESS` at a time.
- Before claiming another ticket, the agent must move its current ticket to `DONE` or `BLOCKED` through the plan-board API with a clear status message.
- Do not claim or start parallel tickets under the same agent handle unless Steven explicitly assigns a handoff or override.

### Git Safety
- **Commit work frequently** — never leave large amounts of work uncommitted
- **NEVER run `git stash`** on files you didn't create or modify — you will lose the user's uncommitted work
- **NEVER run `git checkout -- .`**, `git reset --hard`, or any command that discards uncommitted changes
- **NEVER run `git revert`** without explicit user approval
- If you need to check something against a clean state, use `git diff` or `git show` instead of stashing
- Always assume there is uncommitted work in the working tree that you cannot lose

### Process Management
- **NEVER use \`pkill\` or similar commands** that could kill processes beyond this project
- **NEVER kill Next.js servers** with broad process killing commands - the user may have multiple apps running
- If you need to restart the dev server, ask the user to do it manually
- Only use process commands that are specific to files or directories within this project


## CLI Tools Over MCP

- When CLI-based tools (e.g., playwright-cli skills) are available in the project, prefer using them over MCP-based equivalents. CLI tools run locally, are faster, more reliable, and do not depend on external MCP server availability.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

404: Not Found