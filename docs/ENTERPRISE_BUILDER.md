# Configure System (Enterprise Builder architecture)

Evolve this monorepo in-place into a metadata-driven **Configure System** platform: reuse auth, org guard, forms, grids, IAM, dashboards, and audit; introduce a Platform shell and **Project** model, with **real per-project Postgres databases** for Access Management.

## Decision

| Choice | Detail |
| --- | --- |
| Approach | Evolve the existing monorepo (not a greenfield rewrite) |
| Product name | **Configure System** — **Project** = UX/API name for existing `Organization` |
| DB table | Keep `organizations` (avoid risky rename migration) |
| Platform DB | `DATABASE_URL` / typically `configure_system` on `:5435` |
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
- Organization / Project metadata (name, logo, status, theme, `databaseName`, `connectionString`, `enabledFeatures`, `featureSubscriptions`, …)
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

## Concept map

| Legacy concept | Configure System |
| --- | --- |
| Organization | **Project** (tenant / product instance) |
| Org switcher | Project switcher |
| Organization settings page | Projects list + Create Project wizard + project settings |
| Forms / Grids builders | Form / Grid engines (still platform DB + orgId for now) |
| IAM menus / roles / permissions | **Project DB** when provisioned |
| Feature marketplace | `enabledFeatures[]` (installed) + `featureSubscriptions[]` (premium unlock) on org; AppShell filters menus by install; Chat/Calls route to subscribe until granted |
| Login page settings | **Project DB** `LoginPageConfig` at `/{slug}/settings/login` (visible under project **Configuration** when `login-page` is installed; default on new projects) |
| Project public login | `/:projectSlug/login` (slug, code, or subdomain); after login → `/{slug}/dashboard`. Preview from Login page settings. Legacy `/p/:slug/login` redirects. |
| Project workspace URLs | After project login, in-app pages live under `/{slug}/…` (e.g. `/{slug}/users`, `/{slug}/features`). Platform Project Dashboard stays at `/app/projects`. |
| Platform vs project IA | `/app/*` shows **Administration** above **Projects**. Project `/{slug}` hides the Administration group; keeps Access / Configuration / domain menus. |

## Project themes

Each project stores `Organization.theme` (platform DB) and optional `LoginPageConfig.theme` / `primaryColor` (project DB). Presets live in `@dms/shared` (`PROJECT_THEME_PRESETS`):

| Preset | Feel |
| --- | --- |
| `default` | Configure System — teal accent, neutral chrome |
| `hospital` | Clinical whites, medical teal, calm trust |
| `school` | Academic navy + warm gold |
| `dms` (`dealer` / `mahindra` aliases; theme id kept) | Charcoal industrial, steel blue + amber |

On `/{slug}/…` and `/{slug}/login`, the web app sets `data-theme` + CSS variables on `document.documentElement` (platform `/app/*` stays `default`). Create Project / Project settings / Login page settings expose the preset dropdown. Seeds set hospital → `hospital`, school → `school`, Mahindra → `dms`.

## What works now

| Area | Behavior |
| --- | --- |
| Project Dashboard | Cards from platform org metadata |
| Add Project wizard | Metadata + `databaseName` + **project admin** (name, email, password); creates exactly one `OrganizationMember` OWNER + project-DB user with IAM `ADMIN`; returns credentials once |
| DB provisioning | `CREATE DATABASE` → `prisma db push` (project schema) → seed IAM + LoginPageConfig + **that** project admin user; stores `connectionString` |
| Open project | Platform membership check (or platform-admin bypass); IAM/Users/Login page read/write **project DB** |
| Feature marketplace | Install/uninstall updates `enabledFeatures`; premium features (chat, calls) also need `featureSubscriptions` (mock checkout or admin grant). Default install on create: `dashboard`, `users`, `roles`, `login-page` only. |
| Forms / Grids / Chat | Still platform DB + `organizationId` (documented follow-up) |
| **Menu Builder** | `/{slug}/menus` — create parent/submenu hierarchy; link a Dynamic Form via `Menu.formId` |
| **Form-linked nav** | Sidebar item with `formId` opens `/{slug}/data/:formId` records grid; **Add** creates a submission |
| **Subscription paywall** | `/{slug}/features/subscribe/:code` — mock Stripe checkout; unlocks premium feature for that project |

### Form → Menu → Grid flow

1. Build & publish a form under **Forms** (`/{slug}/forms`).
2. Open **Menus** (`/{slug}/menus`): create parent e.g. **Sale** (no form), then submenu **Stock** under it and **Link to form**.
3. Sidebar shows **Sale → Stock**; click **Stock** → records grid; **Add** opens the dynamic form and creates a submission.

Menus with `formId` use path `/app/data/:formId` (resolved to `/{slug}/data/:formId`). Parent menus may omit `path` and act as folders. `/app/data/*` is allowed when the **forms** feature is installed; Menu Builder is the **menu-builder** feature.

## Project admin (one per new project)

On **Create Project** (`POST /organizations`), platform Configure System admins must supply a **project admin** (`adminFirstName`, `adminLastName`, `adminEmail`, optional `adminPassword`):

1. Create (or reuse) **one** platform `User` for that email — never add the platform operator as a member.
2. Create `Organization` with `ownerId` = that user and **exactly one** `OrganizationMember` (`OWNER`).
3. Provision project DB → upsert that user + OWNER membership → seed IAM (`ADMIN` + `MEMBER` roles, menus, permissions) and attach the owner to `ADMIN`.
4. Default `enabledFeatures`: `dashboard`, `users`, `roles`, `login-page`. Project admin installs more later via Features.
5. Response includes `projectAdmin` (email, password once, `loginUrl` = `/{slug}/login`).

Hospital/school **demo seeds** may still create multiple users; the one-admin rule applies to the create-project wizard/API path only.

Platform admins list all projects on `/app/projects` without membership. Day-to-day roles/users/permissions/features are managed by the project admin inside `/{slug}/…` (Access + Configuration menus — no platform Administration group).

## How to test

Prerequisites: Postgres via docker-compose (`configure` DB role can `CREATE DATABASE`), `DATABASE_URL` pointing at `configure_system`, API + web running.

1. **Login platform** → land on Projects dashboard (platform DB).
2. **Create project** → fill project admin name/email/password → check API response `databaseProvisioned: true` and `projectAdmin.loginUrl`; on Postgres: `\l` should list `{databaseName}`; org has **one** OWNER member (the project admin).
3. **Login as project admin** → open `/{slug}/login` with those credentials → manage Users, Identity & Access, Features.
4. **Open project (platform)** → enter `/{slug}/dashboard` as platform admin (bypass) or as project admin; Users / IAM / Login page mutate the **project** database.
5. **Features** → install/uninstall updates platform `enabledFeatures`; menus for installed features appear when present in project DB menus. Premium features open `/{slug}/features/subscribe/:code` until subscribed.
6. **Administration** → visible on `/app/projects` (platform shell) above Projects; **not** shown inside hospital/school/`/{slug}` workspaces. Login page lives under project **Configuration**.

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

Full workflow/report builders rewrite, real Stripe billing (mock checkout + `featureSubscriptions` is in place), social login, subdomain DNS routing (path-based `/:slug/login` is supported).
