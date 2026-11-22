import { relativeTime } from './relative-time';

describe('relativeTime', () => {
  const now = new Date('2026-11-21T12:00:00Z');

  function ago(seconds: number): string {
    return relativeTime(new Date(now.getTime() - seconds * 1000), now);
  }

  it.each([
    [10, 'just now'],
    [90, '1 minute ago'],
    [3 * 60 * 60 + 59 * 60, '3 hours ago'],
    [24 * 60 * 60, 'yesterday'],
    [3 * 24 * 60 * 60, '3 days ago'],
    [14 * 24 * 60 * 60, '2 weeks ago'],
    [60 * 24 * 60 * 60, '2 months ago'],
    [400 * 24 * 60 * 60, 'last year'],
  ])('describes %i seconds ago as "%s"', (seconds, expected) => {
    expect(ago(seconds)).toBe(expected);
  });

  it('describes a time slightly in the future instead of failing', () => {
    expect(ago(-5 * 60)).toBe('in 5 minutes');
  });
});
