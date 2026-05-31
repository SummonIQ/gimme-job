# Gimme Job

Gimme Job is a private job-search operating system built with Next.js. It
combines job lead management, resume tooling, interview prep, networking,
application tracking, notifications, and agent coordination workflows.

## Current Stack

- Runtime and package manager: Bun
- Framework: Next.js 16 App Router with React 19
- Language: TypeScript
- Styling: Tailwind CSS 4, shadcn/ui, Radix UI, and lucide-react
- Database: PostgreSQL through Prisma 7 and `@prisma/adapter-pg`
- Authentication: Better Auth with session-based auth
- AI: Vercel AI SDK 6 with OpenAI and Google provider adapters
- Realtime: Pusher plus SummonFlow client support for admin workflows
- Observability: Sentry, Vercel Analytics, and Vercel Speed Insights
- Testing: Vitest, Testing Library, jest-axe, and Playwright e2e tests

## Requirements

- Bun 1.x
- A PostgreSQL database available through `DATABASE_URL`
- Local environment values in `.env` or `.env.local`

Next.js still uses the Node.js runtime under the hood, but project commands
are run with Bun.

## Environment

At minimum, local development needs database and auth settings. Feature-specific
areas need their own provider keys:

- `DATABASE_URL` for Prisma and PostgreSQL
- Better Auth secrets and public URL settings
- AI provider keys for OpenAI or Google-backed features
- Pusher keys for notification realtime features
- SummonFlow app and publish keys for the admin plan board realtime channel
- Sentry and Vercel settings when testing observability locally

Keep secrets in local environment files or the deployment provider. Do not add
secret values to source control.

## Install And Run

```bash
bun install
bun db:push       # creates schema on a fresh database
bun db:generate
bun dev
```

Open [http://localhost:10100](http://localhost:10100) after the dev server
starts. To launch the desktop runtime alongside the web app, run
`bun run desktop:dev` from a second terminal.

## Useful Commands

- `bun dev` - start the Next.js dev server on port 10100
- `bun build` - generate Prisma client and build the app
- `bun start` - start the production server on port 10100
- `bun lint` - run ESLint
- `bun test` - run the Vitest suite
- `bun test:a11y` - run accessibility-focused tests
- `bun test:e2e` - run Chromium Playwright e2e tests
- `bun run desktop:dev` - launch the Electron desktop runtime
- `bun db:generate` - generate the Prisma client
- `bun db:migrate` - run development migrations and regenerate Prisma
- `bun db:push` - push the Prisma schema and regenerate Prisma
- `bun db:studio` - open Prisma Studio on port 10101
- `bun deps:check` - inspect dependency updates with npm-check-updates

## Project Layout

```text
app/              Next.js App Router routes and API handlers
components/       Shared React components and UI primitives
desktop/          Electron + Vite + React workspace for the local runtime
lib/              Domain logic, integrations, auth, db, and services
prisma/           Prisma schema, generated client output, and migrations
public/           Static assets
scripts/          Project setup, ingestion, and maintenance scripts
types/            Shared TypeScript declarations
```

## Core Product Areas

- Job discovery, lead tracking, and application pipeline management
- Resume parsing, analysis, optimization, revisions, and sharing
- Job fit, skill gap, and interview preparation workflows
- Contact and networking workflows tied to job leads
- Dashboard analytics, reporting, reminders, and notifications
- Admin plan board for coordinating agents against `FINAL_PLAN.md`

## Admin Plan Board

The admin plan board lives at `/admin/plan-board`. It stores ticket state in
PostgreSQL through Prisma and exposes updates through the admin API. Realtime
cross-window updates require the SummonFlow app key in the browser environment
and a publish token on the server.

Agents should claim or start only tickets assigned to their handle or explicitly
named by the project owner, keep ticket notes current, and move work through
Todo, In Progress, Blocked, and Done as the live state changes.

## Testing Notes

Use focused checks for the area being changed. For shared behavior, run the
broader Vitest or lint suites before handing off. The e2e scripts are available
for functional browser checks, but visual verification is handled by the project
owner for UI-only adjustments.

## Deployment Notes

Production deployments need the same database, auth, AI, realtime, and
observability environment variables configured in the hosting provider. Run
Prisma migrations before deploying schema-dependent code.
