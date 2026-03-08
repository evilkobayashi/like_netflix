# Tenant Model
All tenant-owned tables include `tenantId`, `createdAt`, and `updatedAt`. Tenant context comes from JWT claims and is enforced in queries.
