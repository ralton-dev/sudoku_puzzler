import { describe, expect, it } from 'vitest';
import { formatElapsed } from './Timer';

describe('formatElapsed', () => {
  it('shows mm:ss under an hour', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(5_000)).toBe('00:05');
    expect(formatElapsed(3_599_999)).toBe('59:59');
  });

  it('grows an hours field rather than reading 62:03', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_723_456)).toBe('1:02:03');
    expect(formatElapsed(36_000_000)).toBe('10:00:00');
  });

  it('does not render a negative clock', () => {
    expect(formatElapsed(-1)).toBe('00:00');
  });
});
