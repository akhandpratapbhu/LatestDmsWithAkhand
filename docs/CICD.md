# GitHub CI/CD

## Pipelines

| Workflow       | File                       | When                                 | What                                                      |
| -------------- | -------------------------- | ------------------------------------ | --------------------------------------------------------- |
| **CI**         | `.github/workflows/ci.yml` | PR + push to `main`/`develop`        | Build API, Build Web, Docker verify   |
| **CD**         | `.github/workflows/cd.yml` | Push to `main`/`develop`, tags, manual | Build & push images to GHCR, deploy |
| **Dependabot** | `.github/dependabot.yml`   | Weekly                               | npm + Actions + Docker base image PRs |

## CI jobs

All defined in **`.github/workflows/ci.yml`**:

1. **Build API** — `working-directory: apps/api` → `npm run build`
2. **Build Web** — `working-directory: apps/web` → `npm run build`
3. **Docker build (verify)** — validates Dockerfiles (no push)
4. **CI Result** — passes only if both app builds succeeded

### How to remove a check yourself

1. Open `.github/workflows/ci.yml`
2. Delete the whole `job` block (e.g. `quality:` or `smoke:`)
3. If `ci-result` has `needs: [...]`, remove that job name from the list
4. Commit + push — next Actions run will no longer show that check

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
- Require status checks: `Build API`, `Build Web`, `CI Result`
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
