import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import type Gio from 'gi://Gio';

import type { Track } from '../../extension/lib/modes/types.js';
import {
    addTrack as storeAdd,
    deleteTrack,
    loadTracks,
    updateTrack as storeUpdate,
} from '../../extension/lib/store.js';

import { TrackEditor } from './TrackEditor.js';
import { TrackRow } from './TrackRow.js';

export class PreferencesController {
    private readonly _settings: Gio.Settings;
    private readonly _window: Adw.PreferencesWindow;
    private readonly _extPath: string;
    private _group!: Adw.PreferencesGroup;
    /** Rows we've added to `_group` — tracked explicitly because
     *  Adw.PreferencesGroup's internal child is a container, so walking
     *  get_first_child() doesn't yield the rows we added. */
    private _rows: Gtk.Widget[] = [];

    constructor(settings: Gio.Settings, window: Adw.PreferencesWindow, extPath: string) {
        this._settings = settings;
        this._window = window;
        this._extPath = extPath;
    }

    build(): void {
        this._window.set_default_size(560, 720);

        const page = new Adw.PreferencesPage({
            title: 'Tracks',
            icon_name: 'view-list-symbolic',
        });
        this._window.add(page);

        this._group = new Adw.PreferencesGroup({ title: 'Your Tracks' });
        // Header suffix: refresh button re-reads tracks from GSettings so
        // the list reflects any external changes (indicator edits, other
        // prefs windows, manual gsettings tweaks) without reopening prefs.
        const refreshBtn = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            tooltip_text: 'Reload tracks',
            css_classes: ['flat'],
            valign: Gtk.Align.CENTER,
        });
        refreshBtn.connect('clicked', () => this._renderTracks());
        this._group.set_header_suffix(refreshBtn);
        page.add(this._group);

        this._renderTracks();

        const addGroup = new Adw.PreferencesGroup();
        const addBtn = new Gtk.Button({
            label: '+ Add Track',
            halign: Gtk.Align.CENTER,
            margin_top: 12,
            css_classes: ['suggested-action', 'pill'],
        });
        addBtn.connect('clicked', () => this._openEditor());
        addGroup.add(addBtn);
        page.add(addGroup);
    }

    private _renderTracks(): void {
        for (const row of this._rows) {
            this._group.remove(row);
        }
        this._rows = [];

        const tracks = loadTracks(this._settings);

        if (tracks.length === 0) {
            const empty = new Adw.ActionRow({ title: 'No tracks yet. Add one below.' });
            this._group.add(empty);
            this._rows.push(empty);
            return;
        }

        for (const track of tracks) {
            const row = new TrackRow().setup(
                track,
                (id: string) => this._deleteTrack(id),
                () => this._openEditor(track),
            );
            this._group.add(row);
            this._rows.push(row);
        }
    }

    private _openEditor(existing?: Track): void {
        const editor = new TrackEditor({
            parent: this._window,
            settings: this._settings,
            extPath: this._extPath,
            ...(existing !== undefined ? { existing } : {}),
            onSave: (track) => this._saveTrack(track, existing !== undefined),
            onLinksChanged: () => this._renderTracks(),
        });
        editor.present();
    }

    private _saveTrack(track: Track, isEdit: boolean): void {
        if (isEdit) {
            storeUpdate(this._settings, track.id, () => track);
        } else {
            storeAdd(this._settings, track);
        }
        this._renderTracks();
    }

    private _deleteTrack(id: string): void {
        deleteTrack(this._settings, id);
        this._renderTracks();
    }
}
