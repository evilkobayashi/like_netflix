import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { config } from '../../../packages/shared-config/src';
import { publishEvent, subscribeEvent, type DomainEvent } from '../../../packages/shared-events/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => request.jwtVerify());

async function startWorkflowExecution(tenantId: string, workflowDefinitionId: string, correlationId: string): Promise<string> {
  const execution = await prisma.workflowExecution.create({
    data: { tenantId, workflowDefinitionId, status: 'started' }
  });

  const steps = await prisma.workflowStepDefinition.findMany({
    where: { tenantId, workflowDefinitionId },
    orderBy: { order: 'asc' }
  });

  for (const [index, step] of steps.entries()) {
    await prisma.workflowStepExecution.create({
      data: {
        tenantId,
        workflowExecutionId: execution.id,
        stepName: step.name,
        status: index === 0 ? 'pending' : 'waiting'
      }
    });
  }

  await publishEvent({
    id: randomUUID(),
    type: 'workflow.started',
    tenantId,
    timestamp: new Date().toISOString(),
    correlationId,
    payload: { executionId: execution.id, workflowDefinitionId }
  });

  return execution.id;
}

await subscribeEvent('approval.approved', async (event: DomainEvent) => {
  const payload = event.payload as { status?: string };
  if (payload.status !== 'approved') {
    return;
  }

  const definition = await prisma.workflowDefinition.findFirst({
    where: { tenantId: event.tenantId, name: 'Purchase Approval' }
  });

  if (!definition) {
    return;
  }

  await startWorkflowExecution(event.tenantId, definition.id, event.correlationId);
});

app.get('/workflows', async (request) => {
  const tenantId = (request.user as { tenantId: string }).tenantId;
  return prisma.workflowDefinition.findMany({ where: { tenantId }, include: { steps: { orderBy: { order: 'asc' } } } });
});

app.post('/workflows', async (request) => {
  const tenantId = (request.user as { tenantId: string }).tenantId;
  const body = request.body as { name: string; steps: string[] };
  return prisma.workflowDefinition.create({
    data: { tenantId, name: body.name, steps: { create: body.steps.map((s, i) => ({ tenantId, name: s, order: i + 1 })) } }
  });
});

app.post('/workflows/:id/start', async (request) => {
  const token = request.user as { tenantId: string; correlationId: string };
  const workflowDefinitionId = (request.params as { id: string }).id;
  const executionId = await startWorkflowExecution(token.tenantId, workflowDefinitionId, token.correlationId);
  return { executionId, status: 'started' };
});

app.post('/workflows/executions/:id/advance', async (request) => {
  const token = request.user as { tenantId: string; correlationId: string };
  const executionId = (request.params as { id: string }).id;

  const current = await prisma.workflowStepExecution.findFirst({
    where: { tenantId: token.tenantId, workflowExecutionId: executionId, status: 'pending' },
    orderBy: { createdAt: 'asc' }
  });

  if (!current) {
    return { status: 'no-pending-step' };
  }

  await prisma.workflowStepExecution.update({ where: { id: current.id }, data: { status: 'completed' } });

  const next = await prisma.workflowStepExecution.findFirst({
    where: { tenantId: token.tenantId, workflowExecutionId: executionId, status: 'waiting' },
    orderBy: { createdAt: 'asc' }
  });

  if (next) {
    await prisma.workflowStepExecution.update({ where: { id: next.id }, data: { status: 'pending' } });
    return { status: 'advanced', nextStep: next.stepName };
  }

  await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'completed' } });
  await publishEvent({ id: randomUUID(), type: 'workflow.completed', tenantId: token.tenantId, timestamp: new Date().toISOString(), correlationId: token.correlationId, payload: { executionId } });
  return { status: 'completed' };
});

app.listen({ host: '0.0.0.0', port: config.port });
