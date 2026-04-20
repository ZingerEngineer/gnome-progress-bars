import type Gio from 'gi://Gio';

import {
    CURRENT_SCHEMA_VERSION,
    DEFAULT_RIBBON,
    makeBase,
    type RecurringTrack,
    type Track,
    type TrackLink,
} from './modes/types.js';

// ── Raw shape of the legacy "v1" track format (emoji + streak only). ─────

interface LegacyTrack {
    id?: string;
    name?: string;
    emoji?: string;
    streak?: number;
    lastCheckin?: string;
    history?: string[];
}

function isLegacy(obj: unknown): obj is LegacyTrack {
    return typeof obj === 'object' && obj !== null && !('mode' in obj);
}

function migrateLegacy(l: LegacyTrack): RecurringTrack {
    const base = makeBase(l.id ?? String(Date.now() + Math.random()), l.name ?? 'Untitled');
    return {
        ...base,
        mode: 'recurring',
        frequency: 'daily',
        target: 1,
        history: Array.isArray(l.history) ? l.history : [],
        streak: typeof l.streak === 'number' ? l.streak : 0,
        lastCheckin: typeof l.lastCheckin === 'string' ? l.lastCheckin : '',
    };
}

// ── Tracks ───────────────────────────────────────────────────────────────

export function loadTracks(settings: Gio.Settings): Track[] {
    let raw: unknown;
    try {
        raw = JSON.parse(settings.get_string('tracks') ?? '[]');
    } catch (_) {
        return [];
    }
    if (!Array.isArray(raw)) return [];

    const storedVersion = settings.get_int('schema-version');
    const needsMigrate = storedVersion < CURRENT_SCHEMA_VERSION;

    const tracks: Track[] = [];
    for (const entry of raw) {
        if (isLegacy(entry)) {
            tracks.push(migrateLegacy(entry));
        } else {
            // Back-fill fields that may have been added since this track was saved.
            const t = entry as Track & { subTasks?: unknown };
            if (typeof (t as Partial<Track>).overdueNotifiedDaysLate !== 'number') {
                (t as Track).overdueNotifiedDaysLate = 0;
            }
            if (!Array.isArray((t as Partial<Track>).firedThresholds)) {
                (t as Track).firedThresholds = [];
            }
            if (typeof (t as Partial<Track>).hidden !== 'boolean') {
                (t as Track).hidden = false;
            }
            // v4: ribbon + iconTint backfill.
            const withRibbon = t as Track & { ribbon?: unknown; iconTint?: unknown };
            if (typeof withRibbon.ribbon !== 'object' || withRibbon.ribbon === null) {
                withRibbon.ribbon = { ...DEFAULT_RIBBON };
            } else {
                // Backfill inheritFromParents for tracks saved before that
                // field existed.
                const r = withRibbon.ribbon as { inheritFromParents?: unknown };
                if (typeof r.inheritFromParents !== 'boolean') {
                    r.inheritFromParents = false;
                }
            }
            if (typeof withRibbon.iconTint !== 'string') {
                withRibbon.iconTint = '';
            }
            // Consumption gained a per-track step field in v4.
            if (t.mode === 'consumption' && typeof (t as { step?: unknown }).step !== 'number') {
                (t as { step: number }).step = 1;
            }
            // v3: subTasks replaced by graph links — strip any leftover field.
            if ('subTasks' in t) {
                delete (t as { subTasks?: unknown }).subTasks;
            }
            tracks.push(t);
        }
    }

    if (needsMigrate) {
        saveTracks(settings, tracks);
        settings.set_int('schema-version', CURRENT_SCHEMA_VERSION);
    }

    return tracks;
}

export function saveTracks(settings: Gio.Settings, tracks: Track[]): void {
    settings.set_string('tracks', JSON.stringify(tracks));
}

export function updateTrack(
    settings: Gio.Settings,
    id: string,
    fn: (t: Track) => Track,
): void {
    const tracks = loadTracks(settings).map(t => (t.id === id ? fn(t) : t));
    saveTracks(settings, tracks);
}

