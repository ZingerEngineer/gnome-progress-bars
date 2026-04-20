import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import type { Track } from './modes/types.js';

let source: MessageTray.Source | null = null;

function getSource(): MessageTray.Source {
    if (source !== null) return source;

    const s = new MessageTray.Source({
        title: 'Progress Bars',
        iconName: 'starred-symbolic',
    });
    s.connect('destroy', () => {
        if (source === s) source = null;
    });
    Main.messageTray.add(s);
    source = s;
    return s;
}

function notify(title: string, body: string): void {
    const n = new MessageTray.Notification({
        source: getSource(),
        title,
        body,
        iconName: 'starred-symbolic',
        isTransient: false,
    });
    getSource().addNotification(n);
}

/** Fire when a percent threshold (25/50/75/100) is first crossed. */
export function notifyThresholdCrossed(track: Track, threshold: number): void {
    const suffix = threshold === 100 ? ' — done!' : '';
    notify(track.name, `Reached ${threshold}%${suffix}`);
}

/** Fire once per day an overdue track remains past its deadline. */
export function notifyOverdueDay(track: Track, daysLate: number): void {
    const plural = daysLate === 1 ? 'day' : 'days';
    notify(track.name, `⚠ ${daysLate} ${plural} overdue`);
}

/** Called from Extension.disable() to release the Source. */
export function disposeNotifications(): void {
    if (source !== null) {
        source.destroy(MessageTray.NotificationDestroyedReason.SOURCE_CLOSED);
        source = null;
    }
}
