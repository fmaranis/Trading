import React, { useRef, useState } from 'react';
import { Activity, Loader2, PlayCircle, RotateCcw } from 'lucide-react';
import {
  AssetUniverseScanner,
  CashBenchmarkService,
  DynamicHistoricalReplayEngine,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  SpanishTaxSettingsService,
  selectDynamicReplayBatchStartDates,
  type DynamicHistoricalReplayResult,
  type DynamicReplayBatchSummary,
  type InvestmentHorizonYears,
  type InvestorRiskProfile
} from '../investment/decision';
import type { MultiAssetDataset } from '../investment/portfolioBacktesting/types';

interface Props {
  capitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
}

interface CompactReplayMetrics {
  finalValueEur: number;
  totalReturnPct: number;
  excessFinalEurVsCash: number;
  excessReturnVsCashPctPoints: number;
  excessFinalEurVsStatic: number | null;
  excessReturnVsStaticPctPoints: number | null;
  decisionPathMaxDrawdownPct: number;
  executedOperations: number;
  defensiveSignals: number;
  executedDefensive: number;
}

interface CompactReplayCase {
  startDate: string;
  monthly: CompactReplayMetrics;
  dailyStress: CompactReplayMetrics | null;
}

type BatchPhase = 'IDLE' | 'MONTHLY' | 'DAILY' | 'DONE';

const MONTHLY_CHUNK_SIZE = 2;
const DAILY_CHUNK_SIZE = 1;
const DAILY_STRESS_CASES = 4;

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function signed(value: number | null, digits = 2): string {
  if (value == null) return 'N/D';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function pct(count: number, total: number): number { return total > 0 ? count / total * 100 : 0; }
function yieldToBrowser(delayMs = 30): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, delayMs));
}
function compactReplay(result: DynamicHistoricalReplayResult): CompactReplayMetrics {
  return {
    finalValueEur: result.finalValueEur,
    totalReturnPct: result.totalReturnPct,
    excessFinalEurVsCash: result.excessFinalEurVsCash,
    excessReturnVsCashPctPoints: result.excessReturnVsCashPctPoints,
    excessFinalEurVsStatic: result.excessFinalEurVsStatic,
    excessReturnVsStaticPctPoints: result.excessReturnVsStaticPctPoints,
    decisionPathMaxDrawdownPct: result.decisionPathMaxDrawdownPct,
    executedOperations: result.executedBuys + result.executedAdds + result.executedReductions + result.executedExits,
    defensiveSignals: result.signals.filter(signal => signal.action === 'REDUCE' || signal.action === 'EXIT').length,
    executedDefensive: result.executedReductions + result.executedExits
  };
}
function summarizeCompact(startDates: string[], cases: CompactReplayCase[]): DynamicReplayBatchSummary {
  const monthly = cases.map(row => row.monthly);
  const comparable = monthly.filter(result => result.excessReturnVsStaticPctPoints != null);
  const dailyCases = cases.filter(row => row.dailyStress != null);
  const monthlyBeatsCashCases = monthly.filter(result => result.excessFinalEurVsCash > 0).length;
  const monthlyBeatsStaticCases = comparable.filter(result => (result.excessFinalEurVsStatic ?? 0) > 0).length;
  return {
    requestedStartDates: startDates.length,
    successfulMonthlyCases: monthly.length,
    comparableStaticCases: comparable.length,
    monthlyBeatsCashCases,
    monthlyBeatsStaticCases,
    monthlyBeatsCashPct: pct(monthlyBeatsCashCases, monthly.length),
    monthlyBeatsStaticPct: comparable.length ? pct(monthlyBeatsStaticCases, comparable.length) : null,
    monthlyMedianReturnPct: median(monthly.map(result => result.totalReturnPct)),
    monthlyMedianExcessVsStaticPctPoints: median(comparable.map(result => result.excessReturnVsStaticPctPoints!)),
    monthlyWorstExcessVsStaticPctPoints: comparable.length ? Math.min(...comparable.map(result => result.excessReturnVsStaticPctPoints!)) : null,
    monthlyMedianDrawdownPct: median(monthly.map(result => result.decisionPathMaxDrawdownPct)),
    monthlyDefensiveSignalCases: monthly.filter(result => result.defensiveSignals > 0).length,
    monthlyExecutedDefensiveCases: monthly.filter(result => result.executedDefensive > 0).length,
    dailyStressCases: dailyCases.length,
    dailyBetterThanMonthlyCases: dailyCases.filter(row => row.dailyStress!.finalValueEur > row.monthly.finalValueEur + 0.01).length,
    dailyReducedDrawdownCases: dailyCases.filter(row => row.dailyStress!.decisionPathMaxDrawdownPct + 1e-9 < row.monthly.decisionPathMaxDrawdownPct).length,
    dailyDefensiveSignalCases: dailyCases.filter(row => row.dailyStress!.defensiveSignals > 0).length
  };
}

