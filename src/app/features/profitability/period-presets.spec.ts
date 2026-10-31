import { presetRange } from './period-presets';

describe('presetRange', () => {
  const thursday = new Date(2026, 9, 29);

  it('returns today', () => {
    expect(presetRange('today', thursday)).toEqual({ from: '2026-10-29', to: '2026-10-29' });
  });

  it('returns yesterday', () => {
    expect(presetRange('yesterday', thursday)).toEqual({ from: '2026-10-28', to: '2026-10-28' });
  });

  it('returns Monday to today for the week', () => {
    expect(presetRange('week', thursday)).toEqual({ from: '2026-10-26', to: '2026-10-29' });
  });

  it('starts the week on the same day when today is a Monday', () => {
    expect(presetRange('week', new Date(2026, 9, 26))).toEqual({ from: '2026-10-26', to: '2026-10-26' });
  });

  it('goes back to the previous month Monday on a Sunday', () => {
    expect(presetRange('week', new Date(2026, 10, 1))).toEqual({ from: '2026-10-26', to: '2026-11-01' });
  });

  it('returns the 1st to today for the month', () => {
    expect(presetRange('month', thursday)).toEqual({ from: '2026-10-01', to: '2026-10-29' });
  });

  it('crosses a month boundary for yesterday', () => {
    expect(presetRange('yesterday', new Date(2026, 10, 1))).toEqual({ from: '2026-10-31', to: '2026-10-31' });
  });
});
