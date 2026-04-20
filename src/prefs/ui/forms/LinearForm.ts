import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import type { BaseTrack, LinearTrack, Track } from '../../../extension/lib/modes/types.js';
import type { ModeForm } from './types.js';

function spinRow(title: string, value: number, lower: number, upper: number, step: number): {
    row: Adw.ActionRow; spin: Gtk.SpinButton;
} {
    const row = new Adw.ActionRow({ title });
    const spin = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({ lower, upper, step_increment: step, value }),
        digits: 0,
        valign: Gtk.Align.CENTER,
    });
    row.add_suffix(spin);
    row.set_activatable_widget(spin);
    return { row, spin };
}

export class LinearForm implements ModeForm {
    readonly group: Adw.PreferencesGroup;
    private readonly _current: Gtk.SpinButton;
    private readonly _max: Gtk.SpinButton;
    private readonly _step: Gtk.SpinButton;

    constructor(initial?: LinearTrack) {
        this.group = new Adw.PreferencesGroup({ title: 'Linear values' });

        const current = spinRow('Current', initial?.current ?? 0, 0, 1_000_000, 1);
        const max = spinRow('Target', initial?.max ?? 100, 1, 1_000_000, 1);
        const step = spinRow('Step', initial?.step ?? 1, 1, 1000, 1);

        this._current = current.spin;
        this._max = max.spin;
        this._step = step.spin;

        this.group.add(current.row);
        this.group.add(max.row);
        this.group.add(step.row);
    }

    read(base: BaseTrack): Track {
        const out: LinearTrack = {
            ...base,
            mode: 'linear',
            current: this._current.get_value_as_int(),
            max: this._max.get_value_as_int(),
            step: this._step.get_value_as_int(),
        };
        return out;
    }
}
