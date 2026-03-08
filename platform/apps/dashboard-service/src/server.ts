import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { config } from '../../../packages/shared-config/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => request.jwtVerify());

app.get('/dashboard/overview', async (request) => {
  const tenantId = (request.user as any).tenantId as string;
  const [activeUsers, pendingApprovals, automations] = await Promise.all([
    prisma.user.count({ where: { tenantId, active: true } }),
    prisma.approvalRequest.count({ where: { tenantId, status: 'pending' } }),
    prisma.automationExecution.count({ where: { tenantId, status: 'completed' } })
  ]);
  return { activeUsers, pendingApprovals, automationSuccessRate: automations };
});
app.get('/dashboard/metrics', async (request) => prisma.metricPoint.findMany({ where: { tenantId: (request.user as any).tenantId }, take: 200 }));
app.listen({ port: config.port, host: '0.0.0.0' });
