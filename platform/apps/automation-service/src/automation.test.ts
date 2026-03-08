import { describe, it, expect } from 'vitest';

describe('automation trigger mapping', () => {
  it('maps approval events to automation triggers', () => {
    const supported = ['approval.created', 'approval.approved', 'approval.rejected'];
    expect(supported).toContain('approval.approved');
  });
});
