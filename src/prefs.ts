import type Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { PreferencesController } from './prefs/ui/PreferencesPage.js';

export default class ProgressBarsPreferences extends ExtensionPreferences {
    override async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const controller = new PreferencesController(this.getSettings(), window, this.path);
        controller.build();
    }
}
