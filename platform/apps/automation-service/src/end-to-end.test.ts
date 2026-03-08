import { describe, it, expect, vi } from 'vitest';
import type { DomainEvent } from '../../../packages/shared-events/src';

vi.mock('../../../packages/shared-events/src', () => ({
  publishEvent: vi.fn(async () => undefined)
}));

import { processDomainEvent } from './automation-flow';

function mockPrisma() {
  return {
    role: { findFirst: vi.fn(async () => ({ id: 'role-employee' })) },
    user: { findFirst: vi.fn(async () => ({ id: 'manager-1', email: 'manager@demo.local' })) },
    userRole: { upsert: vi.fn(async () => ({ id: 'ur-1' })) },
    notification: { create: vi.fn(async () => ({ id: 'n-1' })) },
    auditLog: { create: vi.fn(async () => ({ id: 'a-1' })) },
    automationRule: {
      findFirst: vi.fn(async ({ where }: { where: { name: string } }) =>
        where.name ? { id: `rule-${where.name}` } : null
      )
    },
    automationExecution: { create: vi.fn(async () => ({ id: 'exec-1' })) },
    automationExecutionStep: { create: vi.fn(async () => ({ id: 'step-1' })) },
    metricPoint: { create: vi.fn(async () => ({ id: 'm-1' })) }
  };
}

describe('automation end-to-end flows', () => {
  it('executes onboarding flow on employee.created', async () => {
    const prisma = mockPrisma();
    const event: DomainEvent = {
      id: 'evt-1',
      type: 'employee.created',
      tenantId: 'demo-tenant',
      timestamp: new Date().toISOString(),
      correlationId: 'corr-1',
      payload: { userId: 'user-1', email: 'employee@demo.local', name: 'Employee' }
    };

    await processDomainEvent(prisma as never, event);

    expect(prisma.userRole.upsert).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.automationExecution.create).toHaveBeenCalled();
  });

  it('executes purchase completion flow on approval.approved', async () => {
    const prisma = mockPrisma();
    const event: DomainEvent = {
      id: 'evt-2',
      type: 'approval.approved',
      tenantId: 'demo-tenant',
      timestamp: new Date().toISOString(),
      correlationId: 'corr-2',
      payload: { approvalId: 'approval-1', status: 'approved' }
    };

    await processDomainEvent(prisma as never, event);

    expect(prisma.metricPoint.create).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
  });
});
