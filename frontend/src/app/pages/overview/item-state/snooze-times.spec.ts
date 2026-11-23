import { laterToday, morningOf, nextWeek, pickableDays, tomorrow } from './snooze-times';

// Wednesday, 25 November 2026, 14:30 in the user's time.
const WEDNESDAY = new Date(2026, 10, 25, 14, 30);

describe('snooze times', () => {
  it('ends later today a few hours from now', () => {
    expect(laterToday(WEDNESDAY)).toEqual(new Date(2026, 10, 25, 17, 30));
  });

  it('ends tomorrow at 9', () => {
    expect(tomorrow(WEDNESDAY)).toEqual(new Date(2026, 10, 26, 9));
  });

  it('ends next week on Monday at 9', () => {
    expect(nextWeek(WEDNESDAY)).toEqual(new Date(2026, 10, 30, 9));
  });

  it('ends a week ahead on a Monday, and the next day on a Sunday', () => {
    expect(nextWeek(new Date(2026, 10, 30, 8))).toEqual(new Date(2026, 11, 7, 9));
    expect(nextWeek(new Date(2026, 10, 29, 20))).toEqual(new Date(2026, 10, 30, 9));
  });

  it('crosses the end of a month and a year', () => {
    expect(tomorrow(new Date(2026, 11, 31, 22))).toEqual(new Date(2027, 0, 1, 9));
  });

  it('lets a picked snooze end from tomorrow up to a year ahead, in the morning', () => {
    const days = pickableDays(WEDNESDAY);

    expect(days.first).toEqual(new Date(2026, 10, 26));
    expect(days.last).toEqual(new Date(2027, 10, 25));
    expect(morningOf(new Date(2026, 11, 24, 18))).toEqual(new Date(2026, 11, 24, 9));
  });
});
