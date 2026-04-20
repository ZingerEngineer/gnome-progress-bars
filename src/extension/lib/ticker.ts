import GLib from 'gi://GLib';
import type Gio from 'gi://Gio';

import { calcProgress } from './modes/index.js';
import { daysLate } from './modes/overdue.js';
import { loadTracks, saveTracks } from './store.js';
import {
    notifyOverdueDay,
    notifyThresholdCrossed,
} from './notifications.js';
import type { Track } from './modes/types.js';

export interface TickerOptions {
    settings: Gio.Settings;
    /** Called on every tick so the indicator can refresh time-based labels. */
    onTick: () => void;
}

/**
 * Single periodic loop that:
 *   1. Fires threshold notifications (25/50/75/100%) once each per track
 *   2. Fires overdue daily notifications when enabled
 *   3. Calls `onTick()` so the indicator can re-render time-based labels
 *
 * Interval is driven by the `poll-interval-seconds` GSettings key.
 */
export class Ticker {
    private readonly _settings: Gio.Settings;
    private readonly _onTick: () => void;
    private _sourceId: number | null = null;
    private _intervalChangedId: number | null = null;

    constructor(opts: TickerOptions) {
        this._settings = opts.settings;
        this._onTick = opts.onTick;
    }

    start(): void {
        this._schedule();
        this._intervalChangedId = this._settings.connect(
            'changed::poll-interval-seconds',
            () => this._reschedule(),
        );
    }

    stop(): void {
        if (this._sourceId !== null) {
            GLib.Source.remove(this._sourceId);
            this._sourceId = null;
        }
        if (this._intervalChangedId !== null) {
            this._settings.disconnect(this._intervalChangedId);
            this._intervalChangedId = null;
        }
    }

    /** Runs a single tick immediately — useful on startup or after edits. */
    tickNow(): void {
        this._tick();
    }

    // ── Internals ────────────────────────────────────────────────────────

    private _schedule(): void {
        const interval = Math.max(1, this._settings.get_int('poll-interval-seconds'));
        this._sourceId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._tick();
                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    private _reschedule(): void {
        if (this._sourceId !== null) {
            GLib.Source.remove(this._sourceId);
            this._sourceId = null;
        }
        this._schedule();
    }

    private _tick(): void {
        const tracks = loadTracks(this._settings);

        let mutated = false;
        const updated: Track[] = tracks.map(t => {
            const next = this._processTrack(t);
            if (next !== t) mutated = true;
            return next;
        });

        if (mutated) {
            saveTracks(this._settings, updated);
            // `changed::tracks` signal rebuilds the indicator for us.
        } else {
            this._onTick();
        }
    }

    /**
     * Returns a new track object when thresholds were crossed and need
     * persisting; otherwise returns the original reference.
     */
    private _processTrack(track: Track): Track {
        let working: Track = track;

        // ── Percent thresholds ──
        const progressPct = calcProgress(working) * 100;
        const toFire: number[] = [];
        for (const threshold of working.reminders.thresholds) {
            if (progressPct >= threshold && !working.firedThresholds.includes(threshold)) {
                toFire.push(threshold);
            }
        }
        if (toFire.length > 0) {
            for (const threshold of toFire) notifyThresholdCrossed(working, threshold);
            working = {
                ...working,
                firedThresholds: [...working.firedThresholds, ...toFire],
            } as Track;
        }

        // ── Overdue daily ──
        if (working.mode === 'overdue' && working.reminders.overdueDaily) {
            const late = daysLate(working);
            if (late > working.overdueNotifiedDaysLate) {
                notifyOverdueDay(working, late);
                working = { ...working, overdueNotifiedDaysLate: late };
            }
        }

        return working;
    }
}
