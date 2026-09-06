import {
  FORWARD_RISK_MACRO_DATA_V5,
  type ForwardRiskMacroDataV5,
  type ForwardRiskMacroObservation,
  type ForwardRiskMacroSeriesId
} from './forwardRiskMacroDataV5';

interface FredRealtimeObservation {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string;
}

const SERIES: Array<{ id: ForwardRiskMacroSeriesId; frequency: 'DAILY' | 'WEEKLY' }> = [
  { id: 'T10Y2Y', frequency: 'DAILY' },
  { id: 'T10Y3M', frequency: 'DAILY' },
  { id: 'BAA10Y', frequency: 'DAILY' },
  { id: 'WALCL', frequency: 'WEEKLY' }
];

function requiredApiKey(): string {
  const key = process.env.FRED_API_KEY?.trim();
  if (!key) throw new Error('FRED_API_KEY_REQUIRED');
  return key;
}

async function fetchRealtimePeriods(
  id: ForwardRiskMacroSeriesId,
  startDate: string,
  endDate: string,
  apiKey: string
): Promise<FredRealtimeObservation[]> {
  const rows: FredRealtimeObservation[] = [];
  const limit = 100000;
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      series_id: id,
      api_key: apiKey,
      file_type: 'json',
      output_type: '1',
      realtime_start: startDate,
      realtime_end: endDate,
      observation_start: startDate,
      observation_end: endDate,
      limit: String(limit),
      offset: String(offset),
      sort_order: 'asc'
    });
    const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?${params.toString()}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`${id}_ALFRED_HTTP_${response.status}:${(await response.text()).slice(0, 300)}`);
    const payload: any = await response.json();
    const page = Array.isArray(payload?.observations) ? payload.observations as FredRealtimeObservation[] : [];
    rows.push(...page);
    const count = Number(payload?.count ?? page.length);
    offset += page.length;
    if (!page.length || offset >= count) break;
  }
  return rows;
}

/**
 * Convert ALFRED real-time-period records to the latest macro value that was
 * actually knowable on each release/revision date. Downstream V5 alignment may
 * then carry that value forward, but can never see a revision before its
 * realtime_start date.
 */
function materializePointInTime(rows: FredRealtimeObservation[], startDate: string, endDate: string): ForwardRiskMacroObservation[] {
  const finite = rows.flatMap(row => {
    const observationDate = row.date?.slice(0, 10);
    const availableFrom = row.realtime_start?.slice(0, 10);
    const availableUntil = row.realtime_end?.slice(0, 10);
    const value = Number(row.value);
    if (!observationDate || !availableFrom || !availableUntil || !Number.isFinite(value)) return [];
    return [{ observationDate, availableFrom, availableUntil, value }];
  });

  const releaseDates = [...new Set(finite.map(row => row.availableFrom).filter(date => date >= startDate && date <= endDate))].sort();
  const out: ForwardRiskMacroObservation[] = [];
  for (const asOf of releaseDates) {
    const available = finite
      .filter(row => row.observationDate <= asOf && row.availableFrom <= asOf && asOf <= row.availableUntil)
      .sort((a, b) => b.observationDate.localeCompare(a.observationDate));
    const latest = available[0];
    if (latest) out.push({ date: asOf, value: latest.value });
  }

  const deduped = new Map(out.map(row => [row.date, row]));
  return [...deduped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadForwardRiskMacroDataV5VintageSafe(startDate: string, endDate: string): Promise<ForwardRiskMacroDataV5> {
  const apiKey = requiredApiKey();
  const series: ForwardRiskMacroDataV5['series'] = [];
  const loaded: ForwardRiskMacroSeriesId[] = [];
  const failures: string[] = [];

  for (const definition of SERIES) {
    try {
      const realtimeRows = await fetchRealtimePeriods(definition.id, startDate, endDate, apiKey);
      const observations = materializePointInTime(realtimeRows, startDate, endDate);
      if (!observations.length) throw new Error('NO_POINT_IN_TIME_OBSERVATIONS');
      series.push({ id: definition.id, frequency: definition.frequency, observations, source: 'FRED' });
      loaded.push(definition.id);
    } catch (error: any) {
      failures.push(`${definition.id}:${error?.message || String(error)}`);
    }
  }

  if (loaded.length < 3) throw new Error(`V8_VINTAGE_SAFE_MACRO_INSUFFICIENT:${failures.join('|')}`);

  return {
    version: FORWARD_RISK_MACRO_DATA_V5,
    source: 'FRED_API_ALFRED_REALTIME_PERIODS',
    pointInTimeVintageSafe: true,
    startDate,
    endDate,
    series,
    loaded,
    failures,
    notes: [
      'FRED/ALFRED realtime_start and realtime_end are used to reconstruct only information available as of each historical release/revision date.',
      'No current-vintage graph CSV and no synthetic fallback is permitted in this loader.',
      'The downstream V5 formula and frozen thresholds are unchanged; only macro data provenance is made point-in-time safe.'
    ]
  };
}
