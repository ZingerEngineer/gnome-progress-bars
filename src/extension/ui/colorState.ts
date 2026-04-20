import type { Track } from '../lib/modes/types.js';
import { calcProgress } from '../lib/modes/index.js';
import { isOverdue } from '../lib/modes/overdue.js';

export type ColorState = 'normal' | 'warning' | 'overdue';

/**
 * Maps the current track state to which color in `track.colors` should be
 * used for the bar fill.
 */
export function colorStateFor(track: Track): ColorState {
    if (track.mode === 'overdue' && isOverdue(track)) return 'overdue';

    const p = calcProgress(track);
    if (p >= 1) return 'normal';   // done
    if (p >= 0.75) return 'warning';
    return 'normal';
}

export function fillColorFor(track: Track): string {
    switch (colorStateFor(track)) {
        case 'overdue': return track.colors.overdue;
        case 'warning': return track.colors.warning;
        case 'normal':  return track.colors.normal;
    }
}
