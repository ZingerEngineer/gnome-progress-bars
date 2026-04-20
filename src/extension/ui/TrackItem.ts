import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import type { Track } from '../lib/modes/types.js';
import {
    calcProgress, decrement, formatTrack, increment, reset,
} from '../lib/modes/index.js';
import { fillColorFor } from './colorState.js';
import { resolveIconPath } from '../lib/iconPaths.js';

/** Hard cap on dots rendered next to a parent track. Anything beyond
 *  collapses into a single "+N" overflow chip. */
const MAX_DOTS = 12;

export interface TrackItemCallbacks {
    onChange: (updated: Track) => void;
    /** User clicked the chevron — drill into this track. */
    onFocus: (id: string) => void;
    /** User clicked the eye button — toggle hidden flag. */
    onToggleHidden: (id: string) => void;
    /** User clicked the delete button — open the confirm dialog. */
    onDelete: (id: string) => void;
    /**
     * Direct children of this track, used to draw completion dots over the
     * bar. The array is ordered by link `order`; only non-hidden children
     * are passed in.
     */
    children?: Track[];
    /** Absolute path to the extension dir — used to resolve action icons. */
    extPath: string;
    /**
     * Ribbon colors inherited from every parent this track is linked to.
     * Each color renders as a short, left-aligned ribbon stacked beside
     * its siblings, so a track that's a child of multiple parents shows
     * one stripe per parent. When provided (even if empty), this
     * overrides the track's own ribbon — the hierarchy display wins.
     */
    parentRibbonColors?: string[];
}

/**
 * Renders a single track as a row inside the indicator popover:
 *   ▔▔▔▔▔▔▔▔▔ (optional ribbon)
 *   [icon] name                 label
 *   [━━━━━━━━━━━━━━━━━]  ● ● ○   pct
 *   [−] [+] [step ✓]    [eye] [›] [↺] [✕]
 */
