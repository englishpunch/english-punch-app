# GitHub Copilot Instructions for English Punch

This repository contains comprehensive instructions for GitHub Copilot to provide optimal assistance on this project.

## Project Overview

**English Punch 🥊** is a spaced repetition learning application for English language learning, built with modern web technologies. The name "Punch" represents the commitment to daily learning, like going to a boxing gym every day.

### Core Concept
- Uses the FSRS (Free Spaced Repetition Scheduler) algorithm for intelligent review scheduling
- Provides fill-in-the-blank style English sentence learning
- Offers personalized learning experiences with adaptive difficulty

## Technology Stack

### Frontend
- **React 19** with React Compiler for optimized rendering
- **TanStack Router** (v1.139+) for file-based routing with full type safety
- **Tailwind CSS v4** for styling with mobile-first design
- **TypeScript 5.9+** with strict mode enabled
- **Vite 7** as the build tool
- **Vitest** for unit testing with happy-dom environment

### Backend
- **Convex** for reactive backend (real-time database, serverless functions, WebSocket)
- **Convex Auth** for authentication with Google OAuth support

### Desktop Platform
- **Tauri v2** for lightweight native desktop applications

### Key Libraries
- `ts-fsrs` - TypeScript implementation of FSRS algorithm
- `lucide-react` - Icon library (prefer over emoji)
- `@tanstack/react-table` - For data tables
- `sonner` - For toast notifications
- `zod` - For schema validation

## Project Structure

```
/
├── src/                    # Frontend source code
│   ├── routes/            # TanStack Router file-based routes
│   ├── components/        # React components
│   ├── lib/              # Utility libraries
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   └── scripts/          # Utility scripts
├── convex/                # Convex backend functions and schema
├── src-tauri/            # Tauri desktop app configuration
├── docs/                 # Documentation
│   ├── design-principles.md
│   ├── git-commit-guildelines.md
│   ├── convex.md
│   ├── tauri-v2.md
│   └── tailwind-v4-llms_txt-prompt-tower.md
└── AGENTS.md            # Vibe-rules coding standards

```

## Development Commands

### Essential Commands
```bash
# Start development (runs both frontend and backend)
npm run dev

# Run frontend only
npm run dev:frontend

# Run backend only (Convex)
npm run dev:backend

# Build for production
npm run build

# Run Tauri desktop app in dev mode
npm run tauri dev

# Build Tauri app
npm run tauri build
```

### Code Quality
```bash
# Lint code (ESLint)
npm run lint

# Lint and auto-fix
npm run lint:fix

# Check code formatting (Prettier)
npm run format

# Run tests
npm run test

# Watch mode for tests
npm run test:watch

# Generate coverage report
npm run coverage

# Find unused dependencies and exports
npm run knip
```

## Coding Standards & Conventions

### General Guidelines (from AGENTS.md)

**Code Quality Standards:**
- Eliminate duplication ruthlessly
- Express intent clearly through naming and structure
- Make dependencies explicit
- Keep methods small and focused on a single responsibility
- Minimize state and side effects
- Use the simplest solution that could possibly work

**Tidy First Approach:**
- Separate changes into STRUCTURAL (refactoring) and BEHAVIORAL (new features)
- Never mix structural and behavioral changes in the same commit
- Always make structural changes first when both are needed

**React-Specific:**
- Always import `cn` from `src/lib/utils` instead of importing `clsx` directly
- Avoid calling setState directly inside React effects
- When `@typescript-eslint/no-misused-promises` reports Promise errors, prefix handler with `void`
- NEVER use `as any`; prefer `unknown` or precise types
- Prefer React 19 ref-as-prop: accept `ref` directly on function components (no `forwardRef`)

### TanStack Router Guidelines

- Use file-based routing in `src/routes/`
- Always apply TanStack Router rules in `src/**/*.ts` and `src/**/*.tsx` files
- Route files should export `Route` using `createFileRoute`
- The generated `routeTree.gen.ts` should be committed to git
- Prefer type-safe navigation using `Link` component or `useNavigate` hook

### Design Principles (from docs/design-principles.md)

**UI/UX:**
- One clear primary action per screen
- Mobile-first design; desktop is mobile view centered
- Do NOT change layout structure with responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`)

**Tailwind CSS v4:**
- Prefer core utilities: `text-sm/base/lg`, `gap-4`, `p-6`, `rounded-md/lg`
- Use existing primary palette for CTAs
- Focus styles: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400`

