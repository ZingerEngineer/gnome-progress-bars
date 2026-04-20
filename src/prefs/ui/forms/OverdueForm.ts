import Adw from 'gi://Adw';

import type { BaseTrack, OverdueTrack, Track } from '../../../extension/lib/modes/types.js';
import type { ModeForm } from './types.js';

export class OverdueForm implements ModeForm {
    readonly group: Adw.PreferencesGroup;
    private readonly _deadline: Adw.EntryRow;

    constructor(initial?: OverdueTrack) {
        this.group = new Adw.PreferencesGroup({
            title: 'Overdue',
            description: 'ISO date (YYYY-MM-DD). The bar keeps filling past the deadline.',
        });

        this._deadline = new Adw.EntryRow({ title: 'Deadline' });
        this._deadline.set_text(initial?.deadlineISO ?? '');
        this.group.add(this._deadline);
    }

    read(base: BaseTrack): Track {
        const out: OverdueTrack = {
            ...base,
            mode: 'overdue',
            deadlineISO: this._deadline.get_text(),
        };
        return out;
    }
}
