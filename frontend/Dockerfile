# The Hoot web server: Caddy with the built frontend, passing /api/* to the backend.
# Built from the repo root: docker compose build (see docs/deployment.md).
FROM node:24-slim AS build

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM caddy:2

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /frontend/dist/frontend/browser /srv
