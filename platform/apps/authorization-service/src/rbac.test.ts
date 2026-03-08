import { describe, it, expect } from 'vitest';
import { requirePermission } from '../../../packages/shared-auth/src';

describe('RBAC', () => {
  it('blocks missing permissions', () => {
    const request = { user: { permissions: ['users:read'] } } as never;
    expect(() => requirePermission(request, 'users:update')).toThrow('Missing permission');
  });
});
