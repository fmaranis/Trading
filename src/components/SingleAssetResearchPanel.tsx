import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { HistoricalMarketDataService } from '../investment/data/marketData/historicalMarketDataService';
import { CashBenchmarkService, SingleAssetResearchEngine, type SingleAssetResearchFrequency, type SingleAssetResearchResult } from '../investment/decision';

interface Props { requestedSymbol?: string | null; }

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function warmupStart(date: string): string { const d = new Date(`${date}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 2); return isoDate(d); }
function signed(value: number | null): string { return value == null ? 'N/D' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }

function ResearchTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return <div className="max-w-[280px] rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] shadow-xl">
    <div className="font-mono text-slate-400">{label}</div>
    <div className="mt-1 font-bold text-white">Precio {Number(row?.price ?? 0).toFixed(2)}</div>
    {row?.marker && <><div className={`mt-2 font-black ${row.marker === 'SELL' ? 'text-rose-300' : row.marker === 'ADD' ? 'text-cyan-300' : 'text-emerald-300'}`}>{row.marker === 'BUY' ? 'COMPRAR' : row.marker === 'SELL' ? 'SALIR / REDUCIR' : 'AÑADIR'}</div><div className="mt-1 text-slate-300">Consenso {row.consensus > 0 ? '+' : ''}{row.consensus} · {row.favorable} favorables / {row.unfavorable} adversas</div><div className="mt-1 text-slate-500">Señal {row.signalDate} → ejecución {row.date}</div><div className="mt-1 text-slate-400">{row.reason}</div></>}
  </div>;
}

export const SingleAssetResearchPanel: React.FC<Props> = ({ requestedSymbol }) => {
  const [symbol, setSymbol] = useState(requestedSymbol || 'NVDA');
  const [startDate, setStartDate] = useState(yearsAgo(5));
  const [frequency, setFrequency] = useState<SingleAssetResearchFrequency>('MONTHLY');
  const [result, setResult] = useState<SingleAssetResearchResult | null>(null);
  const [metadata, setMetadata] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (requestedSymbol) setSymbol(requestedSymbol); }, [requestedSymbol]);

  const analyze = async () => {
    const clean = symbol.trim().toUpperCase();
    if (!clean || loading) return;
    setLoading(true); setError(null);
    try {
      const endDate = isoDate(new Date());
      const response = await HistoricalMarketDataService.getHistoricalBars({ symbol: clean, startDate: warmupStart(startDate), endDate, timeframe: '1d', adjusted: true }, { forceRefresh: false, maxRetries: 1 });
      const next = SingleAssetResearchEngine.run({ symbol: clean, bars: response.bars, displayStartDate: startDate, endDate, frequency, cashBenchmarkAnnualPct: CashBenchmarkService.load() });
      setResult(next);
      setMetadata(response.metadata ?? {});
    } catch (e: any) {
      setResult(null);
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { void analyze(); /* initial illustrative arbitrary ticker */ /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const chartData = useMemo(() => {
    if (!result) return [];
    const markerByDate = new Map(result.signals.map(signal => [signal.executionDate, signal]));
    return result.chart.map(point => {
      const signal = markerByDate.get(point.date);
      return {
        date: point.date,
        price: point.close,
        buyPrice: signal?.action === 'BUY' ? point.close : null,
        addPrice: signal?.action === 'ADD' ? point.close : null,
        sellPrice: signal?.action === 'SELL' ? point.close : null,
        marker: signal?.action ?? null,
        signalDate: signal?.signalDate,
        consensus: signal?.consensusScore,
        favorable: signal?.favorableVotes,
        unfavorable: signal?.unfavorableVotes,
        reason: signal?.reason
      };
    });
  }, [result]);

  const current = result?.currentAssessment ?? null;
  const currentLabel = current?.newMoneyAction === 'BUY' ? 'CANDIDATO A COMPRAR' : current?.newMoneyAction === 'AVOID' ? 'NO COMPRAR AHORA' : current ? 'VIGILAR' : 'SIN ANÁLISIS';

  return <section className="rounded-2xl border border-cyan-500/25 bg-slate-900 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-300"/><h2 className="font-bold text-white">Analizar cualquier valor</h2></div><p className="mt-1 max-w-3xl text-xs text-slate-400">Introduce un ticker admitido por el proveedor (por ejemplo AAPL, NVDA, ASML.AS, SAN.MC, SAP.DE o un ETF). El gráfico reconstruye qué habría dicho el motor usando solo información disponible entonces.</p></div>
      {current && <div className={`rounded-xl border px-4 py-2 text-xs font-black ${current.newMoneyAction === 'BUY' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : current.newMoneyAction === 'AVOID' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>{currentLabel}</div>}
    </div>

    <div className="mt-4 grid gap-2 md:grid-cols-[1.2fr_1fr_0.8fr_auto]">
      <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Ticker</span><div className="mt-1 flex items-center gap-2"><Search className="h-4 w-4 text-slate-500"/><input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') void analyze(); }} placeholder="AAPL / SAN.MC / SAP.DE…" className="w-full bg-transparent font-mono font-bold outline-none"/></div></label>
      <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Estudiar desde</span><input type="date" value={startDate} max={isoDate(new Date())} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full bg-transparent font-mono text-sm outline-none"/></label>
      <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Revisión</span><select value={frequency} onChange={e => setFrequency(e.target.value as SingleAssetResearchFrequency)} className="mt-1 w-full bg-transparent text-sm outline-none"><option className="bg-slate-900" value="MONTHLY">Mensual</option><option className="bg-slate-900" value="QUARTERLY">Trimestral</option></select></label>
      <button onClick={() => void analyze()} disabled={loading} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Analizando…' : 'Analizar'}</button>
    </div>

    {error && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {result && <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Ticker</div><b className="font-mono text-white">{result.symbol}</b><div className="text-[9px] text-slate-500">{metadata?.currency ?? 'divisa N/D'} · {metadata?.exchange ?? metadata?.providerName ?? 'mercado'}</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Seguir entradas/salidas</div><b className={(result.strategyReturnPct ?? 0) >= 0 ? 'font-mono text-emerald-200' : 'font-mono text-rose-200'}>{signed(result.strategyReturnPct)}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Comprar y mantener</div><b className={(result.buyHoldReturnPct ?? 0) >= 0 ? 'font-mono text-emerald-200' : 'font-mono text-rose-200'}>{signed(result.buyHoldReturnPct)}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Drawdown activo</div><b className="font-mono text-amber-200">-{result.assetMaxDrawdownPct?.toFixed(2) ?? 'N/D'}%</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Marcas</div><b>{result.signals.filter(s => s.action === 'BUY').length} compras · {result.signals.filter(s => s.action === 'SELL').length} salidas</b><div className="text-[9px] text-slate-500">{result.reviews} revisiones</div></div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm text-white">Precio y decisiones del motor</b><div className="text-[9px] text-slate-500">▲ compra · ◆ añadir · ▼ salida/reducción. La señal se decide antes y se pinta en la siguiente apertura ejecutable.</div></div><div className="flex gap-3 text-[10px]"><span className="text-emerald-300"><TrendingUp className="mr-1 inline h-3.5 w-3.5"/>Comprar</span><span className="text-rose-300"><TrendingDown className="mr-1 inline h-3.5 w-3.5"/>Salir</span></div></div>
        <div className="h-[430px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: 5, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
              <XAxis dataKey="date" minTickGap={36} tick={{ fontSize: 9, fill: '#94a3b8' }}/>
              <YAxis domain={['auto','auto']} width={62} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => Number(v).toFixed(0)}/>
              <Tooltip content={<ResearchTooltip/>}/>
              <Legend wrapperStyle={{ fontSize: 10 }}/>
              <Line type="monotone" dataKey="price" name="Precio" stroke="#94a3b8" strokeWidth={2} dot={false}/>
              <Scatter dataKey="buyPrice" name="COMPRAR ▲" fill="#22c55e" shape="triangle"/>
              <Scatter dataKey="addPrice" name="AÑADIR ◆" fill="#22d3ee" shape="diamond"/>
              <Scatter dataKey="sellPrice" name="SALIR ▼" fill="#fb7185" shape="triangle"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[10px] text-sky-100">Este gráfico es investigación de un activo aislado. No altera tu cartera real. Si el valor está en otra divisa o no está disponible en tu broker, esos gates se comprueban solo antes de convertirlo en operación real.</div>
    </>}
  </section>;
};