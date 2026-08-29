import React, { useEffect, useMemo, useState } from 'react';
import { FlaskConical, TrendingDown, TrendingUp } from 'lucide-react';
import {
  allCashBenchmark,
  brokerCommission,
  CashBenchmarkService,
  MarketSnapshotEntry,
  type AssetUniverseScanResult
} from '../investment/decision';

interface Props { scan: AssetUniverseScanResult; snapshots: MarketSnapshotEntry[]; }

interface SimulatedLine {
  ticker: string;
  instrumentType: 'ETF_ETC' | 'MUTUAL_FUND';
  allocatedEur: number;
  entryDate: string | null;
  entryPriceEur: number | null;
  currentPriceEur: number | null;
  units: number;
  feeEur: number;
  residualCashEur: number;
  currentValueEur: number;
  returnPct: number | null;
}

function firstExecutionBar(snapshot: MarketSnapshotEntry, scan: AssetUniverseScanResult, assetId: string, ticker: string) {
  const series = scan.acceptedDataset.assets.find(a => a.assetId === assetId || a.ticker.toUpperCase() === ticker.toUpperCase());
  if (!series) return null;
  const bars = [...series.bars].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const entry = bars.find(b => b.timestamp.slice(0, 10) > snapshot.asOfDate) ?? bars.find(b => b.timestamp.slice(0, 10) >= snapshot.asOfDate) ?? null;
  const current = bars.at(-1) ?? null;
  return entry && current ? { entry, current } : null;
}

function simulateSnapshot(snapshot: MarketSnapshotEntry, scan: AssetUniverseScanResult, capitalEur: number) {
  const benchmark = CashBenchmarkService.load();
  const endDate = scan.acceptedDataset.assets.flatMap(a => a.bars.slice(-1).map(b => b.timestamp.slice(0, 10))).sort().at(-1) ?? snapshot.asOfDate;
  const lines: SimulatedLine[] = snapshot.allocation.filter(a => a.weight > 0).map(allocation => {
    const prices = firstExecutionBar(snapshot, scan, allocation.assetId, allocation.ticker);
    const candidate = scan.candidates.find(c => c.asset.assetId === allocation.assetId || c.asset.ticker.toUpperCase() === allocation.ticker.toUpperCase());
    const instrumentType = candidate?.asset.instrumentType ?? 'ETF_ETC';
    const allocatedEur = capitalEur * allocation.weight;
    if (!prices || !(prices.entry.open > 0) || !(prices.current.close > 0)) return { ticker: allocation.ticker, instrumentType, allocatedEur, entryDate: null, entryPriceEur: null, currentPriceEur: null, units: 0, feeEur: 0, residualCashEur: allocatedEur, currentValueEur: allocatedEur, returnPct: null };

    const entryDate = prices.entry.timestamp.slice(0, 10);
    if (instrumentType === 'MUTUAL_FUND') {
      const units = allocatedEur / prices.entry.open;
      const currentValueEur = units * prices.current.close;
      return { ticker: allocation.ticker, instrumentType, allocatedEur, entryDate, entryPriceEur: prices.entry.open, currentPriceEur: prices.current.close, units, feeEur: 0, residualCashEur: 0, currentValueEur, returnPct: (currentValueEur / allocatedEur - 1) * 100 };
    }

    let units = Math.floor(allocatedEur / prices.entry.open);
    let feeEur = units > 0 ? brokerCommission(units * prices.entry.open) : 0;
    while (units > 0 && units * prices.entry.open + feeEur > allocatedEur) {
      units -= 1;
      feeEur = units > 0 ? brokerCommission(units * prices.entry.open) : 0;
    }
    const spent = units * prices.entry.open + feeEur;
    const residualInitial = Math.max(0, allocatedEur - spent);
    const residualCashEur = allCashBenchmark(residualInitial, benchmark, entryDate, endDate).finalEur;
    const currentValueEur = units * prices.current.close + residualCashEur;
    return { ticker: allocation.ticker, instrumentType, allocatedEur, entryDate, entryPriceEur: prices.entry.open, currentPriceEur: prices.current.close, units, feeEur, residualCashEur, currentValueEur, returnPct: allocatedEur > 0 ? (currentValueEur / allocatedEur - 1) * 100 : null };
  });

  const cashInitial = capitalEur * snapshot.cashWeight;
  const benchmarkStart = lines.map(l => l.entryDate).filter(Boolean).sort()[0] ?? snapshot.asOfDate;
  const strategicCashFinal = allCashBenchmark(cashInitial, benchmark, benchmarkStart!, endDate).finalEur;
  const investedFinal = lines.reduce((s, line) => s + line.currentValueEur, 0);
  const finalEur = investedFinal + strategicCashFinal;
  const allCash = allCashBenchmark(capitalEur, benchmark, benchmarkStart!, endDate);
  return { lines, endDate, strategicCashFinal, finalEur, returnPct: (finalEur / capitalEur - 1) * 100, allCashFinalEur: allCash.finalEur, allCashReturnPct: allCash.returnPct, excessEur: finalEur - allCash.finalEur, excessPctPoints: (finalEur / capitalEur - 1) * 100 - allCash.returnPct };
}

