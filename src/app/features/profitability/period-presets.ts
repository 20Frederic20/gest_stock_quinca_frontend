import { todayIso } from '../pricing/price-rules';

export type PeriodPreset = 'today' | 'yesterday' | 'week' | 'month';

/** ISO range (local time, no UTC shift) of a preset; the week starts on Monday. */
export function presetRange(preset: PeriodPreset, today: Date): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  switch (preset) {
    case 'today':
      return { from: todayIso(today), to: todayIso(today) };
    case 'yesterday': {
      const yesterday = todayIso(new Date(y, m, d - 1));
      return { from: yesterday, to: yesterday };
    }
    case 'week': {
      const sinceMonday = (today.getDay() + 6) % 7;
      return { from: todayIso(new Date(y, m, d - sinceMonday)), to: todayIso(today) };
    }
    case 'month':
      return { from: todayIso(new Date(y, m, 1)), to: todayIso(today) };
  }
}
