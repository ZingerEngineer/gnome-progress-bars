import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import type { TrackColors } from '../../extension/lib/modes/types.js';

function rgbaToHex(rgba: Gdk.RGBA): string {
    const to2 = (n: number): string => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${to2(rgba.red)}${to2(rgba.green)}${to2(rgba.blue)}`;
}

function hexToRgba(hex: string): Gdk.RGBA {
    const rgba = new Gdk.RGBA();
    if (!rgba.parse(hex)) rgba.parse('#808080');
    return rgba;
}

function colorRow(title: string, initial: string): {
    row: Adw.ActionRow;
    button: Gtk.ColorDialogButton;
} {
    const row = new Adw.ActionRow({ title });
    const button = new Gtk.ColorDialogButton({
        dialog: new Gtk.ColorDialog({ with_alpha: false }),
        rgba: hexToRgba(initial),
        valign: Gtk.Align.CENTER,
    });
    row.add_suffix(button);
    row.set_activatable_widget(button);
    return { row, button };
}

/** Three color buttons for normal/warning/overdue states. */
export class ColorPicker {
    readonly group: Adw.PreferencesGroup;
    private readonly _normal: Gtk.ColorDialogButton;
    private readonly _warning: Gtk.ColorDialogButton;
    private readonly _overdue: Gtk.ColorDialogButton;

    constructor(initial: TrackColors) {
        this.group = new Adw.PreferencesGroup({ title: 'Colors' });

        const n = colorRow('Normal', initial.normal);
        const w = colorRow('Warning', initial.warning);
        const o = colorRow('Overdue', initial.overdue);

        this._normal = n.button;
        this._warning = w.button;
        this._overdue = o.button;

        this.group.add(n.row);
        this.group.add(w.row);
        this.group.add(o.row);
    }

    read(): TrackColors {
        return {
            normal: rgbaToHex(this._normal.get_rgba()),
            warning: rgbaToHex(this._warning.get_rgba()),
            overdue: rgbaToHex(this._overdue.get_rgba()),
        };
    }
}
