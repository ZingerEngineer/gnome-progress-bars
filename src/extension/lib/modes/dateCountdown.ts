import type { DateCountdownTrack } from './types.js';

function divisor(unit: DateCountdownTrack['unit']): number {
    switch (unit) {
        case 'hours': return 3600 * 1000;
        case 'days':  return 86400 * 1000;
        case 'weeks': return 7 * 86400 * 1000;
    }
}

export function calcProgress(t: DateCountdownTrack): number {
    const start = Date.parse(t.startISO);
    const end = Date.parse(t.endISO);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    const now = Date.now();
    return Math.max(0, Math.min(1, (now - start) / (end - start)));
}

export function format(t: DateCountdownTrack): string {
    const end = Date.parse(t.endISO);
    if (!Number.isFinite(end)) return '—';
    const remaining = Math.max(0, end - Date.now());
    const n = Math.ceil(remaining / divisor(t.unit));
    return `${n} ${t.unit} left`;
}

export function reset(t: DateCountdownTrack): DateCountdownTrack {
    return { ...t, firedThresholds: [] };
}
