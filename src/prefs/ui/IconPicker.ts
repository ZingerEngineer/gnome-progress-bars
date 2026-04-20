import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {
    importIcon,
    importLibraryIcon,
    removeIcon,
    resolveIconPath,
} from '../lib/icons.js';

interface LibraryIcon {
    /** Absolute filesystem path to the bundled svg. */
    path: string;
    /** Display name (file basename without extension). */
    name: string;
    /** Top-level category — "monochrome" or "colored". */
    kind: 'monochrome' | 'colored';
    /** Subdirectory inside that kind, e.g. "dazzle-line-icons". */
    pack: string;
}

function rgbaToHex(rgba: Gdk.RGBA): string {
    const to2 = (n: number): string => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${to2(rgba.red)}${to2(rgba.green)}${to2(rgba.blue)}`;
}

function hexToRgba(hex: string): Gdk.RGBA {
    const rgba = new Gdk.RGBA();
    if (!rgba.parse(hex)) rgba.parse('#ffffff');
    return rgba;
}

/**
 * Lets the user pick an icon either from the bundled SVG library
 * (`<extPath>/icon-library/{monochrome,colored}/<pack>/*.svg`) — with
 * optional recoloring for monochrome icons — or from any local file
 * (svg/png/jpg) on disk.
 */
export class IconPicker {
    readonly row: Adw.ActionRow;
    private _iconPath: string;
    private _iconTint: string;
    private readonly _extPath: string;
    private readonly _preview: Gtk.Image;

    constructor(extPath: string, initial: string, initialTint: string) {
        this._extPath = extPath;
        this._iconPath = initial;
        this._iconTint = initialTint;

        this.row = new Adw.ActionRow({
            title: 'Icon',
            subtitle: 'Pick from the library or load a custom file',
        });

        this._preview = new Gtk.Image({
            pixel_size: 32,
            icon_name: 'image-x-generic-symbolic',
            valign: Gtk.Align.CENTER,
        });
        this.row.add_prefix(this._preview);

        const libBtn = new Gtk.Button({
            label: 'Library…',
            valign: Gtk.Align.CENTER,
        });
        libBtn.connect('clicked', () => this._openLibrary());
        this.row.add_suffix(libBtn);

        const fileBtn = new Gtk.Button({
            label: 'File…',
            valign: Gtk.Align.CENTER,
        });
        fileBtn.connect('clicked', () => this._openFileDialog());
        this.row.add_suffix(fileBtn);

        const clearBtn = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Clear icon',
            css_classes: ['flat'],
        });
        clearBtn.connect('clicked', () => this._clear());
        this.row.add_suffix(clearBtn);

        this._refreshPreview();
    }

    /** Stored relative path. */
    read(): string {
        return this._iconPath;
    }

    /** Stored tint hex (empty for custom files / colored library icons). */
    readTint(): string {
        return this._iconTint;
    }

    private _refreshPreview(): void {
        const abs = resolveIconPath(this._iconPath);
        if (abs === null) {
            this._preview.set_from_icon_name('image-x-generic-symbolic');
        } else {
            this._preview.set_from_file(abs);
        }
    }

    private _clear(): void {
        if (this._iconPath.length > 0) {
            removeIcon(this._iconPath);
            this._iconPath = '';
            this._iconTint = '';
            this._refreshPreview();
        }
    }

    // ── Custom file picker (existing flow) ──────────────────────────────

    private _openFileDialog(): void {
        const filter = new Gtk.FileFilter();
        filter.set_name('Images (svg, png, jpg)');
        filter.add_mime_type('image/svg+xml');
        filter.add_mime_type('image/png');
        filter.add_mime_type('image/jpeg');

        const filters = Gio.ListStore.new(Gtk.FileFilter.$gtype);
        filters.append(filter);

        const dialog = new Gtk.FileDialog({
            title: 'Pick an icon',
            modal: true,
            filters,
            default_filter: filter,
        });

        const parent = this.row.get_root() as Gtk.Window | null;
        dialog.open(parent, null, (_src, result) => {
            try {
                const file = dialog.open_finish(result);
                const path = file?.get_path();
                if (path !== null && path !== undefined) {
                    if (this._iconPath.length > 0) removeIcon(this._iconPath);
                    this._iconPath = importIcon(path);
                    this._iconTint = '';
                    this._refreshPreview();
                }
            } catch (_) {
                // user cancelled or error; ignore.
            }
        });
    }

    // ── Library picker ──────────────────────────────────────────────────

    private _libraryRoot(): string {
        return GLib.build_filenamev([this._extPath, 'icon-library']);
    }

    private _enumerateLibrary(): LibraryIcon[] {
        const root = this._libraryRoot();
        const out: LibraryIcon[] = [];
        for (const kind of ['monochrome', 'colored'] as const) {
            const kindDir = GLib.build_filenamev([root, kind]);
            const kindFile = Gio.File.new_for_path(kindDir);
            if (!kindFile.query_exists(null)) continue;
            let packEnum: Gio.FileEnumerator;
            try {
                packEnum = kindFile.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null,
                );
            } catch (_) {
                continue;
            }
            let packInfo = packEnum.next_file(null);
            while (packInfo !== null) {
                if (packInfo.get_file_type() === Gio.FileType.DIRECTORY) {
                    const packName = packInfo.get_name();
                    const packDir = GLib.build_filenamev([kindDir, packName]);
                    try {
                        const fileEnum = Gio.File.new_for_path(packDir).enumerate_children(
                            'standard::name,standard::type',
                            Gio.FileQueryInfoFlags.NONE,
                            null,
                        );
                        let svgInfo = fileEnum.next_file(null);
                        while (svgInfo !== null) {
                            const svgName = svgInfo.get_name();
                            if (svgName.toLowerCase().endsWith('.svg')) {
                                out.push({
                                    path: GLib.build_filenamev([packDir, svgName]),
                                    name: svgName.replace(/\.svg$/i, ''),
                                    kind,
                                    pack: packName,
                                });
                            }
                            svgInfo = fileEnum.next_file(null);
                        }
                        fileEnum.close(null);
                    } catch (_) {
                        // skip unreadable pack
                    }
                }
                packInfo = packEnum.next_file(null);
            }
            packEnum.close(null);
        }
        return out;
    }

    private _openLibrary(): void {
        const parent = this.row.get_root() as Gtk.Window | null;
        const dialog = new Gtk.Window({
            title: 'Icon library',
            modal: true,
            ...(parent !== null ? { transient_for: parent } : {}),
            default_width: 640,
            default_height: 520,
        });

        const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
        root.set_margin_top(10);
        root.set_margin_bottom(10);
        root.set_margin_start(10);
        root.set_margin_end(10);
        dialog.set_child(root);

        // Top bar: kind + pack filters + tint color picker.
        const topBar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        root.append(topBar);

        // "All" lets the user search every kind; otherwise it's one of the
        // two top-level categories. Keep indexes in sync with KIND_VALUES.
        const KIND_LABELS = ['All', 'Monochrome', 'Colored'];
        const KIND_VALUES: Array<'all' | 'monochrome' | 'colored'> = ['all', 'monochrome', 'colored'];
        const kindSelector = Gtk.DropDown.new_from_strings(KIND_LABELS);
        kindSelector.set_selected(1); // Default to Monochrome — most icons.
        topBar.append(kindSelector);

        // Pack dropdown — rebuilt whenever the kind changes. Uses a Gtk
        // StringList so we can swap contents cheaply.
        const packModel = Gtk.StringList.new(['All packs']);
        const packSelector = new Gtk.DropDown({ model: packModel });
        packSelector.set_selected(0);
        topBar.append(packSelector);

        const tintLabel = new Gtk.Label({ label: 'Tint:', valign: Gtk.Align.CENTER });
        topBar.append(tintLabel);

        const tintBtn = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({ with_alpha: false }),
            rgba: hexToRgba(this._iconTint.length > 0 ? this._iconTint : '#ffffff'),
            valign: Gtk.Align.CENTER,
        });
        topBar.append(tintBtn);

        const hint = new Gtk.Label({
            label: '(only applied to monochrome icons)',
            css_classes: ['dim-label'],
            valign: Gtk.Align.CENTER,
        });
        topBar.append(hint);

        // Search row — filters by icon name within the current kind/pack.
        const search = new Gtk.SearchEntry({
            placeholder_text: 'Search icons…',
            hexpand: true,
        });
        root.append(search);

        const scroller = new Gtk.ScrolledWindow({ vexpand: true });
        root.append(scroller);

        const flow = new Gtk.FlowBox({
            valign: Gtk.Align.START,
            max_children_per_line: 8,
            selection_mode: Gtk.SelectionMode.SINGLE,
            row_spacing: 6,
            column_spacing: 6,
        });
        scroller.set_child(flow);

        const allIcons = this._enumerateLibrary();

        // Compute the set of pack names for a given kind. "all" returns
        // packs from both categories (union).
        const packsFor = (kind: 'all' | 'monochrome' | 'colored'): string[] => {
            const set = new Set<string>();
            for (const i of allIcons) {
                if (kind === 'all' || i.kind === kind) set.add(i.pack);
            }
            return Array.from(set).sort();
        };

        // Currently-selected pack name, or null when "All packs" is chosen.
        let currentPacks: string[] = [];

        // "dazzle-line-icons" / "dazzle_line_icons" → "Dazzle Line Icons".
        const prettify = (raw: string): string => raw
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(w => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
            .join(' ');

        const rebuildPackDropdown = (kind: 'all' | 'monochrome' | 'colored'): void => {
            currentPacks = packsFor(kind);
            // StringList has no "replace all" — easiest is a fresh model.
            const newModel = Gtk.StringList.new(['All packs', ...currentPacks.map(prettify)]);
            packSelector.set_model(newModel);
            packSelector.set_selected(0);
        };

        const populate = (): void => {
            // Clear existing children.
            let c = flow.get_first_child();
            while (c !== null) {
                const next = c.get_next_sibling();
                flow.remove(c);
                c = next;
            }

            const kind = KIND_VALUES[kindSelector.get_selected()] ?? 'monochrome';
            const packIdx = packSelector.get_selected();
            const pack = packIdx > 0 ? currentPacks[packIdx - 1] : undefined;
            const query = search.get_text().trim().toLowerCase();

            const filtered = allIcons.filter((i) => {
                if (kind !== 'all' && i.kind !== kind) return false;
                if (pack !== undefined && i.pack !== pack) return false;
                if (query.length > 0 && !i.name.toLowerCase().includes(query)) return false;
                return true;
            });

            // Cap to keep the GTK draw cost reasonable.
            const cap = 600;
            for (const icon of filtered.slice(0, cap)) {
                const child = new Gtk.FlowBoxChild();
                const img = new Gtk.Image({
                    pixel_size: 36,
                    tooltip_text: `${prettify(icon.kind)} / ${prettify(icon.pack)} / ${icon.name}`,
                });
                img.set_from_file(icon.path);
                child.set_child(img);
                (child as Gtk.FlowBoxChild & { _libIcon: LibraryIcon })._libIcon = icon;
                flow.append(child);
            }
        };

        rebuildPackDropdown('monochrome');
        populate();
        kindSelector.connect('notify::selected', () => {
            rebuildPackDropdown(KIND_VALUES[kindSelector.get_selected()] ?? 'monochrome');
            populate();
        });
        packSelector.connect('notify::selected', () => populate());
        search.connect('search-changed', () => populate());

        // Buttons row.
        const buttons = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.END,
        });
        root.append(buttons);

        const cancel = new Gtk.Button({ label: 'Cancel' });
        cancel.connect('clicked', () => dialog.close());
        buttons.append(cancel);

        const choose = new Gtk.Button({
            label: 'Use icon',
            css_classes: ['suggested-action'],
        });
        choose.connect('clicked', () => {
            const sel = flow.get_selected_children();
            const first = sel[0] as (Gtk.FlowBoxChild & { _libIcon?: LibraryIcon }) | undefined;
            if (first === undefined || first._libIcon === undefined) {
                dialog.close();
                return;
            }
            const picked = first._libIcon;

            // Drop the previously imported file (if any) so we don't leak.
            if (this._iconPath.length > 0) removeIcon(this._iconPath);

            if (picked.kind === 'monochrome') {
                const tint = rgbaToHex(tintBtn.get_rgba());
                this._iconPath = importLibraryIcon(picked.path, { tint });
                this._iconTint = tint;
            } else {
                this._iconPath = importLibraryIcon(picked.path);
                this._iconTint = '';
            }
            this._refreshPreview();
            dialog.close();
        });
        buttons.append(choose);

        dialog.present();
    }
}
