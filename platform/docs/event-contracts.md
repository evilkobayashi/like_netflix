# Event Contracts
Events are shared via `packages/shared-events` and include envelope fields: `id`, `type`, `tenantId`, `timestamp`, `correlationId`, `payload`.
Implemented subjects: `tenant.created`, `user.created`, `user.updated`, `role.assigned`, `approval.created`, `approval.approved`, `approval.rejected`, `workflow.started`, `workflow.completed`, `automation.triggered`, `automation.completed`, `automation.failed`, `notification.sent`.
