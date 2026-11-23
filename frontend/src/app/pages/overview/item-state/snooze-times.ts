/** Hour of the day, in the user's time, at which a snooze to a day ends. */
export const MORNING_HOUR = 9;
/** "Later today" is this many hours from now. */
export const LATER_TODAY_HOURS = 3;

/** A few hours from now. */
export function laterToday(now: Date): Date {
  return new Date(now.getTime() + LATER_TODAY_HOURS * 60 * 60 * 1000);
}

/** Tomorrow morning. */
export function tomorrow(now: Date): Date {
  return morningOf(addDays(now, 1));
}

/** Next Monday morning; a week ahead on a Monday. */
export function nextWeek(now: Date): Date {
  const daysToMonday = (8 - now.getDay()) % 7 || 7;
  return morningOf(addDays(now, daysToMonday));
}

/** The morning of the given day. */
export function morningOf(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), MORNING_HOUR);
}

/** The first and last day a picked snooze may end on: tomorrow up to a year ahead. */
export function pickableDays(now: Date): { first: Date; last: Date } {
  return { first: addDays(startOfDay(now), 1), last: addDays(startOfDay(now), 365) };
}

function addDays(day: Date, days: number): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() + days,
    day.getHours(),
    day.getMinutes(),
  );
}

function startOfDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}
