import { scheduleMailContinuation, type MailSchedule } from './mail-schedule';
import { describe, expect, it } from 'vitest';

describe('mailbox continuation repair', () => {
  it('coalesces repeated cron wakeups and replaces obsolete retry deadlines', async () => {
    const schedules: MailSchedule[] = [{ id: 'cron', callback: 'cleanup', type: 'cron', time: 60 }];
    let sequence = 0;
    const create = async (date: Date) => {
      schedules.push({
        id: String(++sequence),
        callback: 'cleanup',
        type: 'scheduled',
        time: Math.floor(date.getTime() / 1000),
      });
    };
    const cancel = async (id: string) => {
      schedules.splice(
        schedules.findIndex((s) => s.id === id),
        1,
      );
    };
    const repair = (time: number, now = 0) =>
      scheduleMailContinuation([...schedules], 'cleanup', time, now, create, cancel);
    await repair(2000);
    for (let tick = 0; tick < 5; tick++) await repair(2000);
    expect(schedules.filter((s) => s.type !== 'cron')).toHaveLength(1);
    // Deferral moves the existing continuation rather than adding another chain.
    await repair(120000);
    await repair(120000, 60000);
    expect(schedules.filter((s) => s.type !== 'cron')).toEqual([
      { id: '2', callback: 'cleanup', type: 'scheduled', time: 120 },
    ]);
    expect(schedules.find((s) => s.id === 'cron')).toBeDefined();
    schedules.push({ id: 'legacy-duplicate', callback: 'cleanup', type: 'scheduled', time: 121 });
    await repair(120000, 60000);
    expect(schedules.filter((s) => s.type !== 'cron')).toHaveLength(1);
  });

  it('keeps independent callback schedules and leaves executing callbacks alone', async () => {
    const canceled: string[] = [];
    const created: Date[] = [];
    await scheduleMailContinuation(
      [
        { id: 'executing', callback: 'cleanup', type: 'scheduled', time: 1 },
        { id: 'history', callback: 'history', type: 'scheduled', time: 3 },
      ],
      'cleanup',
      3000,
      1000,
      async (date) => {
        created.push(date);
      },
      async (id) => {
        canceled.push(id);
      },
    );
    expect(created).toEqual([new Date(3000)]);
    expect(canceled).toEqual([]);
  });
});
