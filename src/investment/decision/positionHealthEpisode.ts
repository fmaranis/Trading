const STORAGE_KEY = 'custodia_position_health_episode_v1';

interface PositionHealthEpisodeRecord {
  startDate: string;
}

type PositionHealthEpisodeMap = Record<string, PositionHealthEpisodeRecord>;

function normalizeKey(value: string | null | undefined): string | null {
  const key = String(value ?? '').trim().toUpperCase();
  return key || null;
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function load(): PositionHealthEpisodeMap {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: PositionHealthEpisodeMap = {};
    for (const [rawKey, rawValue] of Object.entries(parsed as Record<string, any>)) {
      const key = normalizeKey(rawKey);
      if (!key || !validDate(rawValue?.startDate)) continue;
      out[key] = { startDate: rawValue.startDate };
    }
    return out;
  } catch {
    return {};
  }
}

function save(records: PositionHealthEpisodeMap): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * Persistent boundary for the current position-health episode.
 *
 * The historical replay resets MFE after an executed ADD or REDUCE so a prior
 * maximum cannot trigger another sale in the new exposure. Live portfolio
 * monitoring uses the same semantic boundary through this service and rebuilds
 * MFE causally from REAL bars from this date onward.
 */
export class PositionHealthEpisodeService {
  static startDate(keys: Array<string | null | undefined>, fallback: string | null = null): string | null {
    const records = load();
    const dates = keys
      .map(normalizeKey)
      .filter((key): key is string => Boolean(key))
      .map(key => records[key]?.startDate)
      .filter(validDate)
      .sort();
    return dates.at(-1) ?? fallback;
  }

  static reset(keys: Array<string | null | undefined>, date: string): void {
    if (!validDate(date)) return;
    const records = load();
    let changed = false;
    for (const rawKey of keys) {
      const key = normalizeKey(rawKey);
      if (!key) continue;
      records[key] = { startDate: date };
      changed = true;
    }
    if (changed) save(records);
  }

  static clear(keys: Array<string | null | undefined>): void {
    const records = load();
    let changed = false;
    for (const rawKey of keys) {
      const key = normalizeKey(rawKey);
      if (!key || !records[key]) continue;
      delete records[key];
      changed = true;
    }
    if (changed) save(records);
  }

  static clearAll(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  }
}
