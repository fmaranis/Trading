export const FORWARD_RISK_MACRO_DATA_V5 = 'FORWARD_RISK_MACRO_DATA_V5' as const;

export type ForwardRiskMacroSeriesId = 'T10Y2Y' | 'T10Y3M' | 'BAA10Y' | 'WALCL';
export type ForwardRiskMacroDataSource = 'FRED_GRAPH_CSV_CURRENT_VINTAGE' | 'FRED_API_ALFRED_REALTIME_PERIODS';

export interface ForwardRiskMacroObservation {
  date: string;
  value: number;
}

export interface ForwardRiskMacroSeries {
  id: ForwardRiskMacroSeriesId;
  frequency: 'DAILY' | 'WEEKLY';
  observations: ForwardRiskMacroObservation[];
  source: 'FRED';
}

export interface ForwardRiskMacroDataV5 {
  version: typeof FORWARD_RISK_MACRO_DATA_V5;
  source: ForwardRiskMacroDataSource;
  pointInTimeVintageSafe: boolean;
  startDate: string;
  endDate: string;
  series: ForwardRiskMacroSeries[];
  loaded: ForwardRiskMacroSeriesId[];
  failures: string[];
  notes: string[];
}

const SERIES: Array<{ id: ForwardRiskMacroSeriesId; frequency: 'DAILY' | 'WEEKLY' }> = [
  { id: 'T10Y2Y', frequency: 'DAILY' },
  { id: 'T10Y3M', frequency: 'DAILY' },
  { id: 'BAA10Y', frequency: 'DAILY' },
  { id: 'WALCL', frequency: 'WEEKLY' }
];

function parseFredCsv(csv: string, id: ForwardRiskMacroSeriesId): ForwardRiskMacroObservation[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(value => value.trim());
  const dateIndex = header.findIndex(value => value === 'observation_date' || value === 'DATE');
  const valueIndex = header.findIndex(value => value === id);
  if (dateIndex < 0 || valueIndex < 0) throw new Error(`FRED_CSV_HEADER_MISMATCH:${id}`);
  return lines.slice(1).flatMap(line => {
    const cells = line.split(',');
    const date = cells[dateIndex]?.trim();
    const raw = cells[valueIndex]?.trim();
    const value = Number(raw);
    if (!date || !Number.isFinite(value)) return [];
    return [{ date: date.slice(0, 10), value }];
  });
}

export async function loadForwardRiskMacroDataV5(
  startDate: string,
  endDate: string
): Promise<ForwardRiskMacroDataV5> {
  const series: ForwardRiskMacroSeries[] = [];
  const loaded: ForwardRiskMacroSeriesId[] = [];
  const failures: string[] = [];

  for (const definition of SERIES) {
    try {
      const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.id}&cosd=${startDate}&coed=${endDate}`;
      const response = await fetch(url, { headers: { accept: 'text/csv' } });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const observations = parseFredCsv(await response.text(), definition.id)
        .filter(row => row.date >= startDate && row.date <= endDate);
      if (!observations.length) throw new Error('NO_OBSERVATIONS');
      series.push({ id: definition.id, frequency: definition.frequency, observations, source: 'FRED' });
      loaded.push(definition.id);
    } catch (error: any) {
      failures.push(`${definition.id}:${error?.message || String(error)}`);
    }
  }

  return {
    version: FORWARD_RISK_MACRO_DATA_V5,
    source: 'FRED_GRAPH_CSV_CURRENT_VINTAGE',
    pointInTimeVintageSafe: false,
    startDate,
    endDate,
    series,
    loaded,
    failures,
    notes: [
      'No synthetic fallback is permitted.',
      'T10Y2Y and T10Y3M represent Treasury-curve slope; BAA10Y represents investment-grade credit spread; WALCL is a weekly Federal Reserve balance-sheet liquidity proxy.',
      'This loader uses the current FRED vintage. Therefore V5 is a research screening gate only and cannot be promoted to production until point-in-time/vintage safety is demonstrated.'
    ]
  };
}
