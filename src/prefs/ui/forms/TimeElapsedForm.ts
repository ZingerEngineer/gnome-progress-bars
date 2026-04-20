import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import type { BaseTrack, TimeElapsedTrack, Track } from '../../../extension/lib/modes/types.js';
import type { ModeForm } from './types.js';

function parseHms(text: string): number {
    const parts = text.split(':').map(p => Number.parseInt(p, 10));
    if (parts.some(n => !Number.isFinite(n))) return 0;
    const [hh = 0, mm = 0, ss = 0] = parts;
    return hh * 3600 + mm * 60 + ss;
}

function formatHms(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

export class TimeElapsedForm implements ModeForm {
    readonly group: Adw.PreferencesGroup;
    private readonly _total: Adw.EntryRow;
    private readonly _current: Adw.EntryRow;

    constructor(initial?: TimeElapsedTrack) {
        this.group = new Adw.PreferencesGroup({
            title: 'Time elapsed',
            description: 'Format: HH:MM:SS',
        });

        this._total = new Adw.EntryRow({ title: 'Total duration' });
        this._total.set_text(formatHms(initial?.totalSeconds ?? 3600));

        this._current = new Adw.EntryRow({ title: 'Current position' });
        this._current.set_text(formatHms(initial?.currentSeconds ?? 0));

        this.group.add(this._total);
        this.group.add(this._current);
    }

    read(base: BaseTrack): Track {
        const out: TimeElapsedTrack = {
            ...base,
            mode: 'timeElapsed',
            totalSeconds: parseHms(this._total.get_text()),
            currentSeconds: parseHms(this._current.get_text()),
        };
        return out;
    }
}
