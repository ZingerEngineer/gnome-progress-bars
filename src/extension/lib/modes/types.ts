// Discriminated-union model for all progress tracks.
// Persisted as JSON in the `tracks` GSettings key.
//
// Parent/child relationships live in a separate graph (see `links` in
// store.ts) — a track is a standalone entity, links are edges.

export const CURRENT_SCHEMA_VERSION = 4;

export interface RibbonOptions {
    enabled: boolean;
    /** Hex color, e.g. "#3cff72". */
    color: string;
    /**
     * When true, this track displays one short ribbon stripe per linked
     * parent, using each parent's ribbon color, instead of its own ribbon.
     * Takes precedence over `enabled` + `color` when the track has at
     * least one parent.
     */
    inheritFromParents: boolean;
}

export const DEFAULT_RIBBON: RibbonOptions = {
    enabled: false,
    color: '#888888',
    inheritFromParents: false,
};

export type ProgressMode =
    | 'linear'
    | 'dateCountdown'
    | 'timeElapsed'
    | 'checklist'
    | 'recurring'
    | 'consumption'
    | 'overdue';

export interface TrackColors {
    normal: string;  // "#rrggbb"
    warning: string;
    overdue: string;
}

export interface LabelOptions {
    show: boolean;
    /** Optional sprintf-like format override; the mode's default is used when absent. */
    format?: string;
}

export interface ReminderOptions {
    /** Percent thresholds (0..100) that fire a one-shot notification. */
    thresholds: number[];
    /** For overdue mode — send a daily notification past the deadline. */
    overdueDaily: boolean;
}

export interface BaseTrack {
    id: string;
    name: string;
    /** Relative to `GLib.get_user_data_dir()`, e.g. "progress-reminder-icons/foo.svg". Empty = built-in default. */
    iconPath: string;
    colors: TrackColors;
    label: LabelOptions;
    reminders: ReminderOptions;
    /** Thresholds that have already fired — cleared on reset or mode change. */
    firedThresholds: number[];
    /**
     * For overdue mode: the highest `daysLate` count already notified about.
     * Reset to 0 on reset / mode change. Ignored by other modes.
     */
    overdueNotifiedDaysLate: number;
    /** When true, this track is hidden from the panel menu (still editable in prefs). */
    hidden: boolean;
    /** Optional decorative ribbon strip drawn above the track. */
    ribbon: RibbonOptions;
    /**
     * Tint applied when the user picked a monochrome icon from the bundled
     * library. Empty for custom files and colored library icons. Kept for
     * re-edit so the prefs dialog can restore the color picker state.
     */
    iconTint: string;
}

// ── Per-mode variants ────────────────────────────────────────────────────

export interface LinearTrack extends BaseTrack {
    mode: 'linear';
    current: number;
    max: number;
    step: number;
}

export interface DateCountdownTrack extends BaseTrack {
    mode: 'dateCountdown';
    startISO: string; // YYYY-MM-DD or ISO datetime
    endISO: string;
    unit: 'days' | 'hours' | 'weeks';
}

export interface TimeElapsedTrack extends BaseTrack {
    mode: 'timeElapsed';
    totalSeconds: number;
    currentSeconds: number;
}

export interface ChecklistTrack extends BaseTrack {
    mode: 'checklist';
    total: number;
    completed: number;
}

export interface RecurringTrack extends BaseTrack {
    mode: 'recurring';
    frequency: 'daily' | 'weekly' | 'monthly';
    /** Target check-ins per period. */
    target: number;
    /** Check-in history as ISO dates (newest first). */
    history: string[];
    streak: number;
    lastCheckin: string;
}

export interface ConsumptionTrack extends BaseTrack {
    mode: 'consumption';
    initial: number;
    current: number;
    step: number;
}

export interface OverdueTrack extends BaseTrack {
    mode: 'overdue';
    deadlineISO: string;
}

export type Track =
    | LinearTrack
    | DateCountdownTrack
    | TimeElapsedTrack
    | ChecklistTrack
    | RecurringTrack
    | ConsumptionTrack
    | OverdueTrack;

// ── Parent/child graph link ──────────────────────────────────────────────

/**
 * A directed edge in the track graph. Many-to-many is allowed — the same
 * child can appear under multiple parents. Cycles are rejected by the store.
 */
export interface TrackLink {
    parentId: string;
    childId: string;
    /** Position of this child within its parent. */
    order: number;
}

// ── Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_COLORS: TrackColors = {
    normal: '#4caf50',
    warning: '#ffaa44',
    overdue: '#e53935',
};

export function makeBase(id: string, name: string): BaseTrack {
    return {
        id,
        name,
        iconPath: '',
        colors: { ...DEFAULT_COLORS },
        label: { show: true },
        reminders: { thresholds: [25, 50, 75, 100], overdueDaily: false },
        firedThresholds: [],
        overdueNotifiedDaysLate: 0,
        hidden: false,
        ribbon: { ...DEFAULT_RIBBON },
        iconTint: '',
    };
}
