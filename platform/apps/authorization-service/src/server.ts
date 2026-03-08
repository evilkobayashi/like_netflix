import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { config } from '../../../packages/shared-config/src';
import { requirePermission } from '../../../packages/shared-auth/src';
import { publishEvent } from '../../../packages/shared-events/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => {
  await request.jwtVerify();
});

app.get('/roles', async (request) => {
  const tenantId = (request.user as { tenantId: string }).tenantId;
  return prisma.role.findMany({
    where: { tenantId },
    include: { permissions: { include: { permission: true } } }
  });
});

app.post('/roles', async (request) => {
  requirePermission(request, 'users:update');
  const tenantId = (request.user as { tenantId: string }).tenantId;
  const { name, description } = request.body as { name: string; description?: string };
  return prisma.role.create({ data: { tenantId, name, description } });
});

app.get('/permissions', async () => prisma.permission.findMany({ orderBy: { key: 'asc' } }));

app.post('/roles/:id/permissions', async (request) => {
  requirePermission(request, 'users:update');
  const tenantId = (request.user as { tenantId: string; sub: string; correlationId: string }).tenantId;
  const actorId = (request.user as { sub: string }).sub;
  const correlationId = (request.user as { correlationId: string }).correlationId;
  const roleId = (request.params as { id: string }).id;
  const { permissionIds } = request.body as { permissionIds: string[] };

  for (const permissionId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId, tenantId }
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId,
      action: 'permission.changed',
      resource: 'role',
      metadata: { roleId, permissionIds }
    }
  });

  await publishEvent({
    id: randomUUID(),
    type: 'role.assigned',
    tenantId,
    timestamp: new Date().toISOString(),
    correlationId,
    payload: { roleId, permissionIds }
  });

  return { success: true };
});

app.get('/groups', async (request) => {
  const tenantId = (request.user as { tenantId: string }).tenantId;
  return prisma.group.findMany({ where: { tenantId }, include: { members: true } });
});

app.post('/groups', async (request) => {
  requirePermission(request, 'users:update');
  const tenantId = (request.user as { tenantId: string }).tenantId;
  const { name } = request.body as { name: string };
  return prisma.group.create({ data: { tenantId, name } });
});

app.post('/groups/:id/members', async (request) => {
  requirePermission(request, 'users:update');
  const tenantId = (request.user as { tenantId: string }).tenantId;
  const groupId = (request.params as { id: string }).id;
  const { userId } = request.body as { userId: string };
  return prisma.groupMembership.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: {},
    create: { groupId, userId, tenantId }
  });
});

app.get('/health', async () => ({ status: 'ok' }));
app.get('/ready', async () => ({ status: 'ready' }));

app.listen({ host: '0.0.0.0', port: config.port });
