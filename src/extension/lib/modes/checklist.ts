import type { ChecklistTrack } from './types.js';

export function calcProgress(t: ChecklistTrack): number {
    if (t.total <= 0) return 0;
    return Math.max(0, Math.min(1, t.completed / t.total));
}

export function format(t: ChecklistTrack): string {
    return `${t.completed}/${t.total} tasks`;
}

export function increment(t: ChecklistTrack): ChecklistTrack {
    return { ...t, completed: Math.min(t.completed + 1, t.total) };
}

export function decrement(t: ChecklistTrack): ChecklistTrack {
    return { ...t, completed: Math.max(t.completed - 1, 0) };
}

export function reset(t: ChecklistTrack): ChecklistTrack {
    return { ...t, completed: 0, firedThresholds: [] };
}
