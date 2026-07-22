# GitHub CI/CD

## Pipelines

| Workflow       | File                       | When                                 | What                                                      |
| -------------- | -------------------------- | ------------------------------------ | --------------------------------------------------------- |
| **CI**         | `.github/workflows/ci.yml` | PR + push to `main`/`develop`        | Format, lint, build, auth smoke test, Docker build verify |
| **CD**         | `.github/workflows/cd.yml` | Push to `main`, tags `v*`, or manual | Build & push images to GHCR, deploy staging/production    |
| **Dependabot** | `.github/dependabot.yml`   | Weekly                               | npm + Actions + Docker base image PRs                     |

## CI jobs

1. **Lint & format** — Prettier + TypeScript checks
2. **Build apps** — Prisma generate/push against ephemeral Postgres/Redis, build shared/api/web, upload artifacts
3. **Auth smoke test** — Boots API and runs `scripts/ci-smoke.sh`
4. **Docker build** — Validates `apps/api` and `apps/web` Dockerfiles (no push)

## CD flow

```text
push main / tag v* / workflow_dispatch
        │
        ▼
  Build & push to GHCR
   ghcr.io/<owner>/<repo>/api
   ghcr.io/<owner>/<repo>/web
        │
        ├── main ──────────────► Deploy staging  (environment: staging)
        └── tag v* / manual ───► Deploy production (environment: production)
```

Images are always published when CD runs. Deploy steps call an optional webhook if configured.

## One-time GitHub setup

### 1. Create the repo and push

```bash
git init
git add .
git commit -m "chore: initial DMS foundation and auth"
gh repo create fullcursorDMS --private --source=. --remote=origin --push
# or create on github.com and: git remote add origin <url> && git push -u origin main
```

### 2. Environments

Repo → **Settings → Environments** → create:

- `staging`
- `production` (recommended: required reviewers)

### 3. Secrets & variables

| Name                        | Type     | Scope                    | Purpose                                |
| --------------------------- | -------- | ------------------------ | -------------------------------------- |
| `STAGING_DEPLOY_WEBHOOK`    | Secret   | Environment `staging`    | Optional POST hook after image publish |
| `PRODUCTION_DEPLOY_WEBHOOK` | Secret   | Environment `production` | Optional POST hook for prod            |
| `STAGING_APP_URL`           | Variable | Environment `staging`    | Shown on deploy status                 |
| `PRODUCTION_APP_URL`        | Variable | Environment `production` | Shown on deploy status                 |

`GITHUB_TOKEN` is enough for GHCR pushes (workflow already has `packages: write`).

### 4. Package visibility

After the first CD run, open **Packages** on the repo. For private images, grant the repo access under each package’s settings.

### 5. Branch protection (recommended)

For `main`:

- Require PR before merge
- Require status checks: `Lint & format`, `Build apps`, `Auth smoke test`, `Docker build (verify)`
- Restrict who can push

## Manual deploy

Actions → **CD** → **Run workflow** → choose `staging` or `production`.

## Versioned releases

```bash
git tag v0.1.0
git push origin v0.1.0
```

That triggers CD and the production deploy job (with environment approval if configured).

## Local smoke test

With API running:

```bash
bash scripts/ci-smoke.sh
```
