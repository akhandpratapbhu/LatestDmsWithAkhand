# Enterprise Builder

Evolve **fullcursorDMS** in-place into a metadata-driven **Enterprise Builder** platform: reuse auth, org guard, forms, grids, IAM, dashboards, and audit; introduce a Platform shell and **Project** model, with **real per-project Postgres databases** for Access Management.

## Decision

| Choice | Detail |
| --- | --- |
| Approach | Evolve the existing monorepo (not a greenfield rewrite) |
| Product name | **Project** = UX/API product name for existing `Organization` |
| DB table | Keep `organizations` (avoid risky rename migration) |
| Platform DB | `DATABASE_URL` / typically `dms` on `:5435` |
| Project DB | One Postgres DB per project (`databaseName` / `connectionString`) |

## Two-database tenancy (current)

```text
User → Platform Shell → Projects list / Features / Create Project  (platform DB)
                      → Open Project → Users / IAM / Login page     (project DB)
                      → Forms / Grids / Chat / Calls / …            (platform DB + organizationId)
```

### Platform database (`schema.prisma`)

Stores **only** (for tenancy purposes):

- Platform users + auth (sessions, refresh tokens, login history)
- Organization / Project metadata (name, logo, status, theme, `databaseName`, `connectionString`, `enabledFeatures`, …)
- `OrganizationMember` — who may **open** which projects
- Still-shared business tables: Forms, Grids, Chat, Calls, Masters, Notifications, Audit (scoped by `organizationId`)

### Project database (`schema-project.prisma`)

One physical DB per project. Holds **project-scoped** Access Management:

- Users (same UUID as platform user when linked via `platformUserId`)
- OrganizationMember / roles / permissions / menus / MemberRole
- LoginPageConfig (branding + auth method flags)
- Seeded dashboards / landing pages used by IAM sidebar

Prisma clients:

| Schema | Client |
| --- | --- |
| `apps/api/prisma/schema.prisma` | `@prisma/client` (platform) |
| `apps/api/prisma/schema-project.prisma` | `@dms/project-client` (generated into `node_modules`) |

Runtime switching: `ProjectDbService.getClient(orgId)` caches a `PrismaClient` per `connectionString`. IAM, Users (list/create inside project), and Login page config prefer the project client when available; otherwise they fall back to the platform DB (legacy orgs).

## What maps from DMS today

| DMS concept | Enterprise Builder |
| --- | --- |
| Organization | **Project** (tenant / product instance) |
| Org switcher | Project switcher |
| Organization settings page | Projects list + Create Project wizard + project settings |
| Forms / Grids builders | Form / Grid engines (still platform DB + orgId for now) |
| IAM menus / roles / permissions | **Project DB** when provisioned |
| Feature marketplace | `enabledFeatures[]` on org (platform) filters AppShell menus |
| Login page settings | **Project DB** `LoginPageConfig` at `/{slug}/settings/login` |
| Project public login | `/:projectSlug/login` (slug, code, or subdomain); after login → `/{slug}/dashboard`. Preview from Login page settings. Legacy `/p/:slug/login` redirects. |
| Project workspace URLs | After project login, in-app pages live under `/{slug}/…` (e.g. `/{slug}/users`, `/{slug}/features`). Platform Project Dashboard stays at `/app/projects`. |

## What works now

| Area | Behavior |
| --- | --- |
| Project Dashboard | Cards from platform org metadata |
| Add Project wizard | Metadata + `databaseName`; creates platform membership (OWNER) |
| DB provisioning | `CREATE DATABASE` → `prisma db push` (project schema) → seed IAM + LoginPageConfig + project admin user; stores `connectionString` |
| Open project | Platform membership check; IAM/Users/Login page read/write **project DB** |
| Feature marketplace | Install/uninstall updates platform `enabledFeatures`; sidebar filtered by catalog paths |
| Forms / Grids / Chat | Still platform DB + `organizationId` (documented follow-up) |

## How to test

Prerequisites: Postgres via docker-compose (`dms` user can `CREATE DATABASE`), `DATABASE_URL` pointing at it, API + web running.

1. **Login platform** → land on Projects dashboard (platform DB).
2. **Create project** → check API response `databaseProvisioned: true`; on Postgres: `\l` should list `{databaseName}`; org row has `connectionString`.
3. **Open project** → enter `/{slug}/dashboard`; Users / IAM / Login page (`/{slug}/settings/login`) mutate the **project** database (not `dms` IAM tables for that org’s runtime path).
4. **Hospital (or any) project login** → Open `/{slug}/login` (e.g. `/hospital-management/login`) → after sign-in land on `/{slug}/dashboard`. Or from Login page settings → **Preview login page**.
5. **Features** → install/uninstall updates platform `enabledFeatures`; menus for installed features appear when present in project DB menus.

Commands:

```bash
npm run build -w @dms/shared
npm run build -w @dms/api
npm run build -w @dms/web

# Platform schema
cd apps/api && npm run prisma:generate && npm run prisma:push

# Project schema generate (also run by prisma:generate)
npm run prisma:push:project   # only useful against a specific DATABASE_URL
```

## Phased roadmap

### Phase 0–1 — Product rename + Project = Organization *(done)*

### Phase 2a — Feature marketplace *(done)*

### Phase 2b — Real DB runtime *(done for IAM / Users / Login page)*

Remaining:

- Move Forms / Grids / Chat / Calls / Masters into project DBs
- Encrypt `connectionString` at rest
- Connection health registry

### Phase 3–7 — Engines

Form / Grid / Workflow / Report builders against project data stores.

## Out of scope (this pass)

Full workflow/report builders rewrite, billing, social login, subdomain DNS routing (path-based `/:slug/login` is supported).