export function deleteTrack(
    settings: Gio.Settings,
    id: string,
    opts: { cascade?: boolean } = {},
): void {
    const tracks = loadTracks(settings);
    const links = loadLinks(settings);

    // Collect the set of ids to remove. In cascade mode we walk the child
    // graph from `id` downward, with a visited-set so the defensive cycle
    // guard can't loop forever even if bad data snuck in.
    const toRemove = new Set<string>([id]);
    if (opts.cascade === true) {
        const queue: string[] = [id];
        while (queue.length > 0) {
            const cur = queue.shift();
            if (cur === undefined) break;
            for (const l of links) {
                if (l.parentId === cur && !toRemove.has(l.childId)) {
                    toRemove.add(l.childId);
                    queue.push(l.childId);
                }
            }
        }
    }

    saveTracks(settings, tracks.filter(t => !toRemove.has(t.id)));
    saveLinks(
        settings,
        links.filter(l => !toRemove.has(l.parentId) && !toRemove.has(l.childId)),
    );
}

export function addTrack(settings: Gio.Settings, track: Track): void {
    const tracks = loadTracks(settings);
    tracks.push(track);
    saveTracks(settings, tracks);
}

// ── Parent/child graph ───────────────────────────────────────────────────

export function loadLinks(settings: Gio.Settings): TrackLink[] {
    let raw: unknown;
    try {
        raw = JSON.parse(settings.get_string('links') ?? '[]');
    } catch (_) {
        return [];
    }
    if (!Array.isArray(raw)) return [];
    return raw.filter(
        (x): x is TrackLink =>
            typeof x === 'object' && x !== null
            && typeof (x as TrackLink).parentId === 'string'
            && typeof (x as TrackLink).childId === 'string'
            && typeof (x as TrackLink).order === 'number',
    );
}

export function saveLinks(settings: Gio.Settings, links: TrackLink[]): void {
    settings.set_string('links', JSON.stringify(links));
}

/**
 * Returns true if making `childId` a descendant of `parentId` would close
 * a cycle in the graph (i.e. `parentId` is already reachable from `childId`).
 */
export function wouldCreateCycle(
    links: TrackLink[],
    parentId: string,
    childId: string,
): boolean {
    if (parentId === childId) return true;
    // BFS from childId — if we can reach parentId, linking would cycle.
    const queue: string[] = [childId];
    const seen = new Set<string>([childId]);
    while (queue.length > 0) {
        const node = queue.shift();
        if (node === undefined) break;
        for (const l of links) {
            if (l.parentId !== node) continue;
            if (l.childId === parentId) return true;
            if (!seen.has(l.childId)) {
                seen.add(l.childId);
                queue.push(l.childId);
            }
        }
    }
    return false;
}

/** Adds a link. Returns false if it would cycle or already exists. */
export function addLink(
    settings: Gio.Settings,
    parentId: string,
    childId: string,
): boolean {
    const links = loadLinks(settings);
    if (links.some(l => l.parentId === parentId && l.childId === childId)) {
        return false;
    }
    if (wouldCreateCycle(links, parentId, childId)) return false;

    const siblings = links.filter(l => l.parentId === parentId);
    const nextOrder = siblings.reduce((m, l) => Math.max(m, l.order), -1) + 1;

    links.push({ parentId, childId, order: nextOrder });
    saveLinks(settings, links);
    return true;
}

export function removeLink(
    settings: Gio.Settings,
    parentId: string,
    childId: string,
): void {
    const links = loadLinks(settings).filter(
        l => !(l.parentId === parentId && l.childId === childId),
    );
    saveLinks(settings, links);
}

/** Reassigns `order` on every direct child of `parentId` from the given sequence. */
export function reorderChildren(
    settings: Gio.Settings,
    parentId: string,
    childIds: string[],
): void {
    const links = loadLinks(settings);
    const idx = new Map(childIds.map((id, i) => [id, i]));
    for (const l of links) {
        if (l.parentId === parentId) {
            const p = idx.get(l.childId);
            if (p !== undefined) l.order = p;
        }
    }
    saveLinks(settings, links);
}

/** Direct children of `parentId`, sorted by `order`. */
export function getChildren(
    tracks: Track[],
    links: TrackLink[],
    parentId: string,
): Track[] {
    const childLinks = links
        .filter(l => l.parentId === parentId)
        .sort((a, b) => a.order - b.order);
    const byId = new Map(tracks.map(t => [t.id, t]));
    const out: Track[] = [];
    for (const l of childLinks) {
        const t = byId.get(l.childId);
        if (t !== undefined) out.push(t);
    }
    return out;
}

/** Direct parents of `childId` (unordered). */
export function getParents(
    tracks: Track[],
    links: TrackLink[],
    childId: string,
): Track[] {
    const parentIds = new Set(
        links.filter(l => l.childId === childId).map(l => l.parentId),
    );
    return tracks.filter(t => parentIds.has(t.id));
}
