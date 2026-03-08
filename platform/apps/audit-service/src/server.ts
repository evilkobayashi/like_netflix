import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { config } from '../../../packages/shared-config/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => request.jwtVerify());

app.get('/audit/logs', async (request) => prisma.auditLog.findMany({ where: { tenantId: (request.user as any).tenantId }, orderBy: { createdAt: 'desc' }, take: 200 }));
app.get('/reports/export', async (request, reply) => {
  const format = ((request.query as any).format ?? 'csv') as string;
  const logs = await prisma.auditLog.findMany({ where: { tenantId: (request.user as any).tenantId }, take: 1000 });
  if (format === 'json') return logs;
  const csv = ['actor,action,resource,createdAt', ...logs.map((l: { actorId: string; action: string; resource: string; createdAt: Date }) => `${l.actorId},${l.action},${l.resource},${l.createdAt.toISOString()}`)].join('\n');
  return reply.header('content-type', 'text/csv').send(csv);
});
app.listen({ host: '0.0.0.0', port: config.port });
