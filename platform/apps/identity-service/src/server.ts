import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { config } from '../../../packages/shared-config/src';
import { loginSchema } from '../../../packages/shared-validation/src';
import { registry, requestDuration } from '../../../packages/shared-telemetry/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

await app.register(cors);
await app.register(helmet);
await app.register(jwt, { secret: config.jwtSecret });

app.addHook('onResponse', async (request, reply) => {
  requestDuration.labels('identity-service', request.routeOptions.url ?? request.url, request.method, String(reply.statusCode)).observe(reply.elapsedTime / 1000);
});

app.get('/health', async () => ({ status: 'ok' }));
app.get('/ready', async () => ({ status: 'ready' }));
app.get('/metrics', async (_, reply) => reply.type('text/plain').send(await registry.metrics()));

app.post('/auth/login', async (request, reply) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid login payload', details: parsed.error.flatten() });
  }
  const { email, password, tenantId } = parsed.data;
  const user = await prisma.user.findFirst({ where: { email, tenantId, active: true }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await prisma.auditLog.create({ data: { tenantId, actorId: 'anonymous', action: 'login.failure', resource: 'auth', metadata: { email } } });
    return reply.status(401).send({ error: 'Invalid credentials' });
  }
  const permissions = [...new Set(user.roles.flatMap((r: { role: { permissions: Array<{ permission: { key: string } }> } }) => r.role.permissions.map((rp: { permission: { key: string } }) => rp.permission.key)))];
  const accessToken = await reply.jwtSign({ sub: user.id, tenantId, permissions, correlationId: randomUUID() }, { expiresIn: '15m' });
  const refreshToken = randomUUID();
  await prisma.session.create({ data: { tenantId, userId: user.id, tokenHash: await bcrypt.hash(refreshToken, 10), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) } });
  await prisma.auditLog.create({ data: { tenantId, actorId: user.id, action: 'login.success', resource: 'auth', metadata: { email } } });
  return { accessToken, refreshToken };
});

app.post('/auth/refresh', async (request, reply) => {
  const { tenantId, refreshToken } = request.body as { tenantId: string; refreshToken: string };
  const sessions = await prisma.session.findMany({ where: { tenantId, expiresAt: { gt: new Date() } }, include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } } });
  const matched = await Promise.all(sessions.map(async (s: { tokenHash: string } & typeof sessions[number]) => ((await bcrypt.compare(refreshToken, s.tokenHash)) ? s : undefined)));
  const session = matched.find(Boolean);
  if (!session) {
    return reply.status(401).send({ error: 'Invalid refresh token' });
  }
  await prisma.session.delete({ where: { id: session.id } });
  const newRefreshToken = randomUUID();
  await prisma.session.create({ data: { tenantId, userId: session.userId, tokenHash: await bcrypt.hash(newRefreshToken, 10), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) } });
  const permissions = [...new Set(session.user.roles.flatMap((r: { role: { permissions: Array<{ permission: { key: string } }> } }) => r.role.permissions.map((rp: { permission: { key: string } }) => rp.permission.key)))];
  const accessToken = await reply.jwtSign({ sub: session.userId, tenantId, permissions, correlationId: randomUUID() }, { expiresIn: '15m' });
  return { accessToken, refreshToken: newRefreshToken };
});


app.post('/auth/reset/request', async (request) => {
  const { tenantId, email } = request.body as { tenantId: string; email: string };
  const user = await prisma.user.findFirst({ where: { tenantId, email } });
  if (!user) {
    return { success: true };
  }
  const resetToken = randomUUID();
  await prisma.session.create({
    data: {
      tenantId,
      userId: user.id,
      tokenHash: await bcrypt.hash(`reset:${resetToken}`, 10),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });
  await prisma.auditLog.create({ data: { tenantId, actorId: user.id, action: 'password.reset.requested', resource: 'auth', metadata: {} } });
  return { success: true, resetToken };
});

app.post('/auth/reset/confirm', async (request, reply) => {
  const { tenantId, resetToken, password } = request.body as { tenantId: string; resetToken: string; password: string };
  const sessions = await prisma.session.findMany({ where: { tenantId, expiresAt: { gt: new Date() } }, include: { user: true } });
  const matched = await Promise.all(sessions.map(async (s: { tokenHash: string } & typeof sessions[number]) => ((await bcrypt.compare(`reset:${resetToken}`, s.tokenHash)) ? s : undefined)));
  const session = matched.find(Boolean);
  if (!session) {
    return reply.status(400).send({ error: 'Invalid reset token' });
  }
  await prisma.user.update({ where: { id: session.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await prisma.session.delete({ where: { id: session.id } });
  await prisma.auditLog.create({ data: { tenantId, actorId: session.userId, action: 'password.reset.completed', resource: 'auth', metadata: {} } });
  return { success: true };
});

app.post('/auth/logout', async (request) => {
  const { tenantId, refreshToken } = request.body as { tenantId: string; refreshToken: string };
  const sessions = await prisma.session.findMany({ where: { tenantId } });
  for (const session of sessions) {
    if (await bcrypt.compare(refreshToken, session.tokenHash)) {
      await prisma.session.delete({ where: { id: session.id } });
    }
  }
  return { success: true };
});

app.listen({ port: config.port, host: '0.0.0.0' });
