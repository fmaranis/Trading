export const FORWARD_RISK_OPTIONS_DATA_V7 = 'FORWARD_RISK_OPTIONS_DATA_V7' as const;

export type ForwardRiskOptionsSeriesIdV7 = 'VIX' | 'VIX9D' | 'VVIX';

export interface ForwardRiskOptionsPointV7 {
  date: string;
  value: number;
}

export interface ForwardRiskOptionsSeriesV7 {
  id: ForwardRiskOptionsSeriesIdV7;
  source: 'CBOE_PUBLIC_HISTORICAL_CSV';
  url: string;
  points: ForwardRiskOptionsPointV7[];
  firstDate: string | null;
  lastDate: string | null;
  fetchedAt: string;
}

export interface ForwardRiskOptionsDataV7 {
  version: typeof FORWARD_RISK_OPTIONS_DATA_V7;
  source: 'CBOE_PUBLIC_HISTORICAL_CSV';
  series: Record<ForwardRiskOptionsSeriesIdV7, ForwardRiskOptionsSeriesV7>;
  failures: Array<{ id: ForwardRiskOptionsSeriesIdV7; error: string }>;
  notes: string[];
}

const SERIES_URLS: Record<ForwardRiskOptionsSeriesIdV7, string> = {
  VIX: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv',
  VIX9D: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX9D_History.csv',
  VVIX: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VVIX_History.csv'
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(current.trim());
      current = '';
    } else current += ch;
  }
  out.push(current.trim());
  return out;
}

function normalizeDate(value: string): string | null {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const mdy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function parseSeriesCsv(id: ForwardRiskOptionsSeriesIdV7, csv: string): ForwardRiskOptionsPointV7[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error(`${id}_CSV_EMPTY`);
  const headers = parseCsvLine(lines[0]).map(value => value.trim().toUpperCase());
  const dateIndex = headers.findIndex(header => header === 'DATE' || header.endsWith(' DATE'));
  if (dateIndex < 0) throw new Error(`${id}_DATE_COLUMN_MISSING`);

  let valueIndex = headers.findIndex(header => header === 'CLOSE' || header.endsWith(' CLOSE'));
  if (valueIndex < 0) valueIndex = headers.findIndex(header => header === id || header.includes(`${id} CLOSE`));

  const points: ForwardRiskOptionsPointV7[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const date = normalizeDate(cells[dateIndex] ?? '');
    if (!date) continue;

    let value = valueIndex >= 0 ? Number(String(cells[valueIndex] ?? '').replace(/,/g, '')) : Number.NaN;
    if (!Number.isFinite(value) || value <= 0) {
      const numeric = cells
        .map((cell, index) => index === dateIndex ? Number.NaN : Number(String(cell).replace(/,/g, '')))
        .filter(candidate => Number.isFinite(candidate) && candidate > 0);
      value = numeric.at(-1) ?? Number.NaN;
    }
    if (Number.isFinite(value) && value > 0) points.push({ date, value });
  }

  const deduped = new Map(points.map(point => [point.date, point]));
  const sorted = [...deduped.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 200) throw new Error(`${id}_INSUFFICIENT_HISTORY:${sorted.length}`);
  return sorted;
}

async function loadSeries(id: ForwardRiskOptionsSeriesIdV7, timeoutMs: number): Promise<ForwardRiskOptionsSeriesV7> {
  const url = SERIES_URLS[id];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/csv,*/*', 'User-Agent': 'Custodia-ForwardRisk-V7/1.0' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${id}_HTTP_${response.status}`);
    const points = parseSeriesCsv(id, await response.text());
    return {
      id,
      source: 'CBOE_PUBLIC_HISTORICAL_CSV',
      url,
      points,
      firstDate: points[0]?.date ?? null,
      lastDate: points.at(-1)?.date ?? null,
      fetchedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadForwardRiskOptionsDataV7(options: { timeoutMs?: number } = {}): Promise<ForwardRiskOptionsDataV7> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const ids: ForwardRiskOptionsSeriesIdV7[] = ['VIX', 'VIX9D', 'VVIX'];
  const loaded = await Promise.all(ids.map(async id => {
    try { return { id, series: await loadSeries(id, timeoutMs), error: null as string | null }; }
    catch (error: any) { return { id, series: null, error: error?.message || String(error) }; }
  }));

  const failures = loaded.filter(row => !row.series).map(row => ({ id: row.id, error: row.error ?? 'UNKNOWN_ERROR' }));
  if (failures.length) throw new Error(`V7_CBOE_DATA_REQUIRED:${failures.map(row => `${row.id}:${row.error}`).join('|')}`);

  const series = Object.fromEntries(loaded.map(row => [row.id, row.series])) as Record<ForwardRiskOptionsSeriesIdV7, ForwardRiskOptionsSeriesV7>;
  return {
    version: FORWARD_RISK_OPTIONS_DATA_V7,
    source: 'CBOE_PUBLIC_HISTORICAL_CSV',
    series,
    failures: [],
    notes: [
      'V7 uses only observed historical Cboe volatility-index levels; there is no synthetic fallback.',
      'VIX, VIX9D and VVIX are fetched directly from Cboe public historical CSV endpoints.',
      'The loader does not interpolate future observations; downstream alignment may only carry the latest already-observed value forward within a short staleness limit.'
    ]
  };
}