export const TrackItem = GObject.registerClass(
class TrackItem extends PopupMenu.PopupBaseMenuItem {
    setup(track: Track, cb: TrackItemCallbacks): this {
        const raw = calcProgress(track);
        const clamped = Math.max(0, Math.min(1, raw));
        const isComplete = raw >= 1;

        const col = new St.BoxLayout({
            style_class: isComplete ? 'pb-track pb-complete' : 'pb-track',
            vertical: true,
            x_expand: true,
        });
        this.add_child(col);

        // ── Optional ribbon strip at the very top of the card ──
        // If a parent ribbon color was passed in, children always draw a
        // shorter, left-aligned ribbon in the parent's color so the
        // hierarchy is visible at a glance — this overrides the child's
        // own ribbon color (the same color is the whole point).
        if (cb.parentRibbonColors !== undefined && cb.parentRibbonColors.length > 0) {
            const row = new St.BoxLayout({
                style_class: 'pb-ribbon-row',
                vertical: false,
                x_align: Clutter.ActorAlign.START,
                x_expand: true,
            });
            for (const color of cb.parentRibbonColors) {
                const ribbon = new St.Bin({
                    style_class: 'pb-ribbon pb-ribbon-child',
                    x_expand: false,
                    y_expand: false,
                });
                ribbon.set_style(
                    `background-color: ${color}; min-width: 32px; min-height: 4px;`,
                );
                row.add_child(ribbon);
            }
            col.add_child(row);
        } else if (track.ribbon !== undefined && track.ribbon.enabled) {
            const ribbon = new St.Widget({
                style_class: 'pb-ribbon',
                x_expand: true,
            });
            ribbon.set_style(`background-color: ${track.ribbon.color};`);
            col.add_child(ribbon);
        }

        // ── Header: icon + name + label text ──
        const header = new St.BoxLayout({
            style_class: 'pb-track-header',
            x_expand: true,
        });
        col.add_child(header);

        const iconAbs = resolveIconPath(track.iconPath);
        if (iconAbs !== null) {
            const icon = new St.Icon({
                gicon: Gio.FileIcon.new(Gio.File.new_for_path(iconAbs)),
                icon_size: 20,
                style_class: 'pb-track-icon',
                y_align: Clutter.ActorAlign.CENTER,
            });
            header.add_child(icon);
        }

        header.add_child(new St.Label({
            style_class: 'pb-track-name',
            text: track.name,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        }));

        if (track.label.show) {
            header.add_child(new St.Label({
                style_class: 'pb-track-label',
                text: formatTrack(track),
                y_align: Clutter.ActorAlign.CENTER,
            }));
        }

        // ── Progress bar ──
        const barBg = new St.BoxLayout({ style_class: 'pb-bar-bg', x_expand: true });
        col.add_child(barBg);

        const fillColor = fillColorFor(track);
        const fill = new St.Bin({ style_class: 'pb-bar-fill', x_expand: false });
        fill.set_style(`background-color: ${fillColor};`);
        barBg.add_child(fill);
        // Size the fill responsively to the bar's allocated width so "100%"
        // actually reaches the end of the bar regardless of popover width.
        const applyFillWidth = (): void => {
            const w = barBg.get_width();
            if (w > 0) fill.set_width(Math.round(clamped * w));
        };
        barBg.connect('notify::width', applyFillWidth);
        applyFillWidth();

        // Pace marker for dateCountdown tracks with children — shows where
        // the user "should" be (time elapsed) vs where they actually are
        // (avg child progress). Drawn as a small vertical tick on the bar.
        const children = cb.children ?? [];
        if (track.mode === 'dateCountdown' && children.length > 0) {
            const expected = clamped; // dateCountdown.calcProgress already = elapsed/total
            const actual = children.reduce((s, c) => s + Math.max(0, Math.min(1, calcProgress(c))), 0)
                / children.length;
            const behind = actual + 0.05 < expected;
            const marker = new St.Widget({
                style_class: behind ? 'pb-pace-marker pb-pace-marker-behind' : 'pb-pace-marker',
            });
            const applyMarker = (): void => {
                const w = barBg.get_width();
                if (w > 0) marker.set_style(`margin-left: ${Math.max(0, Math.round(expected * w) - 1)}px;`);
            };
            barBg.connect('notify::width', applyMarker);
            applyMarker();
            barBg.add_child(marker);
        }

        // ── Completion dots row (right-aligned, capped) ──
        if (children.length > 0) {
            const dotsRow = new St.BoxLayout({
                style_class: 'pb-bar-dots',
                x_expand: true,
            });
            // Spacer pushes dots to the right edge.
            dotsRow.add_child(new St.Widget({ x_expand: true }));

            const visible = children.slice(0, MAX_DOTS);
            for (const child of visible) {
                const done = calcProgress(child) >= 1;
                dotsRow.add_child(new St.Widget({
                    style_class: done ? 'pb-bar-dot pb-bar-dot-done' : 'pb-bar-dot',
                }));
            }
            const overflow = children.length - visible.length;
            if (overflow > 0) {
                dotsRow.add_child(new St.Label({
                    style_class: 'pb-bar-dot-more',
                    text: `+${overflow}`,
                    y_align: Clutter.ActorAlign.CENTER,
                }));
            }
            col.add_child(dotsRow);
        }

        const pctText = raw > 1
            ? `${Math.round(raw * 100)}% ⚠`
            : `${Math.round(raw * 100)}%`;
        col.add_child(new St.Label({
            style_class: 'pb-bar-pct',
            text: pctText,
        }));

        // ── Action row ──
        const actions = new St.BoxLayout({
            style_class: 'pb-track-actions',
            x_expand: true,
        });
        col.add_child(actions);

        if (decrement(track) !== null) {
            actions.add_child(makeActionButton('−', () => {
                const next = decrement(track);
                if (next !== null) cb.onChange(next);
            }));
        }

        if (increment(track) !== null) {
            const label = track.mode === 'recurring' ? '✓' : '+';
            actions.add_child(makeActionButton(label, () => {
                const next = increment(track);
                if (next !== null) cb.onChange(next);
            }));
        }

        // Spacer
        actions.add_child(new St.Widget({ x_expand: true }));

        // Hide toggle (eye) — bundled SVG instead of an emoji. Use the dark
        // variant (white fill) so it reads on the dark popover background.
        actions.add_child(makeIconButton(
            cb.extPath + '/icons/eye_off_dark.svg',
            () => cb.onToggleHidden(track.id),
            'pb-btn-hide',
        ));

        // Drill-in chevron — kept as a glyph, no asset for it.
        actions.add_child(makeActionButton('›', () => {
            cb.onFocus(track.id);
        }, 'pb-btn-focus'));

        actions.add_child(makeActionButton('↺', () => {
            cb.onChange(reset(track));
        }, 'pb-btn-reset'));

        // Delete — opens a confirm dialog with cascade option (handled in Indicator).
        actions.add_child(makeIconButton(
            cb.extPath + '/icons/cross_dark.svg',
            () => cb.onDelete(track.id),
            'pb-btn-delete',
        ));

        // ── Completion badge — shown beneath the action row when the
        // track has reached 100%. Matches the gold border applied above.
        if (isComplete) {
            const doneRow = new St.BoxLayout({
                style_class: 'pb-completed-row',
                x_expand: true,
            });
            doneRow.add_child(new St.Label({
                style_class: 'pb-completed-label',
                text: 'Completed',
                y_align: Clutter.ActorAlign.CENTER,
            }));
            doneRow.add_child(new St.Icon({
                gicon: Gio.FileIcon.new(Gio.File.new_for_path(cb.extPath + '/icons/check_gold.svg')),
                icon_size: 14,
                style_class: 'pb-completed-icon',
                y_align: Clutter.ActorAlign.CENTER,
            }));
            col.add_child(doneRow);
        }

        // ── Step-size row — sits beneath the +/− buttons so it's clearly
        // associated with them rather than the right-side action cluster.
        if (track.mode === 'linear' || track.mode === 'consumption') {
            const stepRow = new St.BoxLayout({
                style_class: 'pb-step-row',
                x_expand: true,
            });
            stepRow.add_child(this._makeStepEntry(track, cb));
            // Push everything else after the entry — entry stays left-
            // aligned, directly under the stepper buttons.
            stepRow.add_child(new St.Widget({ x_expand: true }));
            col.add_child(stepRow);
        }

        return this;
    }

    private _makeStepEntry(track: Track, cb: TrackItemCallbacks): St.BoxLayout {
        const wrap = new St.BoxLayout({ style_class: 'pb-step-wrap' });
        const currentStep = (track as { step?: number }).step ?? 1;

        const entry = new St.Entry({
            style_class: 'pb-step-entry',
            text: String(currentStep),
            can_focus: true,
        });
        entry.set_hint_text('step');
        wrap.add_child(entry);

        const flashError = (): void => {
            entry.add_style_class_name('pb-entry-error');
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 600, () => {
                entry.remove_style_class_name('pb-entry-error');
                return GLib.SOURCE_REMOVE;
            });
        };

        const commit = (): void => {
            const text = entry.get_text().trim();
            const n = Number(text);
            if (!Number.isFinite(n) || n <= 0 || n > 1e9) {
                flashError();
                entry.set_text(String(currentStep));
                return;
            }
            // For linear, refuse a step that exceeds max — meaningless.
            if (track.mode === 'linear' && n > track.max) {
                flashError();
                entry.set_text(String(currentStep));
                return;
            }
            // Round to integer for both modes (their values are integers).
            const stepN = Math.round(n);
            cb.onChange({ ...(track as Track & { step: number }), step: stepN } as Track);
        };

        entry.clutter_text.connect('activate', () => commit());

        const apply = makeActionButton('✓', () => commit(), 'pb-step-apply');
        wrap.add_child(apply);
        return wrap;
    }
});

export type TrackItem = InstanceType<typeof TrackItem>;

// ── helpers ──────────────────────────────────────────────────────────────

function makeActionButton(label: string, onClick: () => void, extraClass?: string): St.Button {
    const btn = new St.Button({
        style_class: extraClass !== undefined ? `pb-btn ${extraClass}` : 'pb-btn',
        label,
        can_focus: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    btn.connect('clicked', () => onClick());
    return btn;
}

function makeIconButton(iconPath: string, onClick: () => void, extraClass: string): St.Button {
    const btn = new St.Button({
        style_class: `pb-btn pb-btn-icon ${extraClass}`,
        can_focus: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    btn.set_child(new St.Icon({
        gicon: Gio.FileIcon.new(Gio.File.new_for_path(iconPath)),
        icon_size: 14,
    }));
    btn.connect('clicked', () => onClick());
    return btn;
}
