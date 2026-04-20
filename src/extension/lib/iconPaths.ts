import GLib from 'gi://GLib';

/** Where imported icons live, relative to `GLib.get_user_data_dir()`. */
export const ICON_DIR_REL = 'progress-reminder-icons';

export function iconDir(): string {
    return GLib.build_filenamev([GLib.get_user_data_dir(), ICON_DIR_REL]);
}

/** Resolves a stored relative iconPath to an absolute path, or null if empty. */
export function resolveIconPath(iconPath: string): string | null {
    if (iconPath.length === 0) return null;
    return GLib.build_filenamev([GLib.get_user_data_dir(), iconPath]);
}
