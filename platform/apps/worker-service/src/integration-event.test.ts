import { describe, it, expect } from 'vitest';

describe('event-driven idempotency', () => {
  it('drops duplicate event ids', () => {
    const processed = new Set<string>();
    const process = (id: string) => {
      if (processed.has(id)) return 'duplicate';
      processed.add(id);
      return 'processed';
    };
    expect(process('evt-1')).toBe('processed');
    expect(process('evt-1')).toBe('duplicate');
  });
});
