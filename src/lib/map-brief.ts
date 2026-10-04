/**
 * A map's brief: what the person told us when they started it (what it's for, whether it has an end goal,
 * where they're starting from). Kept as context for later features; nothing reads it into AI calls yet.
 *
 * ponytail: stored in this browser only (localStorage, one entry per map). Teammates and other devices don't
 * see it. Move it to the projects table (SQLite, Neon auto-init, schema-postgres.sql) once a feature needs it server-side.
 */

export const MAP_PURPOSES = [
  { id: 'research', label: 'Research a topic', hint: 'Find out what is known and what the evidence says' },
  { id: 'plan', label: 'Plan a project', hint: 'Work out steps, options and decisions' },
  { id: 'learn', label: 'Learn or study', hint: 'Understand a subject and how its ideas connect' },
  { id: 'brainstorm', label: 'Brainstorm', hint: 'Get ideas down and see what comes of them' },
  { id: 'write', label: 'Write something', hint: 'An article, paper, report or talk' },
  { id: 'other', label: 'Something else', hint: '' }
] as const;

export const MAP_GOALS = [
  { id: 'defined', label: 'Yes, a clear outcome', hint: 'A decision, an answer or something to deliver' },
  { id: 'open', label: 'No, it stays open', hint: 'An ongoing space to explore and add to' },
  { id: 'unsure', label: 'Not sure yet', hint: 'Decide later' }
] as const;

export const MAP_STARTING_POINTS = [
  { id: 'scratch', label: 'From scratch', hint: 'A question or a blank page' },
  { id: 'material', label: 'With notes or sources', hint: 'Things I already have to bring in' },
  { id: 'expert', label: 'I know the area well', hint: 'I want to organise and stress-test what I know' }
] as const;

export interface MapBrief {
  purpose: (typeof MAP_PURPOSES)[number]['id'] | null;
  /** The map in the person's own words, optional. */
  summary: string;
  goal: (typeof MAP_GOALS)[number]['id'] | null;
  /** What "done" looks like, when the goal is a clear outcome. */
  goalDetail: string;
  startingPoint: (typeof MAP_STARTING_POINTS)[number]['id'] | null;
  savedAt: number;
}

const key = (mapId: string) => `synthex_map_brief_${mapId}`;

export function loadMapBrief(mapId: string): MapBrief | null {
  try {
    const raw = localStorage.getItem(key(mapId));
    return raw ? (JSON.parse(raw) as MapBrief) : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser would not store it (private mode, storage full). */
export function saveMapBrief(mapId: string, brief: MapBrief): boolean {
  try {
    localStorage.setItem(key(mapId), JSON.stringify(brief));
    return true;
  } catch {
    return false;
  }
}

export function removeMapBrief(mapId: string) {
  try { localStorage.removeItem(key(mapId)); } catch { /* nothing stored */ }
}
