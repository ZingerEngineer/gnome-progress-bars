import type { LinearTrack } from './types.js';

export function calcProgress(t: LinearTrack): number {
    if (t.max <= 0) return 0;
    return t.current / t.max;
}

export function format(t: LinearTrack): string {
    return `${t.current}/${t.max}`;
}

export function increment(t: LinearTrack): LinearTrack {
    return { ...t, current: Math.min(t.current + t.step, t.max) };
}

export function decrement(t: LinearTrack): LinearTrack {
    return { ...t, current: Math.max(t.current - t.step, 0) };
}

export function reset(t: LinearTrack): LinearTrack {
    return { ...t, current: 0, firedThresholds: [] };
}
