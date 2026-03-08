import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { publishEvent, type DomainEvent } from '../../../packages/shared-events/src';

type PrismaLike = PrismaClient;

async function createExecution(prismaClient: PrismaLike, tenantId: string, ruleName: string, eventId: string, status: string): Promise<void> {
  const rule = await prismaClient.automationRule.findFirst({ where: { tenantId, name: ruleName } });
  if (!rule) return;

  const execution = await prismaClient.automationExecution.create({
    data: { tenantId, ruleId: rule.id, status, eventId }
  });
  await prismaClient.automationExecutionStep.create({
    data: { tenantId, executionId: execution.id, step: ruleName, status }
  });
}

export async function processDomainEvent(prismaClient: PrismaLike, event: DomainEvent): Promise<void> {
  if (event.type === 'employee.created') {
    const payload = event.payload as { userId?: string; email?: string; name?: string };
    if (payload.userId) {
      const employeeRole = await prismaClient.role.findFirst({ where: { tenantId: event.tenantId, name: 'employee' } });
      if (employeeRole) {
        await prismaClient.userRole.upsert({
          where: { userId_roleId: { userId: payload.userId, roleId: employeeRole.id } },
          update: {},
          create: { tenantId: event.tenantId, userId: payload.userId, roleId: employeeRole.id }
        });
      }
      await prismaClient.notification.create({
        data: {
          tenantId: event.tenantId,
          channel: 'email',
          recipient: payload.email ?? 'employee@unknown.local',
          content: `Welcome ${payload.name ?? 'employee'} - onboarding has started`,
          status: 'queued'
        }
      });
      await prismaClient.auditLog.create({
        data: {
          tenantId: event.tenantId,
          actorId: payload.userId,
          action: 'automation.executed',
          resource: 'onboarding',
          metadata: { eventId: event.id }
        }
      });
      await createExecution(prismaClient, event.tenantId, 'New Employee Onboarding', event.id, 'completed');
    }
    await publishEvent({
      id: randomUUID(),
      type: 'automation.completed',
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: { sourceEventId: event.id, flow: 'onboarding' }
    });
    return;
  }

  if (event.type === 'approval.created') {
    const manager = await prismaClient.user.findFirst({ where: { tenantId: event.tenantId, email: { contains: 'manager' } } });
    await prismaClient.notification.create({
      data: {
        tenantId: event.tenantId,
        channel: 'in_app',
        recipient: manager?.email ?? 'manager@demo.local',
        content: 'A purchase approval request requires your review',
        status: 'queued'
      }
    });
    await createExecution(prismaClient, event.tenantId, 'Purchase Approval Automation', event.id, 'completed');
    return;
  }

  if (event.type === 'approval.approved') {
    const payload = event.payload as { approvalId?: string; status?: string };
    if (payload.status === 'approved') {
      await prismaClient.metricPoint.create({
        data: {
          tenantId: event.tenantId,
          key: 'approval.approved.count',
          value: 1,
          capturedAt: new Date()
        }
      });
      await prismaClient.notification.create({
        data: {
          tenantId: event.tenantId,
          channel: 'slack',
          recipient: '#procurement',
          content: `Purchase approval ${payload.approvalId ?? 'unknown'} fully approved`,
          status: 'queued'
        }
      });
    }
    return;
  }

  if (event.type === 'workflow.completed') {
    await prismaClient.auditLog.create({
      data: {
        tenantId: event.tenantId,
        actorId: 'system',
        action: 'workflow.completed',
        resource: 'workflow',
        metadata: event.payload as Prisma.JsonObject
      }
    });
  }
}
