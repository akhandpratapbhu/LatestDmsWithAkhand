# syntax=docker/dockerfile:1

FROM node:25-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm install --workspace=@dms/api --workspace=@dms/shared --include-workspace-root

FROM node:25-alpine AS build
WORKDIR /app
ENV DATABASE_URL="postgresql://dms:dms_secret@localhost:5432/dms?schema=public"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w @dms/shared
RUN npm run prisma:generate -w @dms/api
RUN npm run build -w @dms/api

FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
