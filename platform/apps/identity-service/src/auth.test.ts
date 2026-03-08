import { describe, it, expect } from 'vitest';
import { loginSchema } from '../../../packages/shared-validation/src';

describe('auth validation', () => {
  it('validates login payload', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'Password123!', tenantId: 'demo-tenant' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'bad', password: 'x', tenantId: '' }).success).toBe(false);
  });
});
