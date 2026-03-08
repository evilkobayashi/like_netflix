import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { config } from '../../../packages/shared-config/src';
import { publishEvent } from '../../../packages/shared-events/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => request.jwtVerify());

app.get('/approvals', async (request) => {
  const tenantId = (request.user as { tenantId: string }).tenantId;
  return prisma.approvalRequest.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
});

app.get('/approvals/:id/history', async (request) => {
  const tenantId = (request.user as { tenantId: string }).tenantId;
  const approvalRequestId = (request.params as { id: string }).id;
  return prisma.approvalHistory.findMany({ where: { tenantId, approvalRequestId }, orderBy: { createdAt: 'asc' } });
});

app.post('/approvals', async (request) => {
  const token = request.user as { tenantId: string; sub: string; correlationId: string };
  const body = request.body as { title: string; approverRoles?: string[] };
  const approval = await prisma.approvalRequest.create({
    data: {
      tenantId: token.tenantId,
      title: body.title,
      status: 'pending',
      requesterId: token.sub
    }
  });

  const approverRoles = body.approverRoles ?? ['manager', 'finance', 'procurement'];
  for (const [index, role] of approverRoles.entries()) {
    await prisma.approvalStep.create({
      data: {
        tenantId: token.tenantId,
        approvalRequestId: approval.id,
        approverRole: role,
        stepOrder: index + 1,
        status: index === 0 ? 'pending' : 'waiting'
      }
    });
  }

  await prisma.approvalHistory.create({
    data: {
      tenantId: token.tenantId,
      approvalRequestId: approval.id,
      action: 'created',
      actorId: token.sub,
      metadata: { title: body.title }
    }
  });

  await publishEvent({
    id: randomUUID(),
    type: 'approval.created',
    tenantId: token.tenantId,
    timestamp: new Date().toISOString(),
    correlationId: token.correlationId,
    payload: { approvalId: approval.id }
  });

  return approval;
});

app.post('/approvals/:id/approve', async (request) => {
  const token = request.user as { tenantId: string; sub: string; correlationId: string };
  const id = (request.params as { id: string }).id;

  const currentStep = await prisma.approvalStep.findFirst({
    where: { tenantId: token.tenantId, approvalRequestId: id, status: 'pending' },
    orderBy: { stepOrder: 'asc' }
  });

  if (currentStep) {
    await prisma.approvalStep.update({ where: { id: currentStep.id }, data: { status: 'approved' } });
    const next = await prisma.approvalStep.findFirst({
      where: { tenantId: token.tenantId, approvalRequestId: id, status: 'waiting' },
      orderBy: { stepOrder: 'asc' }
    });
    if (next) {
      await prisma.approvalStep.update({ where: { id: next.id }, data: { status: 'pending' } });
    }
  }

  const pending = await prisma.approvalStep.count({ where: { tenantId: token.tenantId, approvalRequestId: id, status: { in: ['pending', 'waiting'] } } });
  const status = pending === 0 ? 'approved' : 'in_review';
  const approval = await prisma.approvalRequest.update({ where: { id }, data: { status } });

  await prisma.approvalHistory.create({
    data: { tenantId: token.tenantId, approvalRequestId: id, action: 'approved', actorId: token.sub, metadata: { status } }
  });

  await publishEvent({ id: randomUUID(), type: 'approval.approved', tenantId: token.tenantId, timestamp: new Date().toISOString(), correlationId: token.correlationId, payload: { approvalId: id, status } });
  return approval;
});

app.post('/approvals/:id/reject', async (request) => {
  const token = request.user as { tenantId: string; sub: string; correlationId: string };
  const id = (request.params as { id: string }).id;
  const approval = await prisma.approvalRequest.update({ where: { id }, data: { status: 'rejected' } });
  await prisma.approvalStep.updateMany({ where: { tenantId: token.tenantId, approvalRequestId: id, status: { in: ['pending', 'waiting'] } }, data: { status: 'cancelled' } });
  await prisma.approvalHistory.create({ data: { tenantId: token.tenantId, approvalRequestId: id, action: 'rejected', actorId: token.sub, metadata: {} } });
  await publishEvent({ id: randomUUID(), type: 'approval.rejected', tenantId: token.tenantId, timestamp: new Date().toISOString(), correlationId: token.correlationId, payload: { approvalId: id } });
  return approval;
});

app.listen({ host: '0.0.0.0', port: config.port });
