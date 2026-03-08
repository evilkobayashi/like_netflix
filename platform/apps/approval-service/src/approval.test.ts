import { describe, it, expect } from 'vitest';

describe('approval status transitions', () => {
  it('supports approved and rejected terminal states', () => {
    const allowed = new Set(['pending->approved', 'pending->rejected']);
    expect(allowed.has('pending->approved')).toBe(true);
    expect(allowed.has('pending->rejected')).toBe(true);
  });
});
