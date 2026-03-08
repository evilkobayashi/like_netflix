import Fastify from 'fastify';
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import jwt from '@fastify/jwt';
import { config } from '../../../packages/shared-config/src';
import { subscribeEvent, type DomainEvent } from '../../../packages/shared-events/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const redis = new URL(config.redisUrl);
const queue = new Queue('notification-delivery', {
  connection: { host: redis.hostname, port: Number(redis.port || '6379') }
});
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => request.jwtVerify());

async function enqueueNotification(tenantId: string, recipient: string, content: string, channel = 'in_app'): Promise<void> {
  const notification = await prisma.notification.create({
    data: { tenantId, channel, recipient, content, status: 'queued' }
  });
  await queue.add('deliver', { notificationId: notification.id, tenantId }, { attempts: 5, backoff: { type: 'fixed', delay: 1000 } });
}

async function consume(event: DomainEvent): Promise<void> {
  if (event.type === 'approval.created') {
    await enqueueNotification(event.tenantId, 'manager@demo.local', 'New approval requires manager decision');
  }
  if (event.type === 'approval.approved') {
    await enqueueNotification(event.tenantId, 'requester@demo.local', 'Your request has been approved');
  }
  if (event.type === 'approval.rejected') {
    await enqueueNotification(event.tenantId, 'requester@demo.local', 'Your request has been rejected');
  }
  if (event.type === 'automation.failed') {
    await enqueueNotification(event.tenantId, 'ops@demo.local', 'Automation failed and requires intervention', 'email');
  }
}

await subscribeEvent('approval.*', consume);
await subscribeEvent('automation.failed', consume);

app.get('/notifications', async (request) =>
  prisma.notification.findMany({ where: { tenantId: (request.user as { tenantId: string }).tenantId } })
);

app.post('/notifications', async (request) => {
  const tenantId = (request.user as { tenantId: string }).tenantId;
  const body = request.body as { channel: string; recipient: string; content: string };
  const notification = await prisma.notification.create({
    data: { tenantId, channel: body.channel, recipient: body.recipient, content: body.content, status: 'queued' }
  });
  await queue.add('deliver', { notificationId: notification.id, tenantId }, { attempts: 5, backoff: { type: 'fixed', delay: 1000 } });
  return notification;
});

app.listen({ port: config.port, host: '0.0.0.0' });