export const HistoricalReplayRobustnessPanel: React.FC<Props> = ({ capitalEur, riskProfile, horizonYears }) => {
  const datasetRef = useRef<MultiAssetDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<BatchPhase>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [startDates, setStartDates] = useState<string[]>([]);
  const [attemptedMonthly, setAttemptedMonthly] = useState<string[]>([]);
  const [attemptedDaily, setAttemptedDaily] = useState<string[]>([]);
  const [dailyQueue, setDailyQueue] = useState<string[]>([]);
  const [cases, setCases] = useState<CompactReplayCase[]>([]);
  const [coverage, setCoverage] = useState<{ accepted: number; scanned: number; from: string } | null>(null);

  const reset = () => {
    datasetRef.current = null;
    setLoading(false);
    setPhase('IDLE');
    setError(null);
    setMessage('');
    setStartDates([]);
    setAttemptedMonthly([]);
    setAttemptedDaily([]);
    setDailyQueue([]);
    setCases([]);
    setCoverage(null);
  };

  const prepare = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setMessage('Descargando una vez el histórico REAL necesario para preparar las fechas…');
    try {
      const from = yearsAgo(6);
      const to = isoDate(new Date());
      const historicalScan = await AssetUniverseScanner.scan(
        EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        from,
        to,
        { forceRefresh: false, concurrency: 3, maxSelected: 12, minimumBars: 252, maxDataAgeDays: 7 }
      );
      setCoverage({ accepted: historicalScan.accepted, scanned: historicalScan.scanned, from });
      if (historicalScan.acceptedDataset.assets.length < 1) throw new Error('No hay histórico REAL suficiente para preparar la batería.');
      const selected = selectDynamicReplayBatchStartDates(historicalScan.acceptedDataset, {
        minimumBars: 252,
        minimumForwardSessions: 126,
        maxCases: 20
      });
      if (!selected.length) throw new Error('No hay fechas históricas válidas para esta batería.');
      datasetRef.current = historicalScan.acceptedDataset;
      setStartDates(selected);
      setAttemptedMonthly([]);
      setAttemptedDaily([]);
      setDailyQueue([]);
      setCases([]);
      setPhase('MONTHLY');
      setMessage(`Preparada: ${selected.length} fechas. Ejecuta ${MONTHLY_CHUNK_SIZE} fechas MONTHLY por tramo.`);
    } catch (e: any) {
      setError(e?.message || String(e));
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  const runMonthlyChunk = async () => {
    const dataset = datasetRef.current;
    if (loading || !dataset) return;
    const attempted = new Set(attemptedMonthly);
    const chunk = startDates.filter(date => !attempted.has(date)).slice(0, MONTHLY_CHUNK_SIZE);
    if (!chunk.length) return;
    setLoading(true);
    setError(null);
    const newCases: CompactReplayCase[] = [];
    const newlyAttempted: string[] = [];
    try {
      for (let i = 0; i < chunk.length; i++) {
        const startDate = chunk[i];
        setMessage(`MONTHLY ${attemptedMonthly.length + i + 1}/${startDates.length}: ${startDate}. Solo este pequeño tramo está en ejecución.`);
        await yieldToBrowser();
        try {
          const result = DynamicHistoricalReplayEngine.run({
            dataset,
            catalog: EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
            startDate,
            frequency: 'MONTHLY',
            initialCapitalEur: Math.max(1, capitalEur),
            riskProfile,
            horizonYears,
            cashBenchmarkAnnualPct: CashBenchmarkService.load(),
            minimumBars: 252,
            taxSettings: SpanishTaxSettingsService.load()
          });
          newCases.push({ startDate, monthly: compactReplay(result), dailyStress: null });
        } catch {
          // The date is recorded as attempted so a single unusable case cannot trap the UI in a retry loop.
        }
        newlyAttempted.push(startDate);
        await yieldToBrowser(60);
      }
      const nextAttempted = [...attemptedMonthly, ...newlyAttempted];
      const nextCases = [...cases, ...newCases].sort((a, b) => startDates.indexOf(a.startDate) - startDates.indexOf(b.startDate));
      setAttemptedMonthly(nextAttempted);
      setCases(nextCases);
      if (nextAttempted.length >= startDates.length) {
        const stressDates = [...nextCases]
          .sort((a, b) => b.monthly.decisionPathMaxDrawdownPct - a.monthly.decisionPathMaxDrawdownPct)
          .slice(0, DAILY_STRESS_CASES)
          .map(row => row.startDate);
        setDailyQueue(stressDates);
        setPhase(stressDates.length ? 'DAILY' : 'DONE');
        setMessage(stressDates.length
          ? `MONTHLY terminado. Los ${stressDates.length} peores drawdowns se comprobarán DAILY de uno en uno.`
          : 'MONTHLY terminado. No hay casos válidos para stress DAILY.');
      } else {
        setMessage(`Tramo terminado. ${nextAttempted.length}/${startDates.length} fechas MONTHLY intentadas; la app queda libre hasta el siguiente tramo.`);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const runDailyChunk = async () => {
    const dataset = datasetRef.current;
    if (loading || !dataset) return;
    const attempted = new Set(attemptedDaily);
    const chunk = dailyQueue.filter(date => !attempted.has(date)).slice(0, DAILY_CHUNK_SIZE);
    if (!chunk.length) return;
    setLoading(true);
    setError(null);
    const newlyAttempted: string[] = [];
    let nextCases = [...cases];
    try {
      for (const startDate of chunk) {
        setMessage(`Stress DAILY ${attemptedDaily.length + 1}/${dailyQueue.length}: ${startDate}. Se ejecuta un único caso.`);
        await yieldToBrowser();
        try {
          const result = DynamicHistoricalReplayEngine.run({
            dataset,
            catalog: EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
            startDate,
            frequency: 'DAILY',
            initialCapitalEur: Math.max(1, capitalEur),
            riskProfile,
            horizonYears,
            cashBenchmarkAnnualPct: CashBenchmarkService.load(),
            minimumBars: 252,
            taxSettings: SpanishTaxSettingsService.load()
          });
          nextCases = nextCases.map(row => row.startDate === startDate ? { ...row, dailyStress: compactReplay(result) } : row);
        } catch {
          // Failed DAILY stress remains visible as missing, but does not block subsequent cases.
        }
        newlyAttempted.push(startDate);
        await yieldToBrowser(80);
      }
      const nextAttempted = [...attemptedDaily, ...newlyAttempted];
      setAttemptedDaily(nextAttempted);
      setCases(nextCases);
      if (nextAttempted.length >= dailyQueue.length) {
        setPhase('DONE');
        setMessage('Batería terminada. Los replays pesados ya se descartaron; solo quedan métricas compactas.');
      } else {
        setMessage(`Stress DAILY guardado. ${nextAttempted.length}/${dailyQueue.length}; la app queda libre hasta el siguiente caso.`);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const primaryAction = () => {
    if (phase === 'IDLE') return void prepare();
    if (phase === 'MONTHLY') return void runMonthlyChunk();
    if (phase === 'DAILY') return void runDailyChunk();
    reset();
  };

  const summary = startDates.length ? summarizeCompact(startDates, cases) : null;
  const completed = phase === 'DAILY' || phase === 'DONE' ? attemptedMonthly.length + attemptedDaily.length : attemptedMonthly.length;
  const totalSteps = startDates.length + dailyQueue.length;
  const progressPct = totalSteps > 0 ? Math.round(completed / totalSteps * 100) : 0;
  const buttonLabel = phase === 'IDLE'
    ? 'Preparar prueba por tramos'
    : phase === 'MONTHLY'
      ? `Ejecutar siguiente tramo (${MONTHLY_CHUNK_SIZE} MONTHLY)`
      : phase === 'DAILY'
        ? 'Ejecutar siguiente stress (1 DAILY)'
        : 'Reiniciar batería';

  return <div className="mt-5 rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-fuchsia-300"/><b className="text-sm text-white">Prueba masiva desde muchas fechas · modo por tramos</b></div>
        <p className="mt-1 text-[10px] text-slate-400">No ejecuta ya 20 MONTHLY + 4 DAILY de una sola vez. Primero prepara las fechas; después procesa 2 MONTHLY por pulsación y, al final, 1 DAILY por pulsación. Cada replay se reduce a métricas compactas y se descarta antes del siguiente.</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={primaryAction}
          disabled={loading}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-fuchsia-300"/> : phase === 'DONE' ? <RotateCcw className="h-4 w-4 text-fuchsia-300"/> : <PlayCircle className="h-4 w-4 text-fuchsia-300"/>}
          {loading ? 'Ejecutando este tramo…' : buttonLabel}
        </button>
      </div>
    </div>

    {(message || totalSteps > 0) && <div className="mt-3 rounded-lg border border-fuchsia-500/20 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-3 text-xs text-fuchsia-200"><span>{message}</span><span className="shrink-0 font-mono font-bold text-fuchsia-300">{progressPct}%</span></div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-gradient-to-r from-fuchsia-600 to-pink-500 transition-all duration-300 ease-out" style={{ width: `${Math.max(totalSteps ? 3 : 0, progressPct)}%` }}/></div>
      {phase !== 'IDLE' && <div className="mt-2 text-[9px] text-slate-500">MONTHLY intentadas: {attemptedMonthly.length}/{startDates.length} · DAILY intentadas: {attemptedDaily.length}/{dailyQueue.length || 'pendiente'} · resultados MONTHLY válidos: {cases.length}</div>}
    </div>}

    {coverage && <div className="mt-2 text-[9px] text-slate-500">Cobertura: {coverage.accepted}/{coverage.scanned} instrumentos REAL · histórico solicitado desde {coverage.from}.</div>}
    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {summary && cases.length > 0 && <div className="mt-4 space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Fechas válidas hasta ahora</div><b>{summary.successfulMonthlyCases}/{summary.requestedStartDates}</b><div className="text-[9px] text-slate-500">el resumen se actualiza tramo a tramo</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Ganó al cash</div><b className="text-emerald-200">{summary.monthlyBeatsCashCases}/{summary.successfulMonthlyCases}</b><div>{summary.monthlyBeatsCashPct.toFixed(1)}%</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Ganó a primera cartera</div><b className="text-cyan-200">{summary.monthlyBeatsStaticCases}/{summary.comparableStaticCases}</b><div>{summary.monthlyBeatsStaticPct == null ? 'N/D' : `${summary.monthlyBeatsStaticPct.toFixed(1)}%`}</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Mediana avisos posteriores</div><b className={(summary.monthlyMedianExcessVsStaticPctPoints ?? 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}>{signed(summary.monthlyMedianExcessVsStaticPctPoints)} pp</b><div>peor {signed(summary.monthlyWorstExcessVsStaticPctPoints)} pp</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Rentabilidad mediana</div><b>{signed(summary.monthlyMedianReturnPct)}%</b><div>MONTHLY procesado</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Drawdown mediano</div><b className="text-amber-200">-{(summary.monthlyMedianDrawdownPct ?? 0).toFixed(2)}%</b><div>trayectoria dinámica</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Casos defensivos</div><b>{summary.monthlyDefensiveSignalCases}/{summary.successfulMonthlyCases}</b><div>{summary.monthlyExecutedDefensiveCases} con REDUCE/EXIT ejecutado</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Stress DAILY</div><b>{summary.dailyBetterThanMonthlyCases}/{summary.dailyStressCases}</b><div>mejor que MONTHLY · {summary.dailyReducedDrawdownCases} redujeron DD</div></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[980px] text-[10px]">
          <thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Inicio</th><th className="p-2 text-right">MONTHLY</th><th className="p-2 text-right">vs cash</th><th className="p-2 text-right">vs 1ª cartera</th><th className="p-2 text-right">DD</th><th className="p-2 text-right">Ops</th><th className="p-2 text-right">RED/EXIT</th><th className="p-2 text-right">DAILY stress</th><th className="p-2 text-right">DAILY vs MONTHLY</th></tr></thead>
          <tbody>{cases.map(row => {
            const dailyDelta = row.dailyStress ? row.dailyStress.finalValueEur - row.monthly.finalValueEur : null;
            return <tr key={row.startDate} className="border-t border-slate-800"><td className="p-2 font-mono text-slate-300">{row.startDate}</td><td className="p-2 text-right"><b>{signed(row.monthly.totalReturnPct)}%</b><div className="text-slate-500">{row.monthly.finalValueEur.toFixed(0)} €</div></td><td className="p-2 text-right">{signed(row.monthly.excessReturnVsCashPctPoints)} pp</td><td className={`p-2 text-right ${(row.monthly.excessReturnVsStaticPctPoints ?? 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{signed(row.monthly.excessReturnVsStaticPctPoints)} pp</td><td className="p-2 text-right text-amber-200">-{row.monthly.decisionPathMaxDrawdownPct.toFixed(1)}%</td><td className="p-2 text-right">{row.monthly.executedOperations}</td><td className="p-2 text-right">{row.monthly.defensiveSignals}</td><td className="p-2 text-right">{row.dailyStress ? `${signed(row.dailyStress.totalReturnPct)}%` : '—'}</td><td className={`p-2 text-right ${(dailyDelta ?? 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{dailyDelta == null ? '—' : `${signed(dailyDelta)} €`}</td></tr>;
          })}</tbody>
        </table>
      </div>

      <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><summary className="cursor-pointer text-[10px] font-bold text-slate-300">Cómo funciona el modo seguro por tramos</summary><div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-[9px] text-slate-500"><div>• Las fechas siguen seleccionándose por cronología y disponibilidad, nunca por rentabilidad.</div><div>• Cada pulsación MONTHLY procesa como máximo {MONTHLY_CHUNK_SIZE} fechas y después devuelve el control completo a la interfaz.</div><div>• Los objetos pesados con señales, eventos y equity diario se convierten inmediatamente en métricas compactas y se descartan.</div><div>• Los {DAILY_STRESS_CASES} peores drawdowns se prueban DAILY de uno en uno, solo después de terminar MONTHLY.</div><div>• El usuario puede detenerse entre tramos sin perder los resultados ya calculados mientras permanezca en esta pantalla.</div></div></details>
    </div>}
  </div>;
};