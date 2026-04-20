import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {
    ICON_DIR_REL,
    iconDir,
    resolveIconPath,
} from '../../extension/lib/iconPaths.js';

export { ICON_DIR_REL, iconDir, resolveIconPath };

export function ensureIconDir(): string {
    const dir = iconDir();
    GLib.mkdir_with_parents(dir, 0o755);
    return dir;
}

/**
 * Copies a user-picked file into the extension icon dir and returns the
 * stored relative path (suitable for `track.iconPath`).
 */
export function importIcon(sourcePath: string): string {
    const dir = ensureIconDir();

    const basename = GLib.path_get_basename(sourcePath);
    const stamp = GLib.DateTime.new_now_local().format('%Y%m%d%H%M%S') ?? String(Date.now());
    const target = `${stamp}-${basename}`;
    const targetAbs = GLib.build_filenamev([dir, target]);

    const src = Gio.File.new_for_path(sourcePath);
    const dst = Gio.File.new_for_path(targetAbs);
    src.copy(dst, Gio.FileCopyFlags.OVERWRITE, null, null);

    return GLib.build_filenamev([ICON_DIR_REL, target]);
}

/**
 * Imports a bundled library SVG into the user data dir, optionally
 * recoloring monochrome ones with the given hex color. Recoloring is a
 * substring replace on the most common fill expressions — sufficient for
 * the line-icon sets bundled with the extension. Returns the relative
 * path suitable for `track.iconPath`.
 */
export function importLibraryIcon(
    sourceAbs: string,
    opts: { tint?: string } = {},
): string {
    const dir = ensureIconDir();

    const basename = GLib.path_get_basename(sourceAbs);
    const stamp = GLib.DateTime.new_now_local().format('%Y%m%d%H%M%S') ?? String(Date.now());
    const tag = opts.tint !== undefined && opts.tint.length > 0
        ? `-${opts.tint.replace('#', '')}`
        : '';
    const target = `lib-${stamp}${tag}-${basename}`;
    const targetAbs = GLib.build_filenamev([dir, target]);

    if (opts.tint !== undefined && opts.tint.length > 0 && basename.toLowerCase().endsWith('.svg')) {
        const [ok, bytes] = GLib.file_get_contents(sourceAbs);
        if (ok) {
            const decoder = new TextDecoder('utf-8');
            let svg = decoder.decode(bytes);
            const tint = opts.tint;
            // Targets covering the bundled monochrome icon sets:
            //   currentColor, fill="#000", fill="#000000", fill="black",
            //   stroke="#000", stroke="#000000", stroke="black".
            svg = svg.replace(/currentColor/g, tint);
            svg = svg.replace(/fill="#000000"/gi, `fill="${tint}"`);
            svg = svg.replace(/fill="#000"/gi, `fill="${tint}"`);
            svg = svg.replace(/fill="black"/gi, `fill="${tint}"`);
            svg = svg.replace(/stroke="#000000"/gi, `stroke="${tint}"`);
            svg = svg.replace(/stroke="#000"/gi, `stroke="${tint}"`);
            svg = svg.replace(/stroke="black"/gi, `stroke="${tint}"`);
            const encoder = new TextEncoder();
            GLib.file_set_contents(targetAbs, encoder.encode(svg));
            return GLib.build_filenamev([ICON_DIR_REL, target]);
        }
    }

    // Plain copy (colored library icons, or recolor read failed).
    const src = Gio.File.new_for_path(sourceAbs);
    const dst = Gio.File.new_for_path(targetAbs);
    src.copy(dst, Gio.FileCopyFlags.OVERWRITE, null, null);
    return GLib.build_filenamev([ICON_DIR_REL, target]);
}

export function removeIcon(iconPath: string): void {
    const abs = resolveIconPath(iconPath);
    if (abs === null) return;
    try {
        Gio.File.new_for_path(abs).delete(null);
    } catch (_) {
        // harmless
    }
}
