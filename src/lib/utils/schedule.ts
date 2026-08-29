export function getUpcomingTimeSlots(hoursAhead = 6, stepMinutes = 30): Date[] {
  const slots: Date[] = [];
  const start = new Date();
  // Round up to the next slot boundary, then add one more step so there's
  // always real prep/lead time before the earliest bookable slot.
  start.setMinutes(Math.ceil(start.getMinutes() / stepMinutes) * stepMinutes + stepMinutes, 0, 0);
  const count = Math.floor((hoursAhead * 60) / stepMinutes);
  for (let i = 0; i < count; i++) {
    slots.push(new Date(start.getTime() + i * stepMinutes * 60 * 1000));
  }
  return slots;
}

export function formatSlotTime(d: Date): string {
  return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}
