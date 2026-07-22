# Fullcursor DMS

Monorepo Document Management System — **Phase 0 (foundation)** and **Phase 1 (authentication)** complete.

## Stack

| Layer       | Tech                      |
| ----------- | ------------------------- |
| Monorepo    | npm workspaces            |
| Frontend    | React + Vite + TypeScript |
| Backend     | NestJS + Prisma           |
| DB          | PostgreSQL 16             |
| Cache / OTP | Redis 7                   |
| Mail (dev)  | MailHog                   |
| Containers  | Docker Compose            |
| API docs    | Postman collection        |

## Quick start

Postgres is mapped to host port **5435** (avoids conflicts with other local Postgres instances).

```bash
# 1. Env
cp .env.example .env

# 2. Infrastructure
npm run docker:up
# starts postgres (:5435), redis, mailhog

# 3. Install
npm install

# 4. Shared types + Prisma
npm run build -w @dms/shared
npm run db:generate
npm run db:push

# 5. Run API + Web (two terminals)
npm run dev:api
npm run dev:web
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1/health
- MailHog UI: http://localhost:8025

## Auth features

- Register / Login / Logout
- JWT access tokens + rotating refresh tokens
- Forgot / Reset password
- Email verification (+ resend)
- OTP login (Redis-backed)
- Session listing & revoke
- Multi-device login (max devices via `MAX_LOGIN_DEVICES`)

In development with `EMAIL_ENABLED=false`, emails (OTP, reset, verify) are printed to the API console.

## Project structure

```
apps/
  api/          NestJS backend
  web/          React frontend
packages/
  shared/       Shared TypeScript contracts
postman/        API collection
docs/           Coding standards
.github/        CI skeleton
```

## Scripts

| Command             | Description                |
| ------------------- | -------------------------- |
| `npm run dev:api`   | NestJS watch mode          |
| `npm run dev:web`   | Vite dev server            |
| `npm run docker:up` | Postgres + Redis + MailHog |
| `npm run db:push`   | Push Prisma schema         |
| `npm run build`     | Build all workspaces       |

## CI/CD (GitHub Actions)

- **CI** on every PR/push: lint, build, auth smoke test, Docker build check
- **CD** on `main` / tags `v*`: push images to GHCR + staging/production deploy hooks

Full setup guide: [docs/CICD.md](docs/CICD.md)

## Postman

Import `postman/DMS-Auth.postman_collection.json`. Login requests auto-save tokens into collection variables.

## Coding standards

See [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md).

## Full Docker stack (optional)

```bash
docker compose --profile full up --build
```
# DMSWithAkhand
