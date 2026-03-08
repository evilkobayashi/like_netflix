# Local Development

## Prerequisites
- Docker + Docker Compose

## Start
1. `docker compose up --build`
2. Wait for `platform-init` to complete schema push + seed.
3. Access services:
   - API Gateway: `http://localhost:3000/health`
   - Web Login: `http://localhost:5173/login`
   - Nginx unified endpoint: `http://localhost:8080`

## Demo credentials
All accounts use password `Password123!` and tenant `demo-tenant`:
- `admin@demo.local`
- `manager@demo.local`
- `finance@demo.local`
- `employee@demo.local`

## Verify login + dashboard manually
1. Open `http://localhost:5173/login`
2. Sign in with `admin@demo.local` / `Password123!`
3. Confirm Dashboard loads KPIs (`Active Users`, `Pending Approvals`, `Automation Success`).
