import type { ProgressMode, Track } from '../../../extension/lib/modes/types.js';

import { LinearForm } from './LinearForm.js';
import { DateCountdownForm } from './DateCountdownForm.js';
import { TimeElapsedForm } from './TimeElapsedForm.js';
import { ChecklistForm } from './ChecklistForm.js';
import { RecurringForm } from './RecurringForm.js';
import { ConsumptionForm } from './ConsumptionForm.js';
import { OverdueForm } from './OverdueForm.js';

import type { ModeForm } from './types.js';

export type { ModeForm } from './types.js';

export const MODE_LABELS: Record<ProgressMode, string> = {
    linear:        'Linear (start → finish)',
    dateCountdown: 'Date countdown',
    timeElapsed:   'Time elapsed (HH:MM:SS)',
    checklist:     'Checklist',
    recurring:     'Recurring / habit',
    consumption:   'Consumption (decreasing)',
    overdue:       'Overdue tracking',
};

export const MODE_ORDER: ProgressMode[] = [
    'linear',
    'dateCountdown',
    'timeElapsed',
    'checklist',
    'recurring',
    'consumption',
    'overdue',
];

/**
 * Creates a form for the given mode, pre-populating from `initial` only when
 * its discriminant matches the requested mode.
 */
export function createForm(mode: ProgressMode, initial?: Track): ModeForm {
    const match = initial?.mode === mode ? initial : undefined;

    switch (mode) {
        case 'linear':
            return new LinearForm(match?.mode === 'linear' ? match : undefined);
        case 'dateCountdown':
            return new DateCountdownForm(match?.mode === 'dateCountdown' ? match : undefined);
        case 'timeElapsed':
            return new TimeElapsedForm(match?.mode === 'timeElapsed' ? match : undefined);
        case 'checklist':
            return new ChecklistForm(match?.mode === 'checklist' ? match : undefined);
        case 'recurring':
            return new RecurringForm(match?.mode === 'recurring' ? match : undefined);
        case 'consumption':
            return new ConsumptionForm(match?.mode === 'consumption' ? match : undefined);
        case 'overdue':
            return new OverdueForm(match?.mode === 'overdue' ? match : undefined);
    }
}
