import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import type {
    BaseTrack, DateCountdownTrack, Track,
} from '../../../extension/lib/modes/types.js';
import type { ModeForm } from './types.js';

const UNITS: Array<DateCountdownTrack['unit']> = ['days', 'hours', 'weeks'];

function dateRow(title: string, value: string): { row: Adw.EntryRow; entry: Adw.EntryRow } {
    const entry = new Adw.EntryRow({ title });
    entry.set_text(value);
    return { row: entry, entry };
}

export class DateCountdownForm implements ModeForm {
    readonly group: Adw.PreferencesGroup;
    private readonly _start: Adw.EntryRow;
    private readonly _end: Adw.EntryRow;
    private readonly _unit: Adw.ComboRow;

    constructor(initial?: DateCountdownTrack) {
        this.group = new Adw.PreferencesGroup({
            title: 'Date countdown',
            description: 'Dates use ISO format (YYYY-MM-DD).',
        });

        const start = dateRow('Start date', initial?.startISO ?? '');
        const end = dateRow('End date', initial?.endISO ?? '');
        this._start = start.entry;
        this._end = end.entry;

        this._unit = new Adw.ComboRow({
            title: 'Unit',
            model: Gtk.StringList.new(UNITS),
        });
        const initialUnit = initial?.unit ?? 'days';
        this._unit.set_selected(UNITS.indexOf(initialUnit));

        this.group.add(start.row);
        this.group.add(end.row);
        this.group.add(this._unit);
    }

    read(base: BaseTrack): Track {
        const idx = this._unit.get_selected();
        const unit: DateCountdownTrack['unit'] = UNITS[idx] ?? 'days';
        const out: DateCountdownTrack = {
            ...base,
            mode: 'dateCountdown',
            startISO: this._start.get_text(),
            endISO: this._end.get_text(),
            unit,
        };
        return out;
    }
}
