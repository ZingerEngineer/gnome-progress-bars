import type { TimeElapsedTrack } from './types.js';

function hms(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

export function calcProgress(t: TimeElapsedTrack): number {
    if (t.totalSeconds <= 0) return 0;
    return Math.max(0, Math.min(1, t.currentSeconds / t.totalSeconds));
}

export function format(t: TimeElapsedTrack): string {
    return `${hms(t.currentSeconds)} / ${hms(t.totalSeconds)}`;
}

export function increment(t: TimeElapsedTrack, stepSeconds = 60): TimeElapsedTrack {
    return { ...t, currentSeconds: Math.min(t.currentSeconds + stepSeconds, t.totalSeconds) };
}

export function decrement(t: TimeElapsedTrack, stepSeconds = 60): TimeElapsedTrack {
    return { ...t, currentSeconds: Math.max(t.currentSeconds - stepSeconds, 0) };
}

export function reset(t: TimeElapsedTrack): TimeElapsedTrack {
    return { ...t, currentSeconds: 0, firedThresholds: [] };
}
