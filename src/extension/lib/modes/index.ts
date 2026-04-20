// Dispatcher over the discriminated `Track` union.
// Sub-tasks are tracked independently from the main progress bar — they
// show up as dots underneath it and do not feed into calcProgress.

import type { Track } from './types.js';

import * as linear from './linear.js';
import * as dateCountdown from './dateCountdown.js';
import * as timeElapsed from './timeElapsed.js';
import * as checklist from './checklist.js';
import * as recurring from './recurring.js';
import * as consumption from './consumption.js';
import * as overdue from './overdue.js';

export * from './types.js';

/** Returns 0..1 (or >1 for overdue overflow). */
export function calcProgress(t: Track): number {
    switch (t.mode) {
        case 'linear':        return linear.calcProgress(t);
        case 'dateCountdown': return dateCountdown.calcProgress(t);
        case 'timeElapsed':   return timeElapsed.calcProgress(t);
        case 'checklist':     return checklist.calcProgress(t);
        case 'recurring':     return recurring.calcProgress(t);
        case 'consumption':   return consumption.calcProgress(t);
        case 'overdue':       return overdue.calcProgress(t);
    }
}

export function formatTrack(t: Track): string {
    switch (t.mode) {
        case 'linear':        return linear.format(t);
        case 'dateCountdown': return dateCountdown.format(t);
        case 'timeElapsed':   return timeElapsed.format(t);
        case 'checklist':     return checklist.format(t);
        case 'recurring':     return recurring.format(t);
        case 'consumption':   return consumption.format(t);
        case 'overdue':       return overdue.format(t);
    }
}

/** Returns `null` when the mode has no meaningful increment. */
export function increment(t: Track): Track | null {
    switch (t.mode) {
        case 'linear':      return linear.increment(t);
        case 'checklist':   return checklist.increment(t);
        case 'timeElapsed': return timeElapsed.increment(t);
        case 'consumption': return consumption.increment(t);
        case 'recurring':   return recurring.checkIn(t);
        case 'dateCountdown':
        case 'overdue':
            return null;
    }
}

export function decrement(t: Track): Track | null {
    switch (t.mode) {
        case 'linear':      return linear.decrement(t);
        case 'checklist':   return checklist.decrement(t);
        case 'timeElapsed': return timeElapsed.decrement(t);
        case 'consumption': return consumption.decrement(t);
        case 'recurring':
        case 'dateCountdown':
        case 'overdue':
            return null;
    }
}

export function reset(t: Track): Track {
    switch (t.mode) {
        case 'linear':        return linear.reset(t);
        case 'dateCountdown': return dateCountdown.reset(t);
        case 'timeElapsed':   return timeElapsed.reset(t);
        case 'checklist':     return checklist.reset(t);
        case 'recurring':     return recurring.reset(t);
        case 'consumption':   return consumption.reset(t);
        case 'overdue':       return overdue.reset(t);
    }
}
