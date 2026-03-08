# Local Development

## Prerequisites
- Docker + Docker Compose

## Start
1. `docker compose up --build`
2. Wait for `platform-init` to complete schema push + seed.
3. Access services:
   - API Gateway: `http://localhost:3000/health`
   - Web: `http://localhost:5173`
   - Nginx unified endpoint: `http://localhost:8080`

## Seeded credentials
- Tenant: `demo-tenant`
- Admin: `admin@demo.local` / `Password123!`
