import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { config } from '../../../packages/shared-config/src';
import { requirePermission } from '../../../packages/shared-auth/src';
import { publishEvent } from '../../../packages/shared-events/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => {
  await request.jwtVerify();
});

app.get('/health', async () => ({ status: 'ok' }));
app.get('/ready', async () => ({ status: 'ready' }));

app.get('/users', async (request) => {
  requirePermission(request, 'users:read');
  const tenantId = (request.user as { tenantId: string }).tenantId;
  return prisma.user.findMany({
    where: { tenantId },
    select: { id: true, email: true, name: true, active: true, createdAt: true }
  });
});

app.post('/users', async (request) => {
  requirePermission(request, 'users:create');
  const token = request.user as { tenantId: string; correlationId: string; sub: string };
  const body = request.body as { email: string; name: string; password: string };
  const user = await prisma.user.create({
    data: {
      tenantId: token.tenantId,
      email: body.email,
      name: body.name,
      passwordHash: await bcrypt.hash(body.password, 10)
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId: token.tenantId,
      actorId: token.sub,
      action: 'user.created',
      resource: 'user',
      metadata: { userId: user.id, email: user.email }
    }
  });

  await publishEvent({
    id: randomUUID(),
    type: 'user.created',
    tenantId: token.tenantId,
    correlationId: token.correlationId,
    timestamp: new Date().toISOString(),
    payload: { userId: user.id, email: user.email }
  });

  return user;
});

app.patch('/users/:id', async (request) => {
  requirePermission(request, 'users:update');
  const token = request.user as { tenantId: string; correlationId: string; sub: string };
  const body = request.body as { name?: string; active?: boolean };
  const userId = (request.params as { id: string }).id;
  await prisma.user.updateMany({
    where: { id: userId, tenantId: token.tenantId },
    data: { name: body.name, active: body.active }
  });
  const user = await prisma.user.findFirstOrThrow({ where: { id: userId, tenantId: token.tenantId } });

  await prisma.auditLog.create({
    data: {
      tenantId: token.tenantId,
      actorId: token.sub,
      action: 'user.updated',
      resource: 'user',
      metadata: { userId: user.id, name: user.name, active: user.active }
    }
  });

  await publishEvent({
    id: randomUUID(),
    type: 'user.updated',
    tenantId: token.tenantId,
    correlationId: token.correlationId,
    timestamp: new Date().toISOString(),
    payload: { userId: user.id }
  });

  return user;
});


app.post('/employees/onboard', async (request) => {
  requirePermission(request, 'users:create');
  const token = request.user as { tenantId: string; correlationId: string; sub: string };
  const body = request.body as { email: string; name: string; password?: string };

  const user = await prisma.user.create({
    data: {
      tenantId: token.tenantId,
      email: body.email,
      name: body.name,
      passwordHash: await bcrypt.hash(body.password ?? 'Password123!', 10)
    }
  });

  await publishEvent({
    id: randomUUID(),
    type: 'employee.created',
    tenantId: token.tenantId,
    correlationId: token.correlationId,
    timestamp: new Date().toISOString(),
    payload: { userId: user.id, email: user.email, name: user.name }
  });

  await prisma.auditLog.create({
    data: {
      tenantId: token.tenantId,
      actorId: token.sub,
      action: 'employee.created',
      resource: 'employee',
      metadata: { userId: user.id }
    }
  });

  return { userId: user.id, status: 'onboarding_started' };
});

app.post('/users/:id/roles', async (request) => {
  requirePermission(request, 'users:update');
  const token = request.user as { tenantId: string; sub: string };
  const userId = (request.params as { id: string }).id;
  const { roleId } = request.body as { roleId: string };

  const assignment = await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId, tenantId: token.tenantId }
  });

  await prisma.auditLog.create({
    data: {
      tenantId: token.tenantId,
      actorId: token.sub,
      action: 'role.assigned',
      resource: 'user',
      metadata: { userId, roleId }
    }
  });

  return assignment;
});

app.listen({ host: '0.0.0.0', port: config.port });
