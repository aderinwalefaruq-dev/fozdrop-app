// Same-day scheduled-delivery window: 11:00 AM to 8:00 PM, in the
// customer's local device time. Nigeria doesn't observe daylight saving,
// so this stays correct year-round without any timezone math on the
// client — the device's own clock/timezone is authoritative here.
export const SCHEDULE_WINDOW_START_HOUR = 11; // 11:00 AM
export const SCHEDULE_WINDOW_END_HOUR = 20;   // 8:00 PM (exclusive — last bookable minute is 19:59)
export const MIN_LEAD_MINUTES = 60;           // can't schedule for less than 1 hour from now

export function formatSlotTime(d: Date): string {
  return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

// The earliest moment that's actually bookable right now: "now + lead
// time", clamped forward to the start of today's window if that's later
// (e.g. if it's 8am, the earliest bookable time is 11:00 today, not
// 8:30am).
export function getEarliestSchedulableTime(): Date {
  const now = new Date();
  const withLead = new Date(now.getTime() + MIN_LEAD_MINUTES * 60 * 1000);
  const windowStart = new Date(now);
  windowStart.setHours(SCHEDULE_WINDOW_START_HOUR, 0, 0, 0);
  return withLead > windowStart ? withLead : windowStart;
}

export function getWindowEndToday(): Date {
  const end = new Date();
  end.setHours(SCHEDULE_WINDOW_END_HOUR, 0, 0, 0);
  return end;
}

// True once today's 11am-8pm window has already fully passed — used to
// disable the "Schedule" option entirely rather than let someone open a
// picker that can never produce a valid result.
export function hasSchedulingWindowLeftToday(): boolean {
  return getEarliestSchedulableTime() < getWindowEndToday();
}

// Validates a specific picked Date against both the lead-time buffer and
// the 11am-8pm window. Used right after the customer picks a time, and
// mirrored server-side in place-order (never trust client-side timing
// alone for something that changes operational behavior).
export function isValidScheduledTime(date: Date): { valid: boolean; reason?: string } {
  const now = new Date();
  if (date.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60 * 1000) {
    return { valid: false, reason: `Please choose a time at least ${MIN_LEAD_MINUTES >= 60 ? `${MIN_LEAD_MINUTES / 60} hour${MIN_LEAD_MINUTES > 60 ? 's' : ''}` : `${MIN_LEAD_MINUTES} minutes`} from now.` };
  }
  const hour = date.getHours();
  const withinWindow = hour >= SCHEDULE_WINDOW_START_HOUR && hour < SCHEDULE_WINDOW_END_HOUR;
  if (!withinWindow) {
    return { valid: false, reason: 'Scheduled delivery is only available between 11:00 AM and 8:00 PM.' };
  }
  return { valid: true };
}