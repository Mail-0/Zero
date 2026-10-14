export interface MailSchedule {
  id: string;
  callback: string;
  type: string;
  time: number;
}

// Keep one future continuation even when a cron wakeup and the current callback
// both attempt to repair it. Cron records themselves remain untouched.
export async function scheduleMailContinuation(
  schedules: MailSchedule[],
  callback: string,
  time: number,
  now: number,
  create: (date: Date) => Promise<unknown>,
  cancel: (id: string) => Promise<unknown>,
) {
  const future = schedules
    .filter((s) => s.callback === callback && s.type !== 'cron' && s.time * 1000 > now)
    .sort((a, b) => a.time - b.time);
  const keep = future.find((s) => Math.abs(s.time * 1000 - time) <= 1000);
  if (!keep) await create(new Date(time));
  for (const schedule of future) if (schedule.id !== keep?.id) await cancel(schedule.id);
}
