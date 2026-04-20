import type { RecurringTrack } from './types.js';

export function todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodStart(frequency: RecurringTrack['frequency']): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    switch (frequency) {
        case 'daily':   return d;
        case 'weekly': {
            // Start of week (Monday)
            const day = (d.getDay() + 6) % 7;
            d.setDate(d.getDate() - day);
            return d;
        }
        case 'monthly':
            d.setDate(1);
            return d;
    }
}

function countInCurrentPeriod(t: RecurringTrack): number {
    const start = periodStart(t.frequency).getTime();
    return t.history.filter(iso => {
        const ts = Date.parse(iso);
        return Number.isFinite(ts) && ts >= start;
    }).length;
}

export function calcProgress(t: RecurringTrack): number {
    if (t.target <= 0) return 0;
    return Math.max(0, Math.min(1, countInCurrentPeriod(t) / t.target));
}

export function format(t: RecurringTrack): string {
    return `${countInCurrentPeriod(t)}/${t.target} · 🔥 ${t.streak}`;
}

export function checkedInToday(t: RecurringTrack): boolean {
    return t.lastCheckin === todayISO();
}

export function checkIn(t: RecurringTrack): RecurringTrack {
    const today = todayISO();
    const history = t.history.includes(today) ? t.history : [today, ...t.history];

    // Consecutive-day streak ending today
    let streak = 0;
    const d = new Date();
    while (true) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!history.includes(iso)) break;
        streak++;
        d.setDate(d.getDate() - 1);
    }

    return { ...t, history, streak, lastCheckin: today };
}

export function reset(t: RecurringTrack): RecurringTrack {
    return { ...t, history: [], streak: 0, lastCheckin: '', firedThresholds: [] };
}
