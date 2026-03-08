import Fastify from 'fastify';
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import jwt from '@fastify/jwt';
import { config } from '../../../packages/shared-config/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const redis = new URL(config.redisUrl);
const queue = new Queue('notification-delivery', { connection: { host: redis.hostname, port: Number(redis.port || '6379') } });
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => request.jwtVerify());

app.get('/notifications', async (request) => prisma.notification.findMany({ where: { tenantId: (request.user as any).tenantId } }));
app.post('/notifications', async (request) => {
  const tenantId = (request.user as any).tenantId as string;
  const notification = await prisma.notification.create({ data: { tenantId, ...(request.body as any), status: 'queued' } });
  await queue.add('deliver', { notificationId: notification.id, tenantId }, { attempts: 5, backoff: { type: 'fixed', delay: 1000 } });
  return notification;
});
app.listen({ port: config.port, host: '0.0.0.0' });
