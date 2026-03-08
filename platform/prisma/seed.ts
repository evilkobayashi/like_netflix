import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant' },
    update: {},
    create: { id: 'demo-tenant', name: 'Demo Enterprise' }
  });

  const permissions = [
    'users:create',
    'users:read',
    'users:update',
    'approvals:create',
    'approvals:approve',
    'automation:execute',
    'dashboard:view',
    'audit:read'
  ];

  for (const key of permissions) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  const roleNames = ['admin', 'manager', 'finance', 'employee'];
  for (const roleName of roleNames) {
    await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: roleName } },
      update: {},
      create: { tenantId: tenant.id, name: roleName }
    });
  }

  const adminRole = await prisma.role.findFirstOrThrow({ where: { tenantId: tenant.id, name: 'admin' } });
  for (const p of await prisma.permission.findMany()) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id, tenantId: tenant.id }
    });
  }

  const users = [
    { email: 'admin@demo.local', name: 'Admin User', role: 'admin' },
    { email: 'manager@demo.local', name: 'Manager User', role: 'manager' },
    { email: 'finance@demo.local', name: 'Finance User', role: 'finance' },
    { email: 'employee@demo.local', name: 'Employee User', role: 'employee' }
  ];

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: user.email } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: user.email,
        name: user.name,
        passwordHash: await bcrypt.hash('Password123!', 10)
      }
    });

    const role = await prisma.role.findFirstOrThrow({ where: { tenantId: tenant.id, name: user.role } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: created.id, roleId: role.id } },
      update: {},
      create: { userId: created.id, roleId: role.id, tenantId: tenant.id }
    });
  }

  const workflow = await prisma.workflowDefinition.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Purchase Approval' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Purchase Approval' }
  });

  const stepNames = ['manager_approval', 'finance_approval', 'procurement_completion'];
  for (const [index, step] of stepNames.entries()) {
    const existing = await prisma.workflowStepDefinition.findFirst({
      where: { tenantId: tenant.id, workflowDefinitionId: workflow.id, name: step }
    });
    if (!existing) {
      await prisma.workflowStepDefinition.create({
        data: { tenantId: tenant.id, workflowDefinitionId: workflow.id, name: step, order: index + 1 }
      });
    }
  }

  const existingRule = await prisma.automationRule.findFirst({ where: { tenantId: tenant.id, name: 'New Employee Onboarding' } });
  if (!existingRule) {
    await prisma.automationRule.create({
      data: {
        tenantId: tenant.id,
        name: 'New Employee Onboarding',
        trigger: 'employee.created',
        action: { type: 'pipeline', steps: ['create_user', 'assign_role', 'send_notification', 'create_audit'] }
      }
    });
  }


  const purchaseRule = await prisma.automationRule.findFirst({ where: { tenantId: tenant.id, name: 'Purchase Approval Automation' } });
  if (!purchaseRule) {
    await prisma.automationRule.create({
      data: {
        tenantId: tenant.id,
        name: 'Purchase Approval Automation',
        trigger: 'approval.created',
        action: { type: 'notify', target: 'manager' }
      }
    });
  }

  const requester = await prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: 'employee@demo.local' } });
  const existingApproval = await prisma.approvalRequest.findFirst({ where: { tenantId: tenant.id, title: 'Demo Laptop Purchase' } });
  if (!existingApproval) {
    await prisma.approvalRequest.create({
      data: {
        tenantId: tenant.id,
        title: 'Demo Laptop Purchase',
        status: 'pending',
        requesterId: requester.id
      }
    });
  }

  const metric = await prisma.metricPoint.findFirst({ where: { tenantId: tenant.id, key: 'approval.approved.count' } });
  if (!metric) {
    await prisma.metricPoint.create({
      data: {
        tenantId: tenant.id,
        key: 'approval.approved.count',
        value: 5,
        capturedAt: new Date()
      }
    });
  }

}


main().finally(() => prisma.$disconnect());
