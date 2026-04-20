import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import type { ReminderOptions } from '../../extension/lib/modes/types.js';

const THRESHOLDS = [25, 50, 75, 100];

/** Reminder thresholds (check boxes) + overdue-daily toggle. */
export class ReminderEditor {
    readonly group: Adw.PreferencesGroup;
    private readonly _checks = new Map<number, Gtk.CheckButton>();
    private readonly _overdueSwitch: Gtk.Switch;

    constructor(initial: ReminderOptions) {
        this.group = new Adw.PreferencesGroup({
            title: 'Reminders',
            description: 'Notify when progress crosses these percentages.',
        });

        // Threshold row with inline check buttons.
        const thresholdRow = new Adw.ActionRow({ title: 'Thresholds' });
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            valign: Gtk.Align.CENTER,
        });
        for (const pct of THRESHOLDS) {
            const cb = new Gtk.CheckButton({
                label: `${pct}%`,
                active: initial.thresholds.includes(pct),
            });
            this._checks.set(pct, cb);
            box.append(cb);
        }
        thresholdRow.add_suffix(box);
        this.group.add(thresholdRow);

        // Overdue-daily switch.
        const overdueRow = new Adw.ActionRow({
            title: 'Daily overdue notifications',
            subtitle: 'Only applies to overdue-mode tracks.',
        });
        this._overdueSwitch = new Gtk.Switch({
            active: initial.overdueDaily,
            valign: Gtk.Align.CENTER,
        });
        overdueRow.add_suffix(this._overdueSwitch);
        overdueRow.set_activatable_widget(this._overdueSwitch);
        this.group.add(overdueRow);
    }

    read(): ReminderOptions {
        const thresholds: number[] = [];
        for (const [pct, cb] of this._checks) {
            if (cb.get_active()) thresholds.push(pct);
        }
        thresholds.sort((a, b) => a - b);
        return {
            thresholds,
            overdueDaily: this._overdueSwitch.get_active(),
        };
    }
}
