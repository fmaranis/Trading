import React, { useState } from 'react';
import { Activity, PlayCircle } from 'lucide-react';
import {
  AssetUniverseScanner,
  CashBenchmarkService,
  DynamicHistoricalReplayBatchEngine,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  SpanishTaxSettingsService,
  type DynamicReplayBatchResult,
  type InvestmentHorizonYears,
  type InvestorRiskProfile
} from '../investment/decision';

interface Props {
  capitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function signed(value: number | null, digits = 2): string {
  if (value == null) return 'N/D';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export const HistoricalReplayRobustnessPanel: React.FC<Props> = ({ capitalEur, riskProfile, horizonYears }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DynamicReplayBatchResult | null>(null);
  const [coverage, setCoverage] = useState<{ accepted: number; scanned: number; from: string } | null>(null);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
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
      if (historicalScan.acceptedDataset.assets.length < 1) throw new Error('No hay histórico REAL suficiente para ejecutar la batería de fechas.');
      await new Promise(resolve => window.setTimeout(resolve, 0));
      setResult(DynamicHistoricalReplayBatchEngine.run({
        dataset: historicalScan.acceptedDataset,
        catalog: EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        initialCapitalEur: Math.max(1, capitalEur),
        riskProfile,
        horizonYears,
        cashBenchmarkAnnualPct: CashBenchmarkService.load(),
        taxSettings: SpanishTaxSettingsService.load(),
        minimumBars: 252,
        maximumStartDates: 20,
        dailyStressCases: 4
      }));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const summary = result?.summary;

  return <div className="mt-5 rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-fuchsia-300"/><b className="text-sm text-white">Prueba masiva desde muchas fechas</b></div>
        <p className="mt-1 text-[10px] text-slate-400">Prueba el mismo motor desde hasta 20 momentos distribuidos por el histórico REAL. No busca la mejor fecha ni ajusta parámetros. MONTHLY cubre todas las fechas y DAILY se repite solo en los peores drawdowns como stress.</p>
      </div>
      <button type="button" onClick={() => void run()} disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold text-fuchsia-100 disabled:opacity-50"><PlayCircle className="h-4 w-4"/>{loading ? 'Ejecutando batería…' : 'Probar muchas fechas'}</button>
    </div>
    {coverage && <div className="mt-2 text-[9px] text-slate-500">Cobertura: {coverage.accepted}/{coverage.scanned} instrumentos REAL · histórico solicitado desde {coverage.from}.</div>}
    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {summary && result && <div className="mt-4 space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Fechas válidas</div><b>{summary.successfulMonthlyCases}/{summary.requestedStartDates}</b><div className="text-[9px] text-slate-500">hasta 20 entradas distribuidas</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Ganó al cash</div><b className="text-emerald-200">{summary.monthlyBeatsCashCases}/{summary.successfulMonthlyCases}</b><div>{summary.monthlyBeatsCashPct.toFixed(1)}%</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Ganó a primera cartera</div><b className="text-cyan-200">{summary.monthlyBeatsStaticCases}/{summary.comparableStaticCases}</b><div>{summary.monthlyBeatsStaticPct == null ? 'N/D' : `${summary.monthlyBeatsStaticPct.toFixed(1)}%`}</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Mediana avisos posteriores</div><b className={(summary.monthlyMedianExcessVsStaticPctPoints ?? 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}>{signed(summary.monthlyMedianExcessVsStaticPctPoints)} pp</b><div>peor {signed(summary.monthlyWorstExcessVsStaticPctPoints)} pp</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Rentabilidad mediana</div><b>{signed(summary.monthlyMedianReturnPct)}%</b><div>MONTHLY</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Drawdown mediano</div><b className="text-amber-200">-{(summary.monthlyMedianDrawdownPct ?? 0).toFixed(2)}%</b><div>trayectoria dinámica</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Casos defensivos</div><b>{summary.monthlyDefensiveSignalCases}/{summary.successfulMonthlyCases}</b><div>{summary.monthlyExecutedDefensiveCases} con REDUCE/EXIT ejecutado</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Stress DAILY</div><b>{summary.dailyBetterThanMonthlyCases}/{summary.dailyStressCases}</b><div>mejor que MONTHLY · {summary.dailyReducedDrawdownCases} redujeron DD</div></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[980px] text-[10px]">
          <thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Inicio</th><th className="p-2 text-right">MONTHLY</th><th className="p-2 text-right">vs cash</th><th className="p-2 text-right">vs 1ª cartera</th><th className="p-2 text-right">DD</th><th className="p-2 text-right">Ops</th><th className="p-2 text-right">RED/EXIT</th><th className="p-2 text-right">DAILY stress</th><th className="p-2 text-right">DAILY vs MONTHLY</th></tr></thead>
          <tbody>{result.cases.map(row => {
            const monthlyOps = row.monthly.executedBuys + row.monthly.executedAdds + row.monthly.executedReductions + row.monthly.executedExits;
            const defensive = row.monthly.signals.filter(signal => signal.action === 'REDUCE' || signal.action === 'EXIT').length;
            const dailyDelta = row.dailyStress ? row.dailyStress.finalValueEur - row.monthly.finalValueEur : null;
            return <tr key={row.startDate} className="border-t border-slate-800"><td className="p-2 font-mono text-slate-300">{row.startDate}</td><td className="p-2 text-right"><b>{signed(row.monthly.totalReturnPct)}%</b><div className="text-slate-500">{row.monthly.finalValueEur.toFixed(0)} €</div></td><td className="p-2 text-right">{signed(row.monthly.excessReturnVsCashPctPoints)} pp</td><td className={`p-2 text-right ${(row.monthly.excessReturnVsStaticPctPoints ?? 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{signed(row.monthly.excessReturnVsStaticPctPoints)} pp</td><td className="p-2 text-right text-amber-200">-{row.monthly.decisionPathMaxDrawdownPct.toFixed(1)}%</td><td className="p-2 text-right">{monthlyOps}</td><td className="p-2 text-right">{defensive}</td><td className="p-2 text-right">{row.dailyStress ? `${signed(row.dailyStress.totalReturnPct)}%` : '—'}</td><td className={`p-2 text-right ${(dailyDelta ?? 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{dailyDelta == null ? '—' : `${signed(dailyDelta)} €`}</td></tr>;
          })}</tbody>
        </table>
      </div>

      <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><summary className="cursor-pointer text-[10px] font-bold text-slate-300">Cómo interpretar esta batería</summary><div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-[9px] text-slate-500">{result.notes.map(note => <div key={note}>• {note}</div>)}</div></details>
    </div>}
  </div>;
};