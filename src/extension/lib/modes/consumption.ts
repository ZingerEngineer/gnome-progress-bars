import type { ConsumptionTrack } from './types.js';

/**
 * Consumption progresses from 0 to 1 as `current` drops from `initial` to 0.
 * i.e. "used up" fraction.
 */
export function calcProgress(t: ConsumptionTrack): number {
    if (t.initial <= 0) return 0;
    const used = t.initial - t.current;
    return Math.max(0, Math.min(1, used / t.initial));
}

export function format(t: ConsumptionTrack): string {
    return `${t.current}/${t.initial} left`;
}

export function decrement(t: ConsumptionTrack): ConsumptionTrack {
    const step = t.step > 0 ? t.step : 1;
    return { ...t, current: Math.max(t.current - step, 0) };
}

export function increment(t: ConsumptionTrack): ConsumptionTrack {
    const step = t.step > 0 ? t.step : 1;
    return { ...t, current: Math.min(t.current + step, t.initial) };
}

export function reset(t: ConsumptionTrack): ConsumptionTrack {
    return { ...t, current: t.initial, firedThresholds: [] };
}
