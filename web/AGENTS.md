# Repository Guidelines

## Project Structure & Module Organization
- Framework: Next.js 15 (App Router) with React 19 and TypeScript.
- Routes live in `src/app/` (e.g., `edit/`, `model/`, `settings/`, `workflow/`). API routes under `src/app/api/*`.
- Reusable UI in `src/components/` (e.g., `components/ui/`); utilities in `src/lib/`.
- Static assets in `public/`. Prefer colocating imported assets near usage within `src/`.
- Config at repo root: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`.
- Env files: `.env.local` (not committed) with examples in `.env.local.example`.

## Build, Test, and Development Commands
- `npm ci`: Install dependencies from lockfile.
- `npm run dev`: Start Next dev server (Turbopack, hot reload).
- `npm run build`: Production build to `.next/` (Turbopack).
- `npm start`: Serve the built app.
- `npm run lint`: Run ESLint (flat config). Use `npm run lint -- --fix` to auto-fix.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; keep lines ≤ 100–120 chars.
- TypeScript: prefer strict, explicit types for public functions and component props.
- Components: Server Components by default; add `"use client"` only when necessary. One component per file.
- Naming: `PascalCase` for React components/types; `camelCase` for vars/functions; route segment folders lowercase (e.g., `src/app/product-details`).
- Keep changes focused; update docs when altering behavior.

## Testing Guidelines
- No test runner is configured yet. If adding tests, propose Vitest (unit) and Playwright (e2e) via issue/PR first.
- Suggested layout: `src/**/__tests__/*.(test|spec).ts(x)`, colocated near code.
- For logic changes, include basic unit tests and note manual QA steps in the PR.

## Commit & Pull Request Guidelines
- Commits: use Conventional Commits (e.g., `feat: add product grid`, `fix: correct price parser`). Keep changes atomic.
- PRs: include a clear description, linked issues, screenshots for UI, and notes on env/config changes.
- Verify locally before opening PR: `npm run lint` and `npm run build` should pass.

## Security & Configuration Tips
- Client-exposed env vars must start with `NEXT_PUBLIC_`; keep secrets server-side only.
- Never commit `.env.local`. Rotate any leaked tokens immediately.
- Image processing uses `sharp`; develop on Node 18/20+, and review dependency bumps carefully.
