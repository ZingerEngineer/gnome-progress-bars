import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import type { BaseTrack, ConsumptionTrack, Track } from '../../../extension/lib/modes/types.js';
import type { ModeForm } from './types.js';

export class ConsumptionForm implements ModeForm {
    readonly group: Adw.PreferencesGroup;
    private readonly _initial: Gtk.SpinButton;
    private readonly _current: Gtk.SpinButton;
    private readonly _step: Gtk.SpinButton;

    constructor(initial?: ConsumptionTrack) {
        this.group = new Adw.PreferencesGroup({
            title: 'Consumption',
            description: 'Starts at initial, decreases toward zero.',
        });

        const initialRow = new Adw.ActionRow({ title: 'Initial amount' });
        this._initial = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 1_000_000, step_increment: 1,
                value: initial?.initial ?? 100,
            }),
            valign: Gtk.Align.CENTER,
        });
        initialRow.add_suffix(this._initial);
        this.group.add(initialRow);

        const currentRow = new Adw.ActionRow({ title: 'Current remaining' });
        this._current = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 1_000_000, step_increment: 1,
                value: initial?.current ?? initial?.initial ?? 100,
            }),
            valign: Gtk.Align.CENTER,
        });
        currentRow.add_suffix(this._current);
        this.group.add(currentRow);

        const stepRow = new Adw.ActionRow({ title: 'Step size' });
        this._step = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 1_000_000, step_increment: 1,
                value: initial?.step ?? 1,
            }),
            valign: Gtk.Align.CENTER,
        });
        stepRow.add_suffix(this._step);
        this.group.add(stepRow);
    }

    read(base: BaseTrack): Track {
        const out: ConsumptionTrack = {
            ...base,
            mode: 'consumption',
            initial: this._initial.get_value_as_int(),
            current: this._current.get_value_as_int(),
            step: this._step.get_value_as_int(),
        };
        return out;
    }
}
