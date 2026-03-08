# Like Netflix Enterprise Platform

Production-style distributed internal operations platform monorepo.

## Quick start
```bash
docker compose up --build
```

### Access points
- API Gateway: `http://localhost:3000`
- Web App (Vite): `http://localhost:5173`
- Unified entry via Nginx: `http://localhost:8080`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

Database schema push and seed run automatically via `platform-init` service.

See `platform/docs` for architecture and operations guides.
