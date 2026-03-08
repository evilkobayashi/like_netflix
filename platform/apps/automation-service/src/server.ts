import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { config } from '../../../packages/shared-config/src';
import { publishEvent, subscribeEvent, type DomainEvent } from '../../../packages/shared-events/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const redis = new URL(config.redisUrl);
const queue = new Queue('automation-execution', { connection: { host: redis.hostname, port: Number(redis.port || '6379') } });
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => request.jwtVerify());

async function handleEvent(event: DomainEvent): Promise<void> {
  const existing = await prisma.jobRecord.findFirst({
    where: { tenantId: event.tenantId, queue: 'automation-execution', jobId: event.id }
  });
  if (existing) {
    return;
  }

  const rules = await prisma.automationRule.findMany({
    where: { tenantId: event.tenantId, trigger: event.type, active: true }
  });

  for (const rule of rules) {
    const job = await queue.add('execute-rule', { ruleId: rule.id, event }, { attempts: 3, backoff: { type: 'exponential', delay: 500 } });
    await prisma.jobRecord.create({
      data: {
        tenantId: event.tenantId,
        queue: 'automation-execution',
        jobId: String(job.id),
        status: 'queued',
        payload: { eventId: event.id, ruleId: rule.id }
      }
    });
  }
}

await subscribeEvent('approval.*', handleEvent);
await subscribeEvent('employee.*', handleEvent);
await subscribeEvent('workflow.completed', handleEvent);

app.get('/automation/rules', async (request) => prisma.automationRule.findMany({ where: { tenantId: (request.user as { tenantId: string }).tenantId } }));
app.post('/automation/rules', async (request) => prisma.automationRule.create({ data: { ...(request.body as Record<string, unknown>), tenantId: (request.user as { tenantId: string }).tenantId } }));
app.get('/automation/executions', async (request) => prisma.automationExecution.findMany({ where: { tenantId: (request.user as { tenantId: string }).tenantId }, orderBy: { createdAt: 'desc' } }));
app.post('/automation/trigger', async (request) => {
  const token = request.user as { tenantId: string; correlationId: string };
  await publishEvent({ id: randomUUID(), type: 'automation.triggered', tenantId: token.tenantId, timestamp: new Date().toISOString(), correlationId: token.correlationId, payload: request.body as Record<string, unknown> });
  return { enqueued: true };
});
app.listen({ host: '0.0.0.0', port: config.port });
