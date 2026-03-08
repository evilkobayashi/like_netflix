import Fastify from 'fastify';
import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { config } from '../../../packages/shared-config/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const redis = new URL(config.redisUrl);
const connection = { host: redis.hostname, port: Number(redis.port || '6379') };
const deadLetter = new Queue('dead-letter', { connection });

new Worker(
  'notification-delivery',
  async (job) => {
    await prisma.notification.update({ where: { id: job.data.notificationId }, data: { status: 'sent' } });
    await prisma.notificationDelivery.create({
      data: {
        tenantId: job.data.tenantId,
        notificationId: job.data.notificationId,
        provider: 'mock',
        status: 'sent',
        attempts: job.attemptsMade
      }
    });
  },
  { connection }
).on('failed', async (job, err) => {
  if (!job) return;
  await deadLetter.add('notification-failed', { jobId: job.id, reason: err.message, payload: job.data });
});

new Worker(
  'automation-execution',
  async (job) => {
    const execution = await prisma.automationExecution.create({
      data: {
        tenantId: job.data.event.tenantId,
        ruleId: job.data.ruleId,
        status: 'completed',
        eventId: job.data.event.id
      }
    });
    await prisma.automationExecutionStep.create({
      data: {
        tenantId: job.data.event.tenantId,
        executionId: execution.id,
        step: 'execute',
        status: 'completed'
      }
    });
    await prisma.jobRecord.updateMany({
      where: {
        tenantId: job.data.event.tenantId,
        queue: 'automation-execution',
        jobId: String(job.id)
      },
      data: { status: 'completed' }
    });
  },
  { connection }
).on('failed', async (job, err) => {
  if (!job) return;
  await deadLetter.add('automation-failed', { jobId: job.id, reason: err.message, payload: job.data });
  await prisma.jobRecord.updateMany({
    where: {
      tenantId: job.data.event?.tenantId,
      queue: 'automation-execution',
      jobId: String(job.id)
    },
    data: { status: 'failed' }
  });
});

new Worker('workflow-step-processing', async () => undefined, { connection });
new Worker('metrics-aggregation', async () => undefined, { connection });
new Worker('audit-export-generation', async () => undefined, { connection });

app.get('/health', async () => ({ status: 'ok' }));
app.get('/ready', async () => ({ status: 'ready', deadLetterQueue: await deadLetter.getJobCountByTypes('waiting', 'failed') }));

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen({ host: '0.0.0.0', port: config.port });
