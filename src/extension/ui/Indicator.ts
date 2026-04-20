import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import type { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { TrackItem } from './TrackItem.js';
import {
    deleteTrack,
    getChildren,
    loadLinks,
    loadTracks,
    updateTrack,
} from '../lib/store.js';
import type { Track, TrackLink } from '../lib/modes/types.js';
import { calcProgress } from '../lib/modes/index.js';

/**
 * Collects the ribbon color for every parent of `childId`. A track can have
 * multiple parents — this returns one color per parent, in link `order`,
 * so the child renders one short ribbon stripe per parent. Falls back to
 * the parent's bar fill color if the parent's own ribbon is disabled, so
 * hierarchy is still visible.
 */
function parentRibbonColorsFor(
    tracks: Track[],
    links: TrackLink[],
    childId: string,
): string[] {
    const byId = new Map(tracks.map(t => [t.id, t] as const));
    return links
        .filter(l => l.childId === childId)
        .sort((a, b) => a.order - b.order)
        .map((l) => {
            const parent = byId.get(l.parentId);
            if (parent === undefined) return null;
            return parent.ribbon !== undefined && parent.ribbon.enabled
                ? parent.ribbon.color
                : parent.colors.normal;
        })
        .filter((c): c is string => c !== null);
}

/**
 * Picks the "most urgent" track for the panel summary — preference order:
 *   1. Any overdue track (progress > 1)
 *   2. Highest progress below 1 (closest to completion)
 *   3. Fallback: first track
 */
function mostUrgent(tracks: Track[]): Track | null {
    if (tracks.length === 0) return null;

    let best: Track | null = null;
    let bestScore = -Infinity;
    for (const t of tracks) {
        const p = calcProgress(t);
        const score = p > 1 ? 10 + p : p;
        if (score > bestScore) {
            best = t;
            bestScore = score;
        }
    }
    return best ?? tracks[0] ?? null;
}

export const ProgressBarsIndicator = GObject.registerClass(
class ProgressBarsIndicator extends PanelMenu.Button {
    private _ext!: Extension;
    private _settings!: Gio.Settings;
    private _settingsId: number | null = null;
    private _linksSettingsId: number | null = null;

    private _panelIcon!: St.Icon;
    private _panelLabel!: St.Label;
    private _panelPct!: St.Label;
    private _colorSchemeId: number | null = null;

    /** null = flat view; otherwise the id of the focused track. */
    private _focusedId: string | null = null;

    setup(extension: Extension): this {
        this._ext = extension;
        this._settings = extension.getSettings();

        const box = new St.BoxLayout({ style_class: 'panel-status-menu-box pb-panel' });
        this._panelIcon = new St.Icon({
            icon_size: 16,
            style_class: 'pb-panel-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._applyPanelIcon();
        box.add_child(this._panelIcon);

        // Swap light/dark icon when the Shell color scheme changes.
        const stSettings = St.Settings.get();
        this._colorSchemeId = stSettings.connect(
            'notify::color-scheme',
            () => this._applyPanelIcon(),
        );

        this._panelLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'pb-panel-count',
        });
        box.add_child(this._panelLabel);

        this._panelPct = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'pb-panel-pct',
        });
        box.add_child(this._panelPct);

        this.add_child(box);

        this._settingsId = this._settings.connect('changed::tracks', () => this._rebuild());
        this._linksSettingsId = this._settings.connect('changed::links', () => this._rebuild());
        this._rebuild();

        return this;
    }

    private get _popupMenu(): PopupMenu.PopupMenu {
        return this.menu as PopupMenu.PopupMenu;
    }

    private _applyPanelIcon(): void {
        const scheme = St.Settings.get().colorScheme;
        const variant = scheme === St.SystemColorScheme.PREFER_LIGHT
            ? 'progress-bar-light.svg'
            : 'progress-bar-dark.svg';
        const path = this._ext.path + '/icons/' + variant;
        this._panelIcon.set_gicon(Gio.FileIcon.new(Gio.File.new_for_path(path)));
    }

    /** Lightweight refresh for time-based labels — panel only, no menu rebuild. */
    refresh(): void {
        this._updatePanel();
    }

    private _rebuild(): void {
        this._updatePanel();
        this._buildMenu();
    }

    private _updatePanel(): void {
        const tracks = loadTracks(this._settings).filter(t => !t.hidden);

        if (tracks.length === 0) {
            this._panelLabel.set_text('');
            this._panelPct.set_text('');
            return;
        }

        this._panelLabel.set_text(` ${tracks.length}`);

        const urgent = mostUrgent(tracks);
        if (urgent === null) {
            this._panelPct.set_text('');
        } else {
            const p = calcProgress(urgent);
            const pct = Math.round(p * 100);
            this._panelPct.set_text(p > 1 ? ` · ${pct}% ⚠` : ` · ${pct}%`);
        }
    }

    private _buildMenu(): void {
        const menu = this._popupMenu;
        menu.removeAll();

        const allTracks = loadTracks(this._settings);
        const visibleTracks = allTracks.filter(t => !t.hidden);
        const links = loadLinks(this._settings);

        // Resolve focused track — may have been deleted meanwhile.
        const focused = this._focusedId !== null
            ? (visibleTracks.find(t => t.id === this._focusedId) ?? null)
            : null;
        if (this._focusedId !== null && focused === null) {
            this._focusedId = null;
        }

        if (visibleTracks.length === 0) {
            menu.addMenuItem(new PopupMenu.PopupMenuItem(
                'No tracks yet — open Preferences to add one.',
            ));
        } else if (focused !== null) {
            // ── Focused (drill-in) view ──
            const backItem = new PopupMenu.PopupMenuItem('‹ Back to all tracks');
            backItem.connect('activate', () => {
                this._focusedId = null;
                this._buildMenu();
            });
            menu.addMenuItem(backItem);
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // The parent bar itself, with its completion dots.
            const focusedChildren = getChildren(allTracks, links, focused.id)
                .filter(t => !t.hidden);
            this._appendTrackItem(
                menu,
                focused,
                focusedChildren,
                focused.ribbon !== undefined && focused.ribbon.inheritFromParents
                    ? parentRibbonColorsFor(allTracks, links, focused.id)
                    : undefined,
            );
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Its direct children (no further nesting — 2-level display).
            if (focusedChildren.length === 0) {
                const empty = new PopupMenu.PopupMenuItem(
                    '(No linked children. Add some from Preferences.)',
                    { reactive: false },
                );
                menu.addMenuItem(empty);
            } else {
                for (const child of focusedChildren) {
                    // Children show their own dots too (useful preview).
                    const grandchildren = getChildren(allTracks, links, child.id)
                        .filter(t => !t.hidden);
                    this._appendTrackItem(
                        menu,
                        child,
                        grandchildren,
                        child.ribbon !== undefined && child.ribbon.inheritFromParents
                            ? parentRibbonColorsFor(allTracks, links, child.id)
                            : undefined,
                    );
                    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                }
            }
        } else {
            // ── Flat view: all non-hidden tracks ──
            for (const track of visibleTracks) {
                const children = getChildren(allTracks, links, track.id)
                    .filter(t => !t.hidden);
                this._appendTrackItem(
                    menu,
                    track,
                    children,
                    track.ribbon !== undefined && track.ribbon.inheritFromParents
                        ? parentRibbonColorsFor(allTracks, links, track.id)
                        : undefined,
                );
                menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
        }

        const prefsItem = new PopupMenu.PopupMenuItem('Preferences…');
        prefsItem.connect('activate', () => this._ext.openPreferences());
        menu.addMenuItem(prefsItem);
    }

    private _appendTrackItem(
        menu: PopupMenu.PopupMenu,
        track: Track,
        children: Track[],
        parentRibbonColors?: string[],
    ): void {
        const item = new TrackItem().setup(track, {
            onChange: (updated) => this._commit(updated),
            onFocus: (id) => {
                this._focusedId = id;
                this._buildMenu();
            },
            onToggleHidden: (id) => this._toggleHidden(id),
            onDelete: (id) => this._confirmDelete(id),
            children,
            extPath: this._ext.path,
            ...(parentRibbonColors !== undefined && parentRibbonColors.length > 0
                ? { parentRibbonColors }
                : {}),
        });
        menu.addMenuItem(item);
    }

    private _commit(track: Track): void {
        updateTrack(this._settings, track.id, () => track);
        // `changed::tracks` signal triggers _rebuild automatically.
    }

    private _toggleHidden(id: string): void {
        updateTrack(this._settings, id, t => ({ ...t, hidden: !t.hidden } as Track));
    }

    /**
     * Pops a Shell modal asking the user to confirm deletion. If the track
     * has children, an extra "delete children too" option is offered.
     * Closes the popup menu first so the modal isn't trapped behind it.
     */
    private _confirmDelete(id: string): void {
        const tracks = loadTracks(this._settings);
        const track = tracks.find(t => t.id === id);
        if (track === undefined) return;

        const links = loadLinks(this._settings);
        const hasChildren = links.some(l => l.parentId === id);

        // Close the popover first; ModalDialog grabs the keyboard.
        this._popupMenu.close(0);

        const dialog = new ModalDialog.ModalDialog({ destroyOnClose: true });

        const title = new St.Label({
            text: `Delete "${track.name}"?`,
            style_class: 'pb-dialog-title',
        });
        dialog.contentLayout.add_child(title);

        dialog.contentLayout.add_child(new St.Label({
            text: 'This cannot be undone.',
            style_class: 'pb-dialog-body',
        }));

        // Cascade choice — only meaningful when there are linked children.
        // Default to "this only" so we never silently take the destructive
        // path.
        let cascade = false;
        if (hasChildren) {
            const choiceBox = new St.BoxLayout({
                vertical: true,
                style_class: 'pb-dialog-choices',
            });

            const thisOnly = new St.Button({
                style_class: 'pb-dialog-choice pb-dialog-choice-active',
                label: '◉  Delete this track only',
                can_focus: true,
                x_align: Clutter.ActorAlign.START,
            });
            const withChildren = new St.Button({
                style_class: 'pb-dialog-choice',
                label: '○  Delete this track and all its children',
                can_focus: true,
                x_align: Clutter.ActorAlign.START,
            });

            const setChoice = (c: boolean): void => {
                cascade = c;
                thisOnly.set_label(c ? '○  Delete this track only' : '◉  Delete this track only');
                withChildren.set_label(c
                    ? '◉  Delete this track and all its children'
                    : '○  Delete this track and all its children');
                if (c) {
                    thisOnly.remove_style_class_name('pb-dialog-choice-active');
                    withChildren.add_style_class_name('pb-dialog-choice-active');
                } else {
                    withChildren.remove_style_class_name('pb-dialog-choice-active');
                    thisOnly.add_style_class_name('pb-dialog-choice-active');
                }
            };
            thisOnly.connect('clicked', () => setChoice(false));
            withChildren.connect('clicked', () => setChoice(true));

            choiceBox.add_child(thisOnly);
            choiceBox.add_child(withChildren);
            dialog.contentLayout.add_child(choiceBox);
        }

        dialog.setButtons([
            {
                label: 'Cancel',
                action: () => dialog.close(),
                key: Clutter.KEY_Escape,
                default: true,
            },
            {
                label: 'Delete',
                action: () => {
                    deleteTrack(this._settings, id, { cascade });
                    dialog.close();
                },
            },
        ]);

        dialog.open();
    }

    override destroy(): void {
        if (this._settingsId !== null) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        if (this._linksSettingsId !== null) {
            this._settings.disconnect(this._linksSettingsId);
            this._linksSettingsId = null;
        }
        if (this._colorSchemeId !== null) {
            St.Settings.get().disconnect(this._colorSchemeId);
            this._colorSchemeId = null;
        }
        super.destroy();
    }
});

export type ProgressBarsIndicator = InstanceType<typeof ProgressBarsIndicator>;
