# Coding Standards

## Monorepo

- Apps live under `apps/` (`api`, `web`).
- Shared types/contracts live under `packages/shared`.
- Prefer workspace scripts from the root (`npm run dev:api`, `npm run dev:web`).

## TypeScript

- Strict mode is required.
- Prefer explicit return types on public service methods.
- Avoid `any`; use `unknown` and narrow.
- Prefer named exports for modules; default exports only for React page components when needed by the router.

## NestJS (`apps/api`)

- Feature modules under `src/modules/<feature>`.
- Keep controllers thin; business logic in services.
- Validate all inbound DTOs with `class-validator`.
- Throw NestJS HTTP exceptions; the global filter formats the response.
- Secrets and env values only via `ConfigService` — never hardcode.

## React (`apps/web`)

- Feature folders under `src/features/<feature>`.
- Shared UI under `src/components`.
- API calls only through `src/lib/api`.
- Auth state via `AuthProvider` — do not duplicate token storage.

## Git / PRs

- Small, focused commits.
- Conventional commit style: `feat:`, `fix:`, `chore:`, `docs:`.
- Do not commit `.env` or secrets.
