import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import type { Track } from '../../extension/lib/modes/types.js';
import { MODE_LABELS } from './forms/index.js';
import { resolveIconPath } from '../lib/icons.js';

export const TrackRow = GObject.registerClass(
class TrackRow extends Adw.ActionRow {
    setup(
        track: Track,
        onDelete: (id: string) => void,
        onEdit: () => void,
    ): this {
        this.set_title(track.hidden ? `${track.name}  (hidden)` : track.name);
        this.set_subtitle(MODE_LABELS[track.mode]);
        this.set_activatable(true);
        this.connect('activated', () => onEdit());
        if (track.hidden) {
            this.add_css_class('dim-label');
        }

        // Prefix: icon preview if set
        const abs = resolveIconPath(track.iconPath);
        if (abs !== null) {
            const img = new Gtk.Image({
                pixel_size: 24,
                valign: Gtk.Align.CENTER,
            });
            img.set_from_file(abs);
            this.add_prefix(img);
        }

        const editBtn = new Gtk.Button({
            icon_name: 'document-edit-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Edit track',
        });
        editBtn.connect('clicked', () => onEdit());
        this.add_suffix(editBtn);

        const delBtn = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action', 'flat'],
            tooltip_text: 'Delete track',
        });
        delBtn.connect('clicked', () => onDelete(track.id));
        this.add_suffix(delBtn);

        return this;
    }
});

export type TrackRow = InstanceType<typeof TrackRow>;
