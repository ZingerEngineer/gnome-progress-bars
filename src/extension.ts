import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { ProgressBarsIndicator } from './extension/ui/Indicator.js';
import { Ticker } from './extension/lib/ticker.js';
import { disposeNotifications } from './extension/lib/notifications.js';

export default class ProgressBarsExtension extends Extension {
    private _indicator: ProgressBarsIndicator | null = null;
    private _ticker: Ticker | null = null;

    override enable(): void {
        this._indicator = new ProgressBarsIndicator(0.0, 'Progress Bars').setup(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._ticker = new Ticker({
            settings: this.getSettings(),
            onTick: () => this._indicator?.refresh(),
        });
        this._ticker.start();
        // Run once immediately to catch "already-crossed" thresholds on
        // start-up (e.g. a user added a track whose state is past a
        // threshold the previous session didn't see).
        this._ticker.tickNow();
    }

    override disable(): void {
        this._ticker?.stop();
        this._ticker = null;

        this._indicator?.destroy();
        this._indicator = null;

        disposeNotifications();
    }
}
