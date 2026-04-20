import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import type { BaseTrack, ChecklistTrack, Track } from '../../../extension/lib/modes/types.js';
import type { ModeForm } from './types.js';

export class ChecklistForm implements ModeForm {
    readonly group: Adw.PreferencesGroup;
    private readonly _total: Gtk.SpinButton;
    private readonly _completed: Gtk.SpinButton;

    constructor(initial?: ChecklistTrack) {
        this.group = new Adw.PreferencesGroup({ title: 'Checklist' });

        const totalRow = new Adw.ActionRow({ title: 'Total items' });
        this._total = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 1000, step_increment: 1,
                value: initial?.total ?? 10,
            }),
            valign: Gtk.Align.CENTER,
        });
        totalRow.add_suffix(this._total);
        this.group.add(totalRow);

        const completedRow = new Adw.ActionRow({ title: 'Completed' });
        this._completed = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 1000, step_increment: 1,
                value: initial?.completed ?? 0,
            }),
            valign: Gtk.Align.CENTER,
        });
        completedRow.add_suffix(this._completed);
        this.group.add(completedRow);
    }

    read(base: BaseTrack): Track {
        const out: ChecklistTrack = {
            ...base,
            mode: 'checklist',
            total: this._total.get_value_as_int(),
            completed: this._completed.get_value_as_int(),
        };
        return out;
    }
}