export const RecommendationSimulationPanel: React.FC<Props> = ({ scan, snapshots }) => {
  const defaultCapital = Math.max(100, snapshots[0]?.allocation.reduce((s, x) => s + x.amountEur, 0) ?? 100);
  const [capital, setCapital] = useState(defaultCapital);
  const [selectedId, setSelectedId] = useState(snapshots.find(s => s.asOfDate < (snapshots[0]?.asOfDate ?? '9999-99-99'))?.id ?? snapshots[0]?.id ?? '');
  useEffect(() => {
    if (snapshots.length && !snapshots.some(s => s.id === selectedId)) setSelectedId(snapshots[0].id);
  }, [snapshots, selectedId]);
  const selected = snapshots.find(s => s.id === selectedId) ?? snapshots[0] ?? null;
  const simulation = useMemo(() => selected ? simulateSnapshot(selected, scan, Math.max(1, capital)) : null, [selected, scan, capital]);

  return <section className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/5 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div><div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-fuchsia-300"/><h2 className="font-bold">Si hubiera seguido una recomendación anterior…</h2></div><p className="mt-1 max-w-3xl text-[11px] text-slate-400">Simulación sobre las recomendaciones guardadas por la propia app. Usa el primer precio ejecutable posterior a la decisión, títulos enteros y comisión para ETF/ETC, participaciones fraccionarias para fondos y remunera el efectivo restante con la misma referencia configurada.</p></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]"><label className="text-[10px] text-slate-500">Recomendación<select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white">{snapshots.map(s => <option key={s.id} value={s.id}>{s.asOfDate} · {s.riskProfile} · {s.horizonYears}a · {s.marketRegime}</option>)}</select></label><label className="text-[10px] text-slate-500">Capital simulado €<input type="number" min="1" step="10" value={capital} onChange={e => setCapital(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-white"/></label></div>
    </div>

    {!selected && <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-xs text-slate-500">Aún no hay recomendaciones guardadas en este navegador. La pantalla principal guardará una snapshot diaria automáticamente.</div>}

    {selected && simulation && <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs"><div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Recomendación</div><b>{selected.asOfDate}</b><div className="text-[10px] text-slate-500">hasta {simulation.endDate}</div></div><div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Valor hoy</div><b className="font-mono">{simulation.finalEur.toFixed(2)} €</b><div className={simulation.returnPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{simulation.returnPct >= 0 ? '+' : ''}{simulation.returnPct.toFixed(2)}%</div></div><div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Si lo hubiera dejado en cuenta</div><b className="font-mono">{simulation.allCashFinalEur.toFixed(2)} €</b><div className="text-slate-500">+{simulation.allCashReturnPct.toFixed(2)}%</div></div><div className={`rounded-xl p-3 ${simulation.excessEur >= 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}><div className="text-[9px] uppercase text-slate-500">Valor añadido</div><b className={`font-mono ${simulation.excessEur >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{simulation.excessEur >= 0 ? '+' : ''}{simulation.excessEur.toFixed(2)} €</b><div className="text-slate-500">{simulation.excessPctPoints >= 0 ? '+' : ''}{simulation.excessPctPoints.toFixed(2)} pp</div></div><div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Resultado</div><div className="mt-1 flex items-center gap-1 font-bold">{simulation.excessEur >= 0 ? <><TrendingUp className="h-4 w-4 text-emerald-300"/><span className="text-emerald-200">MEJOR QUE EFECTIVO</span></> : <><TrendingDown className="h-4 w-4 text-amber-300"/><span className="text-amber-200">PEOR QUE EFECTIVO</span></>}</div></div></div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-950 text-[10px] uppercase text-slate-500"><tr><th className="p-3 text-left">Producto</th><th className="p-3 text-right">Asignado</th><th className="p-3 text-right">Entrada</th><th className="p-3 text-right">Hoy</th><th className="p-3 text-right">Unidades</th><th className="p-3 text-right">Comisión</th><th className="p-3 text-right">Valor hoy</th><th className="p-3 text-right">Resultado</th></tr></thead><tbody>{simulation.lines.map(line => <tr key={line.ticker} className="border-t border-slate-800 bg-slate-950/40"><td className="p-3"><b className="font-mono">{line.ticker}</b><div className="text-[9px] text-slate-500">{line.instrumentType === 'MUTUAL_FUND' ? 'FONDO' : 'ETF/ETC'} · {line.entryDate ?? 'sin precio ejecutable'}</div></td><td className="p-3 text-right font-mono">{line.allocatedEur.toFixed(2)} €</td><td className="p-3 text-right font-mono">{line.entryPriceEur?.toFixed(2) ?? 'N/D'}</td><td className="p-3 text-right font-mono">{line.currentPriceEur?.toFixed(2) ?? 'N/D'}</td><td className="p-3 text-right font-mono">{line.instrumentType === 'MUTUAL_FUND' ? line.units.toFixed(4) : line.units.toFixed(0)}</td><td className="p-3 text-right font-mono">{line.feeEur.toFixed(2)} €</td><td className="p-3 text-right font-mono">{line.currentValueEur.toFixed(2)} €</td><td className={`p-3 text-right font-mono ${(line.returnPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{line.returnPct == null ? 'N/D' : `${line.returnPct >= 0 ? '+' : ''}${line.returnPct.toFixed(2)}%`}</td></tr>)}</tbody></table></div>
      <div className="mt-3 text-[10px] text-slate-500">Es una simulación histórica de una recomendación guardada, no una previsión. No modela fiscalidad, spread ni settlement de fondos.</div>
    </>}
  </section>;
};