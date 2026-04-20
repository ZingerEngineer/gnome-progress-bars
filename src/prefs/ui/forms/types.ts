import type Adw from 'gi://Adw';

import type { BaseTrack, Track } from '../../../extension/lib/modes/types.js';

/**
 * One form per progress mode. The editor swaps the `.group` widget in/out
 * when the user changes the mode dropdown, then calls `read(base)` on save
 * to produce a complete Track of the correct variant.
 */
export interface ModeForm {
    readonly group: Adw.PreferencesGroup;
    read(base: BaseTrack): Track;
}