**Typography:**
- Headings: `text-3xl font-semibold` for hero, `text-2xl/xl` for sections
- Body: `text-base leading-6` for paragraphs, `text-sm leading-5` for labels
- Always show visible labels (no placeholder-only fields)

**Layout:**
- Constrain forms/cards with `max-w-md mx-auto`
- Comfortable breathing room: `py-16` around primary sections

**Feedback States:**
- Inputs: default `border-gray-300`, error `border-red-500 ring-1 ring-red-500`
- Disabled: `bg-gray-100 text-gray-400 cursor-not-allowed`
- Loading: use skeletons (`animate-pulse bg-gray-100 rounded`)
- Empty states: always show message with clear CTA

**Icons:**
- Use `lucide-react` icons instead of emoji

**Accessibility:**
- Maintain contrast ≥ 4.5:1
- Touch targets ≥ `h-11`/`min-w-[44px]`
- Logical tab order
- Never rely on color alone

### Git Commit Guidelines (from docs/git-commit-guildelines.md)

**Format:** `<type>(<scope>): <description>` in Korean

**Allowed Types:**
- `feat` - New features
- `fix` - Bug fixes
- `refactor` - Behavior-neutral structure changes only
- `chore` - Maintenance tasks
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `perf` - Performance improvements

## Environment Setup

### Required Environment Variables

Create a `.env.local` file:

```env
# Convex (auto-generated by npx convex dev)
VITE_CONVEX_URL=https://your-project.convex.cloud

# Google OAuth (for Convex Auth)
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
```

### Initial Setup

1. Install dependencies: `npm install`
2. Start Convex dev environment: `npx convex dev`
3. Configure Google OAuth in Google Cloud Console
4. Set environment variables in `.env.local`
5. Run dev server: `npm run dev`

## Testing

- Use **Vitest** for unit tests
- Test files: `*.test.ts` or `*.test.tsx`
- Setup file: `src/setupTests.ts`
- Environment: `happy-dom`
- Example test locations:
  - `src/lib/utils.test.ts`
  - `src/scripts/changePassword.test.ts`
  - `convex/fsrs.elapsed-days.test.ts`

## Common Patterns & Best Practices

### Import Aliases
- Use `@/` prefix for absolute imports from `src/` directory
- Example: `import { cn } from '@/lib/utils'`

### Convex Backend
- Backend functions are in `convex/` directory
- Schema definitions in `convex/schema.ts`
- FSRS-related logic in `convex/fsrs.ts`
- Auth configuration in `convex/auth.config.ts`

### Logging
- Use `getGlobalLogger` for standardized logging (mentioned in README tasks)

### Component Organization
- Reuse existing components from `src/components/` whenever possible
- Extend by composition before creating new components
- Button component example: `src/components/Button.tsx`

## Key Files to Reference

- **AGENTS.md** - Complete coding standards and refactoring guidelines
- **docs/design-principles.md** - UI/UX design system
- **docs/git-commit-guildelines.md** - Commit message format
- **docs/convex.md** - Convex backend documentation
- **docs/tauri-v2.md** - Tauri desktop app documentation
- **docs/tailwind-v4-llms_txt-prompt-tower.md** - Tailwind v4 guidance

## Special Considerations

### File-Based Routing
- Routes are auto-generated from `src/routes/` directory
- `routeTree.gen.ts` is generated automatically but should be committed
- Use `createFileRoute` for route definitions
- Type safety is automatic across the entire routing tree

### Convex Integration
- Real-time reactive data via WebSocket
- Serverless functions for backend logic
- Built-in authentication with Convex Auth
- See `convex/README.md` for details

### Desktop App (Tauri)
- Native app runs on port 1420 (fixed)
- Deep linking support via `@tauri-apps/plugin-deep-link`
- OAuth integration via `@fabianlars/tauri-plugin-oauth`
- See `docs/tauri-v2.md` for specifics

## Language Preference

- **Documentation:** Korean
- **Code comments:** English (when necessary)
- **Git commits:** Korean (following conventional commit format)
- **UI text:** Korean (for user-facing content)

## Additional Notes

- This is a monorepo-style project with frontend, backend, and desktop app
- Components.json exists but shadcn is NOT used
- React Compiler is enabled for automatic optimization
- Prefer functional components with hooks over class components
- Use Zod for runtime validation and type inference

---

**Last Updated:** 2026-01-03  
**Maintained by:** English Punch Team

For questions or suggestions about these instructions, please open an issue or discussion on GitHub.
