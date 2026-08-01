# syntax=docker/dockerfile:1

FROM node:25-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm install --workspace=@dms/web --workspace=@dms/shared --include-workspace-root
COPY . .
RUN npm run build -w @dms/shared && npm run build -w @dms/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
