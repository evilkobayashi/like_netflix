import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { PrismaClient, type Prisma } from '@prisma/client';
import { config } from '../../../packages/shared-config/src';
import { subscribeEvent, type DomainEvent } from '../../../packages/shared-events/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => request.jwtVerify());

async function consumeForAudit(event: DomainEvent): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: event.tenantId,
      actorId: 'event-bus',
      action: event.type,
      resource: 'domain-event',
      metadata: { eventId: event.id, payload: event.payload as Prisma.InputJsonValue } as Prisma.InputJsonValue
    }
  });
}

await subscribeEvent('user.*', consumeForAudit);
await subscribeEvent('employee.*', consumeForAudit);
await subscribeEvent('approval.*', consumeForAudit);
await subscribeEvent('workflow.*', consumeForAudit);
await subscribeEvent('automation.*', consumeForAudit);

app.get('/audit/logs', async (request) =>
  prisma.auditLog.findMany({
    where: { tenantId: (request.user as { tenantId: string }).tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200
  })
);

app.get('/reports/export', async (request, reply) => {
  const format = ((request.query as { format?: string }).format ?? 'csv') as string;
  const logs = await prisma.auditLog.findMany({
    where: { tenantId: (request.user as { tenantId: string }).tenantId },
    take: 1000
  });
  if (format === 'json') return logs;
  const csv = ['actor,action,resource,createdAt', ...logs.map((l) => `${l.actorId},${l.action},${l.resource},${l.createdAt.toISOString()}`)].join('\n');
  return reply.header('content-type', 'text/csv').send(csv);
});

app.listen({ host: '0.0.0.0', port: config.port });
