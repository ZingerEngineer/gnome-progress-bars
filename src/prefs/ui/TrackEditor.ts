import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import type Gio from 'gi://Gio';

import Gdk from 'gi://Gdk';

import {
    DEFAULT_RIBBON,
    makeBase,
    type BaseTrack,
    type ProgressMode,
    type Track,
} from '../../extension/lib/modes/types.js';
import {
    addLink,
    getChildren,
    loadLinks,
    loadTracks,
    removeLink,
    reorderChildren,
    wouldCreateCycle,
} from '../../extension/lib/store.js';

import { ColorPicker } from './ColorPicker.js';
import { IconPicker } from './IconPicker.js';
import { ReminderEditor } from './ReminderEditor.js';
import { createForm, MODE_LABELS, MODE_ORDER, type ModeForm } from './forms/index.js';

export interface TrackEditorOptions {
    parent: Gtk.Window;
    settings: Gio.Settings;
    /** Absolute path of the extension dir — used to locate the bundled icon library. */
    extPath: string;
    existing?: Track;
    onSave: (track: Track) => void;
    /** Fired when the editor mutates links — the parent view should refresh. */
    onLinksChanged?: () => void;
}

function rgbaToHex(rgba: Gdk.RGBA): string {
    const to2 = (n: number): string => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${to2(rgba.red)}${to2(rgba.green)}${to2(rgba.blue)}`;
}

function hexToRgba(hex: string): Gdk.RGBA {
    const rgba = new Gdk.RGBA();
    if (!rgba.parse(hex)) rgba.parse('#3cff72');
    return rgba;
}

/**
 * An Adw.Window that edits a single track. Swaps the per-mode form group
 * in/out when the user picks a different mode from the dropdown.
 */
export class TrackEditor {
    private readonly _window: Adw.Window;
    private readonly _page: Adw.PreferencesPage;
    private readonly _nameEntry: Adw.EntryRow;
    private readonly _showLabelSwitch: Gtk.Switch;
    private readonly _hiddenSwitch: Gtk.Switch;
    private readonly _ribbonSwitch: Gtk.Switch;
    private readonly _ribbonColor: Gtk.ColorDialogButton;
    private readonly _ribbonInheritSwitch: Gtk.Switch;
    private readonly _modeRow: Adw.ComboRow;
    private readonly _iconPicker: IconPicker;
    private readonly _colorPicker: ColorPicker;
    private readonly _reminderEditor: ReminderEditor;

    private readonly _formSlot: Adw.PreferencesGroup;
    private _currentForm: ModeForm;
    private _currentMode: ProgressMode;

    private readonly _existing: Track | undefined;
    private readonly _settings: Gio.Settings;
    private readonly _onSave: (track: Track) => void;
    private readonly _onLinksChanged: (() => void) | undefined;

    // Linked-children section state (only meaningful when editing an existing track).
    private _childrenGroup: Adw.PreferencesGroup | null = null;

    constructor(opts: TrackEditorOptions) {
        this._existing = opts.existing;
        this._settings = opts.settings;
        this._onSave = opts.onSave;
        this._onLinksChanged = opts.onLinksChanged;

        this._window = new Adw.Window({
            title: opts.existing !== undefined ? 'Edit Track' : 'New Track',
            transient_for: opts.parent,
            modal: true,
            default_width: 540,
            default_height: 760,
        });

        // ── Toolbar + header with Cancel / Save ──
        const toolbar = new Adw.ToolbarView();
        this._window.set_content(toolbar);

        const header = new Adw.HeaderBar({ show_end_title_buttons: false });
        toolbar.add_top_bar(header);

        const cancelBtn = new Gtk.Button({ label: 'Cancel' });
        cancelBtn.connect('clicked', () => this._window.close());
        header.pack_start(cancelBtn);

        const saveBtn = new Gtk.Button({
            label: 'Save',
            css_classes: ['suggested-action'],
        });
        saveBtn.connect('clicked', () => this._save());
        header.pack_end(saveBtn);

        // ── Scrollable preferences page ──
        this._page = new Adw.PreferencesPage();
        toolbar.set_content(this._page);

        // Common fields group
        const common = new Adw.PreferencesGroup({ title: 'General' });
        this._page.add(common);

        this._nameEntry = new Adw.EntryRow({ title: 'Name' });
        this._nameEntry.set_text(opts.existing?.name ?? '');
        common.add(this._nameEntry);

        this._iconPicker = new IconPicker(
            opts.extPath,
            opts.existing?.iconPath ?? '',
            opts.existing?.iconTint ?? '',
        );
        common.add(this._iconPicker.row);

        const labelRow = new Adw.ActionRow({
            title: 'Show label',
            subtitle: 'Display text beside the progress bar',
        });
        this._showLabelSwitch = new Gtk.Switch({
            active: opts.existing?.label.show ?? true,
            valign: Gtk.Align.CENTER,
        });
        labelRow.add_suffix(this._showLabelSwitch);
        labelRow.set_activatable_widget(this._showLabelSwitch);
        common.add(labelRow);

        const hiddenRow = new Adw.ActionRow({
            title: 'Hide from panel',
            subtitle: 'Ignore this track in the top-bar menu (still editable here)',
        });
        this._hiddenSwitch = new Gtk.Switch({
            active: opts.existing?.hidden ?? false,
            valign: Gtk.Align.CENTER,
        });
        hiddenRow.add_suffix(this._hiddenSwitch);
        hiddenRow.set_activatable_widget(this._hiddenSwitch);
        common.add(hiddenRow);

        // ── Ribbon (optional decorative strip) ──
        const ribbonInitial = opts.existing?.ribbon ?? DEFAULT_RIBBON;
        const ribbonRow = new Adw.ActionRow({
            title: 'Ribbon',
            subtitle: 'Decorative strip at the top of the track',
        });
        this._ribbonSwitch = new Gtk.Switch({
            active: ribbonInitial.enabled,
            valign: Gtk.Align.CENTER,
        });
        this._ribbonColor = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({ with_alpha: false }),
            rgba: hexToRgba(ribbonInitial.color),
            valign: Gtk.Align.CENTER,
            sensitive: ribbonInitial.enabled,
        });
        ribbonRow.add_suffix(this._ribbonColor);
        ribbonRow.add_suffix(this._ribbonSwitch);
        ribbonRow.set_activatable_widget(this._ribbonSwitch);
        common.add(ribbonRow);

        // "Inherit from parents" — when ON, this track renders one short
        // stripe per linked parent instead of its own ribbon, and the
        // dedicated color picker above is disabled.
        const inheritRow = new Adw.ActionRow({
            title: 'Inherit ribbon from parents',
            subtitle: 'Show one stripe per linked parent using their ribbon colors',
        });
        this._ribbonInheritSwitch = new Gtk.Switch({
            active: ribbonInitial.inheritFromParents,
            valign: Gtk.Align.CENTER,
        });
        inheritRow.add_suffix(this._ribbonInheritSwitch);
        inheritRow.set_activatable_widget(this._ribbonInheritSwitch);
        common.add(inheritRow);

        // When inheriting, the track's own ribbon switch + color are moot.
        const syncRibbonSensitivity = (): void => {
            const inherit = this._ribbonInheritSwitch.get_active();
            const enabled = this._ribbonSwitch.get_active();
            this._ribbonSwitch.set_sensitive(!inherit);
            this._ribbonColor.set_sensitive(!inherit && enabled);
        };
        this._ribbonSwitch.connect('notify::active', syncRibbonSensitivity);
        this._ribbonInheritSwitch.connect('notify::active', syncRibbonSensitivity);
        syncRibbonSensitivity();

        // Mode selector group
        const modeGroup = new Adw.PreferencesGroup({ title: 'Mode' });
        this._page.add(modeGroup);

        const modeLabels = MODE_ORDER.map(m => MODE_LABELS[m]);
        this._modeRow = new Adw.ComboRow({
            title: 'Progress mode',
            model: Gtk.StringList.new(modeLabels),
        });
        this._currentMode = opts.existing?.mode ?? 'linear';
        this._modeRow.set_selected(MODE_ORDER.indexOf(this._currentMode));
        this._modeRow.connect('notify::selected', () => this._onModeChanged());
        modeGroup.add(this._modeRow);

        // Per-mode form slot — kept in a container we can swap.
        this._formSlot = new Adw.PreferencesGroup();
        this._page.add(this._formSlot);
        this._currentForm = createForm(this._currentMode, opts.existing);
        this._page.add(this._currentForm.group);

        // Colors / reminders
        this._colorPicker = new ColorPicker(opts.existing?.colors ?? {
            normal: '#4caf50', warning: '#ffaa44', overdue: '#e53935',
        });
        this._page.add(this._colorPicker.group);

        this._reminderEditor = new ReminderEditor(opts.existing?.reminders ?? {
            thresholds: [25, 50, 75, 100],
            overdueDaily: false,
        });
        this._page.add(this._reminderEditor.group);

        // Linked children — only when editing an existing track.
        if (opts.existing !== undefined) {
            this._childrenGroup = new Adw.PreferencesGroup({
                title: 'Linked children',
                description: 'Direct children of this track. Dots on the bar mark completed children.',
            });
            this._page.add(this._childrenGroup);
            this._renderChildren();
        } else {
            const hint = new Adw.PreferencesGroup({ title: 'Linked children' });
            hint.add(new Adw.ActionRow({
                title: 'Save the track first',
                subtitle: 'You can link children after the track exists.',
            }));
            this._page.add(hint);
        }
    }

    present(): void {
        this._window.present();
    }

    // ── Internals ────────────────────────────────────────────────────────

    private _onModeChanged(): void {
        const idx = this._modeRow.get_selected();
        const newMode = MODE_ORDER[idx] ?? 'linear';
        if (newMode === this._currentMode) return;

        // Remove the previous form group from the page.
        this._page.remove(this._currentForm.group);

        // Build a fresh form. If the discriminant matches the existing
        // track, reuse its values; otherwise start empty.
        this._currentMode = newMode;
        this._currentForm = createForm(newMode, this._existing);
        this._page.add(this._currentForm.group);
    }

    private _renderChildren(): void {
        if (this._childrenGroup === null || this._existing === undefined) return;
        const group = this._childrenGroup;
        const parentId = this._existing.id;

        // Clear existing rows.
        let child = group.get_first_child();
        while (child !== null) {
            const next = child.get_next_sibling();
            group.remove(child);
            child = next;
        }

        const allTracks = loadTracks(this._settings);
        const links = loadLinks(this._settings);
        const children = getChildren(allTracks, links, parentId);
        const childIds = children.map(c => c.id);

        if (children.length === 0) {
            group.add(new Adw.ActionRow({
                title: 'No children linked yet.',
            }));
        } else {
            children.forEach((c, i) => {
                const row = new Adw.ActionRow({ title: c.name });
                row.set_subtitle(MODE_LABELS[c.mode]);

                const upBtn = new Gtk.Button({
                    icon_name: 'go-up-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    sensitive: i > 0,
                    tooltip_text: 'Move up',
                });
                upBtn.connect('clicked', () => {
                    const reordered = [...childIds];
                    const tmp = reordered[i - 1];
                    const cur = reordered[i];
                    if (tmp === undefined || cur === undefined) return;
                    reordered[i - 1] = cur;
                    reordered[i] = tmp;
                    reorderChildren(this._settings, parentId, reordered);
                    this._renderChildren();
                    this._onLinksChanged?.();
                });
                row.add_suffix(upBtn);

                const downBtn = new Gtk.Button({
                    icon_name: 'go-down-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    sensitive: i < children.length - 1,
                    tooltip_text: 'Move down',
                });
                downBtn.connect('clicked', () => {
                    const reordered = [...childIds];
                    const tmp = reordered[i + 1];
                    const cur = reordered[i];
                    if (tmp === undefined || cur === undefined) return;
                    reordered[i + 1] = cur;
                    reordered[i] = tmp;
                    reorderChildren(this._settings, parentId, reordered);
                    this._renderChildren();
                    this._onLinksChanged?.();
                });
                row.add_suffix(downBtn);

                const delBtn = new Gtk.Button({
                    icon_name: 'list-remove-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat', 'destructive-action'],
                    tooltip_text: 'Unlink child',
                });
                delBtn.connect('clicked', () => {
                    removeLink(this._settings, parentId, c.id);
                    this._renderChildren();
                    this._onLinksChanged?.();
                });
                row.add_suffix(delBtn);

                group.add(row);
            });
        }

        // "Add child" dropdown — only eligible tracks.
        const eligible = allTracks.filter(t => {
            if (t.id === parentId) return false;
            if (childIds.includes(t.id)) return false;
            return !wouldCreateCycle(links, parentId, t.id);
        });

        if (eligible.length > 0) {
            const addRow = new Adw.ActionRow({ title: 'Link a child…' });
            const model = Gtk.StringList.new(eligible.map(t => t.name));
            const combo = new Gtk.DropDown({
                model,
                valign: Gtk.Align.CENTER,
            });
            addRow.add_suffix(combo);

            const addBtn = new Gtk.Button({
                icon_name: 'list-add-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat'],
                tooltip_text: 'Add link',
            });
            addBtn.connect('clicked', () => {
                const idx = combo.get_selected();
                const pick = eligible[idx];
                if (pick === undefined) return;
                if (addLink(this._settings, parentId, pick.id)) {
                    this._renderChildren();
                    this._onLinksChanged?.();
                }
            });
            addRow.add_suffix(addBtn);
            group.add(addRow);
        } else if (children.length > 0) {
            group.add(new Adw.ActionRow({
                title: 'All other tracks are already linked or would create a cycle.',
            }));
        }
    }

    private _buildBase(): BaseTrack {
        const id = this._existing?.id ?? GLib.uuid_string_random();
        const base = makeBase(id, this._nameEntry.get_text().trim());

        base.iconPath = this._iconPicker.read();
        base.iconTint = this._iconPicker.readTint();
        base.colors = this._colorPicker.read();
        base.reminders = this._reminderEditor.read();
        base.label = { show: this._showLabelSwitch.get_active() };
        base.hidden = this._hiddenSwitch.get_active();
        base.ribbon = {
            enabled: this._ribbonSwitch.get_active(),
            color: rgbaToHex(this._ribbonColor.get_rgba()),
            inheritFromParents: this._ribbonInheritSwitch.get_active(),
        };

        // Clear fired thresholds if the mode changed — they no longer apply.
        if (this._existing !== undefined && this._existing.mode === this._currentMode) {
            base.firedThresholds = [...this._existing.firedThresholds];
        } else {
            base.firedThresholds = [];
        }

        return base;
    }

    private _save(): void {
        const base = this._buildBase();
        if (base.name.length === 0) return;

        const track = this._currentForm.read(base);
        this._onSave(track);
        this._window.close();
    }
}
