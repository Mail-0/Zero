# Agent Configuration for Zero Email

Zero is an open-source AI email solution built with a modern TypeScript/Next.js stack in a monorepo setup.

## Project Structure

This is a pnpm workspace monorepo with the following structure:
- `apps/mail/` - Next.js frontend email client
- `apps/server/` - Backend server
- `apps/ios-app/` - iOS mobile app
- `packages/cli/` - CLI tools (`nizzy` command)
- `packages/db/` - Database schemas and utilities
- `packages/eslint-config/` - Shared ESLint configuration
- `packages/tailwind-config/` - Shared Tailwind configuration
- `packages/tsconfig/` - Shared TypeScript configuration

## Frequently Used Commands

### Development
- `pnpm go` - Quick start: starts database and dev servers
- `pnpm dev` - Start all development servers (uses Turbo)
- `pnpm docker:db:up` - Start PostgreSQL database in Docker
- `pnpm docker:db:down` - Stop and remove database container
- `pnpm docker:db:clean` - Stop and remove database with volumes

### Build & Deploy
- `pnpm build` - Build all packages (uses Turbo)
- `pnpm build:frontend` - Build only the mail frontend
- `pnpm deploy:frontend` - Deploy frontend
- `pnpm deploy:backend` - Deploy backend

### Code Quality
- `pnpm check` - Run format check and lint
- `pnpm lint` - Run ESLint across all packages
- `pnpm format` - Format code with Prettier
- `pnpm check:format` - Check code formatting

### Database
- `pnpm db:push` - Push schema changes to database
- `pnpm db:generate` - Generate migration files
- `pnpm db:migrate` - Apply database migrations
- `pnpm db:studio` - Open Drizzle Studio

### Testing & Evaluation
- `pnpm test:ai` - Run AI tests
- `pnpm eval` - Run evaluation suite
- `pnpm eval:dev` - Run evaluation in dev mode
- `pnpm eval:ci` - Run evaluation in CI mode

### Utilities
- `pnpm nizzy env` - Setup environment variables
- `pnpm nizzy sync` - Sync environment variables and types
- `pnpm scripts` - Run custom scripts

## Tech Stack

- **Frontend**: Next.js, React 19, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Node.js, tRPC, Drizzle ORM
- **Database**: PostgreSQL
- **Authentication**: Better Auth, Google OAuth
- **Package Manager**: pnpm (v10+)
- **Build Tool**: Turbo
- **Linting**: ESLint, Oxlint, Prettier

## Code Style & Conventions

### Formatting
- 2-space indentation
- Single quotes
- 100 character line width
- Semicolons required
- Uses Prettier with sort-imports and Tailwind plugins

### File Organization
- TypeScript strict mode enabled
- Workspace packages use catalog versioning for shared dependencies
- Monorepo managed with pnpm workspaces

### Important Environment Variables
- `BETTER_AUTH_SECRET` - Auth secret key
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - Gmail integration
- `AUTUMN_SECRET_KEY` - Encryption service
- `TWILIO_*` - SMS integration
- `DATABASE_URL` - PostgreSQL connection string

## Development Setup

1. Install dependencies: `pnpm install`
2. Setup environment: `pnpm nizzy env`
3. Sync environment: `pnpm nizzy sync`
4. Start database: `pnpm docker:db:up`
5. Initialize database: `pnpm db:push`
6. Start development: `pnpm dev`

## Common Workflow

1. Always run `pnpm check` before committing
2. Use `pnpm nizzy sync` after environment variable changes
3. Run `pnpm db:push` after schema changes
4. Use `pnpm go` for quick development startup

## Notes

- Uses Husky for git hooks
- Integrates with Sentry for error tracking
- Uses Cloudflare Workers for backend deployment
- iOS app is part of the monorepo
- CLI tool `nizzy` helps manage environment and sync operations
