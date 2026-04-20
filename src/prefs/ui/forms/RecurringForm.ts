import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import type { BaseTrack, RecurringTrack, Track } from '../../../extension/lib/modes/types.js';
import type { ModeForm } from './types.js';

const FREQUENCIES: Array<RecurringTrack['frequency']> = ['daily', 'weekly', 'monthly'];

export class RecurringForm implements ModeForm {
    readonly group: Adw.PreferencesGroup;
    private readonly _frequency: Adw.ComboRow;
    private readonly _target: Gtk.SpinButton;
    private readonly _initial: RecurringTrack | undefined;

    constructor(initial?: RecurringTrack) {
        this._initial = initial;
        this.group = new Adw.PreferencesGroup({ title: 'Recurring' });

        this._frequency = new Adw.ComboRow({
            title: 'Frequency',
            model: Gtk.StringList.new(FREQUENCIES),
        });
        this._frequency.set_selected(FREQUENCIES.indexOf(initial?.frequency ?? 'daily'));
        this.group.add(this._frequency);

        const targetRow = new Adw.ActionRow({ title: 'Target per period' });
        this._target = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 1000, step_increment: 1,
                value: initial?.target ?? 1,
            }),
            valign: Gtk.Align.CENTER,
        });
        targetRow.add_suffix(this._target);
        this.group.add(targetRow);
    }

    read(base: BaseTrack): Track {
        const idx = this._frequency.get_selected();
        const frequency: RecurringTrack['frequency'] = FREQUENCIES[idx] ?? 'daily';
        const out: RecurringTrack = {
            ...base,
            mode: 'recurring',
            frequency,
            target: this._target.get_value_as_int(),
            // Preserve existing history/streak when editing.
            history: this._initial?.history ?? [],
            streak: this._initial?.streak ?? 0,
            lastCheckin: this._initial?.lastCheckin ?? '',
        };
        return out;
    }
}
