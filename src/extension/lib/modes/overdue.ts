import type { OverdueTrack } from './types.js';

/**
 * Progress ≥ 1 means overdue. Callers render > 1 as red/overflow.
 * We return raw (possibly > 1) so the UI can display "N days late".
 */
export function calcProgress(t: OverdueTrack): number {
    const deadline = Date.parse(t.deadlineISO);
    if (!Number.isFinite(deadline)) return 0;
    const now = Date.now();
    if (now < deadline) {
        // Approach phase: linear ramp over the last 7 days before deadline.
        const windowMs = 7 * 86400 * 1000;
        const start = deadline - windowMs;
        return Math.max(0, Math.min(1, (now - start) / windowMs));
    }
    // Overdue: 1 + (days late / 7) so the bar keeps filling.
    const daysLate = (now - deadline) / (86400 * 1000);
    return 1 + daysLate / 7;
}

export function daysLate(t: OverdueTrack): number {
    const deadline = Date.parse(t.deadlineISO);
    if (!Number.isFinite(deadline)) return 0;
    const diff = (Date.now() - deadline) / (86400 * 1000);
    return Math.max(0, Math.floor(diff));
}

export function format(t: OverdueTrack): string {
    const late = daysLate(t);
    if (late > 0) return `${late} day${late === 1 ? '' : 's'} late`;
    const deadline = Date.parse(t.deadlineISO);
    if (!Number.isFinite(deadline)) return '—';
    const daysLeft = Math.ceil((deadline - Date.now()) / (86400 * 1000));
    return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
}

export function isOverdue(t: OverdueTrack): boolean {
    return daysLate(t) > 0;
}

export function reset(t: OverdueTrack): OverdueTrack {
    return { ...t, firedThresholds: [], overdueNotifiedDaysLate: 0 };
}
