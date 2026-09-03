import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import type { PriceBar } from '../investment/backtesting/types';
import { HistoricalMarketDataService } from '../investment/data/marketData/historicalMarketDataService';
import { FundMarketDataService } from '../investment/data/marketData/fundMarketData';
import { CashBenchmarkService, SingleAssetResearchEngine, type SingleAssetResearchFrequency, type SingleAssetResearchResult, type SingleAssetResearchSignal } from '../investment/decision';

interface Props {
  requestedSymbol?: string | null;
  suggestions?: Array<{ ticker: string; name: string }>;
}

interface ResearchControlsProps {
  currentSymbol: string;
  suggestions: Array<{ ticker: string; name: string }>;
  startDate: string;
  frequency: SingleAssetResearchFrequency;
  loading: boolean;
  onStartDateChange: (value: string) => void;
  onFrequencyChange: (value: SingleAssetResearchFrequency) => void;
  onAnalyze: (value: string) => void;
}

type CachedResearch = { result: SingleAssetResearchResult; metadata: Record<string, any> };
type ChartRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';
const researchCache = new Map<string, CachedResearch>();

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function warmupStart(date: string): string { const d = new Date(`${date}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 2); return isoDate(d); }
function signed(value: number | null): string { return value == null ? 'N/D' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
function looksLikeIsin(value: string): boolean { return /^[A-Z]{2}[A-Z0-9]{10}$/.test(value); }
function rollingAverage(values: number[], index: number, lookback: number): number | null {
  if (index + 1 < lookback) return null;
  const slice = values.slice(index + 1 - lookback, index + 1);
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}
function chartRangeStart(lastDate: string, range: ChartRange): string | null {
  if (range === 'ALL') return null;
  const date = new Date(`${lastDate}T00:00:00Z`);
  const months = range === '1M' ? 1 : range === '3M' ? 3 : range === '6M' ? 6 : 12;
  date.setUTCMonth(date.getUTCMonth() - months);
  return isoDate(date);
}

function ResearchTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return <div className="max-w-[290px] rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] shadow-xl">
    <div className="font-mono text-slate-400">{label}</div>
    <div className="mt-1 font-bold text-white">Cierre/NAV {Number(row?.price ?? 0).toFixed(2)}</div>
    {row?.sma20 != null && <div className="mt-1 text-slate-400">SMA20 {Number(row.sma20).toFixed(2)}</div>}
    {row?.sma50 != null && <div className="text-slate-500">SMA50 {Number(row.sma50).toFixed(2)}</div>}
    {row?.marker && <><div className={`mt-2 font-black ${row.marker === 'SELL' ? 'text-rose-300' : row.marker === 'ADD' ? 'text-cyan-300' : 'text-emerald-300'}`}>{row.marker === 'BUY' ? 'COMPRAR' : row.marker === 'SELL' ? 'SALIR / REDUCIR' : 'AÑADIR'}</div><div className="mt-1 font-mono text-white">Ejecución {Number(row.executionPrice).toFixed(2)}</div><div className="mt-1 text-slate-300">Consenso {row.consensus > 0 ? '+' : ''}{row.consensus} · {row.favorable} favorables / {row.unfavorable} adversas</div><div className="mt-1 text-slate-500">Señal {row.signalDate} → ejecución {row.date}</div><div className="mt-1 text-slate-400">{row.reason}</div></>}
  </div>;
}

function BuyShape(props: any) { const { cx = 0, cy = 0 } = props; return <path d={`M ${cx} ${cy - 8} L ${cx - 7} ${cy + 6} L ${cx + 7} ${cy + 6} Z`} fill="#22c55e" stroke="#dcfce7" strokeWidth="1"/>; }
function SellShape(props: any) { const { cx = 0, cy = 0 } = props; return <path d={`M ${cx} ${cy + 8} L ${cx - 7} ${cy - 6} L ${cx + 7} ${cy - 6} Z`} fill="#fb7185" stroke="#ffe4e6" strokeWidth="1"/>; }
function AddShape(props: any) { const { cx = 0, cy = 0 } = props; return <path d={`M ${cx} ${cy - 7} L ${cx - 7} ${cy} L ${cx} ${cy + 7} L ${cx + 7} ${cy} Z`} fill="#22d3ee" stroke="#cffafe" strokeWidth="1"/>; }

const ResearchControls: React.FC<ResearchControlsProps> = React.memo(({ currentSymbol, suggestions, startDate, frequency, loading, onStartDateChange, onFrequencyChange, onAnalyze }) => {
  const [draftSymbol, setDraftSymbol] = useState(currentSymbol);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const symbolInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftSymbol(currentSymbol);
  }, [currentSymbol]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  const filteredSuggestions = useMemo(() => {
    const query = draftSymbol.trim().toUpperCase();
    if (!query) return suggestions.slice(0, 25);
    return suggestions.filter(item => item.ticker.toUpperCase().includes(query) || item.name.toUpperCase().includes(query)).slice(0, 25);
  }, [draftSymbol, suggestions]);

  const selectSymbol = (selected: string, immediateAnalyze = false) => {
    const clean = selected.trim().toUpperCase();
    setDraftSymbol(clean);
    setIsOpen(false);
    if (immediateAnalyze) onAnalyze(clean);
    else symbolInputRef.current?.focus();
  };

  return <div className="mt-4 grid gap-2 md:grid-cols-[1.4fr_1fr_0.8fr_auto]">
    <div ref={containerRef} className="relative rounded-xl border border-slate-700 bg-slate-950 p-3">
      <div className="flex items-center justify-between text-[9px] uppercase text-slate-500">
        <label htmlFor="research-symbol-input" className="cursor-pointer">Ticker / ISIN · buscador y listado</label>
        {draftSymbol && <button type="button" onClick={() => { setDraftSymbol(''); setIsOpen(true); symbolInputRef.current?.focus(); }} className="text-slate-400 hover:text-white transition-colors">Limpiar</button>}
      </div>
      <div onClick={() => symbolInputRef.current?.focus()} className="relative mt-1 flex min-h-12 cursor-text items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 touch-manipulation">
        <Search className="pointer-events-none h-4 w-4 shrink-0 text-slate-500"/>
        <input ref={symbolInputRef} id="research-symbol-input" type="text" inputMode="text" autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={draftSymbol} onFocus={() => setIsOpen(true)} onChange={e => { setDraftSymbol(e.target.value.toUpperCase()); setIsOpen(true); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setIsOpen(false); onAnalyze(draftSymbol); } else if (e.key === 'Escape') setIsOpen(false); }} placeholder="Escribe o busca: AAPL, SAN.MC, IE00B03HD191…" className="min-h-11 w-full bg-transparent font-mono text-sm font-bold text-white placeholder:text-slate-600 outline-none"/>
        <button type="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setIsOpen(prev => !prev); symbolInputRef.current?.focus(); }} className="p-1 text-slate-500 hover:text-slate-300 transition-colors" title="Ver catálogo"><ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} /></button>
      </div>

      {isOpen && <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/98 p-1.5 shadow-2xl backdrop-blur">
        <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{draftSymbol.trim() ? `Sugerencias coincidentes (${filteredSuggestions.length})` : `Catálogo disponible (${filteredSuggestions.length})`}</div>
        {filteredSuggestions.length === 0 ? <div className="px-3 py-2 text-xs text-slate-400">No hay coincidencias en catálogo. Pulsa <b className="text-white">Analizar</b> para consultar el proveedor en vivo.</div> : filteredSuggestions.map(item => {
          const isIsin = looksLikeIsin(item.ticker);
          return <button key={item.ticker} type="button" onMouseDown={e => { e.preventDefault(); selectSymbol(item.ticker, false); }} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-cyan-500/15 hover:text-white"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-mono font-bold text-cyan-300">{item.ticker}</span><span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">{isIsin ? 'FONDO' : 'ACCIÓN / ETF'}</span></div><div className="truncate text-[11px] text-slate-400">{item.name}</div></div></button>;
        })}
      </div>}
    </div>

    <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Estudiar desde</span><input type="date" value={startDate} max={isoDate(new Date())} onChange={e => onStartDateChange(e.target.value)} className="mt-1 w-full bg-transparent font-mono text-sm outline-none"/></label>
    <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Revisión</span><select value={frequency} onChange={e => onFrequencyChange(e.target.value as SingleAssetResearchFrequency)} className="mt-1 w-full bg-transparent text-sm outline-none"><option className="bg-slate-900" value="WEEKLY">Semanal</option><option className="bg-slate-900" value="MONTHLY">Mensual</option><option className="bg-slate-900" value="QUARTERLY">Trimestral</option></select><span className="mt-1 block text-[9px] text-slate-500">Semanal es el modo por defecto: una revisión por semana con datos diarios y ejecución en la siguiente observación.</span></label>
    <button onClick={() => onAnalyze(draftSymbol)} disabled={loading || !draftSymbol.trim()} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 hover:bg-cyan-500 transition-colors">{loading ? 'Analizando…' : 'Analizar'}</button>
  </div>;
});

const SingleAssetResearchPanelImpl: React.FC<Props> = ({ requestedSymbol, suggestions = [] }) => {
  const [symbol, setSymbol] = useState(requestedSymbol?.trim().toUpperCase() ?? '');
  const [startDate, setStartDate] = useState(yearsAgo(5));
  const [frequency, setFrequency] = useState<SingleAssetResearchFrequency>('WEEKLY');
  const [result, setResult] = useState<SingleAssetResearchResult | null>(null);
  const [metadata, setMetadata] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>('1Y');
  const [showSma20, setShowSma20] = useState(true);
  const [showSma50, setShowSma50] = useState(true);
  const requestIdRef = useRef(0);

  const analyzeSymbol = async (rawSymbol?: string, frequencyOverride?: SingleAssetResearchFrequency) => {
    const clean = (rawSymbol ?? symbol).trim().toUpperCase();
    if (!clean) return;
    const reviewFrequency = frequencyOverride ?? frequency;
    const endDate = isoDate(new Date());
    const cacheKey = `${clean}|${startDate}|${endDate}|${reviewFrequency}`;
    const cached = researchCache.get(cacheKey);
    setSymbol(clean);
    setError(null);
    if (cached) { setResult(cached.result); setMetadata(cached.metadata); setLoading(false); return; }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      let bars: PriceBar[];
      let nextMetadata: Record<string, any>;
      if (looksLikeIsin(clean)) {
        const fund = await FundMarketDataService.history(clean, warmupStart(startDate), endDate);
        bars = fund.points.map(point => ({ timestamp: `${point.date}T00:00:00.000Z`, open: point.nav, high: point.nav, low: point.nav, close: point.nav, volume: 0 }));
        nextMetadata = { currency: fund.currency, exchange: 'Fondo / NAV EODHD', providerName: 'EODHD', symbol: fund.symbol, fetchedAt: fund.fetchedAt };
      } else {
        const response = await HistoricalMarketDataService.getHistoricalBars({ symbol: clean, startDate: warmupStart(startDate), endDate, timeframe: '1d', adjusted: true }, { forceRefresh: false, maxRetries: 1 });
        bars = response.bars;
        nextMetadata = response.metadata;
      }
      if (requestId !== requestIdRef.current) return;
      const next = SingleAssetResearchEngine.run({ symbol: clean, bars, displayStartDate: startDate, endDate, frequency: reviewFrequency, cashBenchmarkAnnualPct: CashBenchmarkService.load() });
      if (requestId !== requestIdRef.current) return;
      researchCache.set(cacheKey, { result: next, metadata: nextMetadata });
      if (researchCache.size > 12) researchCache.delete(researchCache.keys().next().value as string);
      setResult(next);
      setMetadata(nextMetadata);
    } catch (e: any) {
      if (requestId === requestIdRef.current) { setResult(null); setError(e?.message || String(e)); }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const clean = requestedSymbol?.trim().toUpperCase();
    if (clean) void analyzeSymbol(clean);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [requestedSymbol]);

  const chartData = useMemo(() => {
    if (!result) return [];
    const markerByDate = new Map<string, SingleAssetResearchSignal>();
    for (const signal of result.signals) markerByDate.set(signal.executionDate, signal);
    const closes = result.chart.map(point => point.close);
    return result.chart.map((point, index) => {
      const signal = markerByDate.get(point.date);
      return {
        date: point.date,
        price: point.close,
        sma20: rollingAverage(closes, index, 20),
        sma50: rollingAverage(closes, index, 50),
        buyPrice: signal?.action === 'BUY' ? signal.executionPrice : null,
        addPrice: signal?.action === 'ADD' ? signal.executionPrice : null,
        sellPrice: signal?.action === 'SELL' ? signal.executionPrice : null,
        executionPrice: signal?.executionPrice,
        marker: signal?.action ?? null,
        signalDate: signal?.signalDate,
        consensus: signal?.consensusScore,
        favorable: signal?.favorableVotes,
        unfavorable: signal?.unfavorableVotes,
        reason: signal?.reason
      };
    });
  }, [result]);

  const visibleChartData = useMemo(() => {
    if (!chartData.length) return [];
    const start = chartRangeStart(chartData.at(-1)!.date, chartRange);
    return start ? chartData.filter(point => point.date >= start) : chartData;
  }, [chartData, chartRange]);

  const visibleSignals = useMemo(() => {
    if (!result || !visibleChartData.length) return [];
    const firstDate = visibleChartData[0].date;
    const lastDate = visibleChartData.at(-1)!.date;
    return result.signals.filter(signal => signal.executionDate >= firstDate && signal.executionDate <= lastDate);
  }, [result, visibleChartData]);

  const current = result?.currentAssessment ?? null;
  const currentLabel = current?.newMoneyAction === 'BUY' ? 'CANDIDATO A COMPRAR' : current?.newMoneyAction === 'AVOID' ? 'NO COMPRAR AHORA' : current ? 'VIGILAR' : 'SIN ANÁLISIS';
  const changeFrequency = (next: SingleAssetResearchFrequency) => { setFrequency(next); if (symbol) void analyzeSymbol(symbol, next); };

  return <section id="single-asset-research" className="scroll-mt-4 rounded-2xl border border-cyan-500/25 bg-slate-900 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-300"/><h2 className="font-bold text-white">Analizar cualquier valor</h2></div><p className="mt-1 max-w-3xl text-xs text-slate-400">Puedes escribir o pegar manualmente cualquier ticker/ISIN o elegir uno del catálogo. Editar el campo no recalcula la gráfica: el análisis solo se lanza al pulsar Analizar/Enter o al abrir expresamente la gráfica de una oportunidad.</p></div>
      {current && <div className={`rounded-xl border px-4 py-2 text-xs font-black ${current.newMoneyAction === 'BUY' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : current.newMoneyAction === 'AVOID' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>{currentLabel}</div>}
    </div>

    <ResearchControls currentSymbol={symbol} suggestions={suggestions} startDate={startDate} frequency={frequency} loading={loading} onStartDateChange={setStartDate} onFrequencyChange={changeFrequency} onAnalyze={value => void analyzeSymbol(value)} />

    {!result && !loading && !error && <div className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-xs text-slate-500">Escribe, pega o selecciona un ticker/ISIN y pulsa <b className="text-slate-300">Analizar</b>. No se ejecuta un análisis pesado por defecto al entrar en esta pantalla.</div>}
    {error && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {result && <>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px]"><span className="rounded-full border border-cyan-500/25 bg-cyan-500/5 px-3 py-1 font-bold text-cyan-200">Frecuencia: {frequency === 'WEEKLY' ? 'SEMANAL' : frequency === 'MONTHLY' ? 'MENSUAL' : 'TRIMESTRAL'}</span><span className="rounded-full border border-slate-700 px-3 py-1 text-slate-400">{result.reviews} revisiones causales</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Valor</div><b className="font-mono text-white">{result.symbol}</b><div className="text-[9px] text-slate-500">{metadata?.currency ?? 'divisa N/D'} · {metadata?.exchange ?? metadata?.providerName ?? 'mercado'}</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Seguir entradas/salidas</div><b className={(result.strategyReturnPct ?? 0) >= 0 ? 'font-mono text-emerald-200' : 'font-mono text-rose-200'}>{signed(result.strategyReturnPct)}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Comprar y mantener</div><b className={(result.buyHoldReturnPct ?? 0) >= 0 ? 'font-mono text-emerald-200' : 'font-mono text-rose-200'}>{signed(result.buyHoldReturnPct)}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Drawdown activo</div><b className="font-mono text-amber-200">-{result.assetMaxDrawdownPct?.toFixed(2) ?? 'N/D'}%</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Marcas</div><b>{result.signals.filter(s => s.action === 'BUY').length} compras · {result.signals.filter(s => s.action === 'SELL').length} salidas</b><div className="text-[9px] text-slate-500">{result.reviews} revisiones</div></div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div><b className="text-sm text-white">Precio/NAV y decisiones del motor</b><div className="text-[9px] text-slate-500">▲ compra · ◆ añadir · ▼ salida/reducción. El zoom sólo cambia la visualización: no recalcula señales ni altera el motor.</div></div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            {(['1M','3M','6M','1Y','ALL'] as ChartRange[]).map(range => <button key={range} type="button" onClick={() => setChartRange(range)} className={`rounded-lg border px-2.5 py-1.5 font-bold ${chartRange === range ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-100' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>{range === 'ALL' ? 'Todo' : range === '1Y' ? '1A' : range}</button>)}
            <button type="button" onClick={() => setShowSma20(value => !value)} className={`rounded-lg border px-2.5 py-1.5 font-bold ${showSma20 ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200' : 'border-slate-700 text-slate-500'}`}>SMA20</button>
            <button type="button" onClick={() => setShowSma50(value => !value)} className={`rounded-lg border px-2.5 py-1.5 font-bold ${showSma50 ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-slate-700 text-slate-500'}`}>SMA50</button>
          </div>
        </div>
        <div className="mb-2 flex flex-wrap gap-3 text-[10px]"><span className="text-emerald-300"><TrendingUp className="mr-1 inline h-3.5 w-3.5"/>Comprar</span><span className="text-cyan-300">◆ Añadir</span><span className="text-rose-300"><TrendingDown className="mr-1 inline h-3.5 w-3.5"/>Salir / reducir</span><span className="text-slate-500">{visibleChartData[0]?.date ?? 'N/D'} → {visibleChartData.at(-1)?.date ?? 'N/D'} · {visibleSignals.length} operaciones visibles</span></div>
        <div className="h-[430px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={visibleChartData} margin={{ top: 15, right: 15, left: 5, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="date" minTickGap={36} tick={{ fontSize: 9, fill: '#94a3b8' }}/><YAxis domain={['auto','auto']} width={62} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => Number(v).toFixed(0)}/><Tooltip content={<ResearchTooltip/>}/><Legend wrapperStyle={{ fontSize: 10 }}/><Line type="monotone" dataKey="price" name="Precio / NAV" stroke="#94a3b8" strokeWidth={2} dot={false}/>{showSma20 && <Line type="monotone" dataKey="sma20" name="SMA20" stroke="#818cf8" strokeWidth={1.4} dot={false} connectNulls={false}/>} {showSma50 && <Line type="monotone" dataKey="sma50" name="SMA50" stroke="#c084fc" strokeWidth={1.4} dot={false} connectNulls={false}/>}<Scatter dataKey="buyPrice" name="COMPRAR ▲" shape={<BuyShape/>}/><Scatter dataKey="addPrice" name="AÑADIR ◆" shape={<AddShape/>}/><Scatter dataKey="sellPrice" name="SALIR ▼" shape={<SellShape/>}/></ComposedChart></ResponsiveContainer></div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[820px] text-[10px]"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Ejecución</th><th className="p-2 text-left">Acción</th><th className="p-2 text-right">Precio</th><th className="p-2 text-right">Consenso</th><th className="p-2 text-left">Señal</th><th className="p-2 text-left">Motivo</th></tr></thead><tbody>{[...visibleSignals].reverse().map(signal => <tr key={signal.id} className="border-t border-slate-800"><td className="p-2 font-mono text-slate-300">{signal.executionDate}</td><td className={`p-2 font-black ${signal.action === 'BUY' ? 'text-emerald-300' : signal.action === 'ADD' ? 'text-cyan-300' : 'text-rose-300'}`}>{signal.action === 'SELL' ? 'SALIR/REDUCIR' : signal.action}</td><td className="p-2 text-right font-mono text-white">{signal.executionPrice.toFixed(2)}</td><td className="p-2 text-right font-mono">{signal.consensusScore >= 0 ? '+' : ''}{signal.consensusScore} · {signal.favorableVotes}/{signal.unfavorableVotes}</td><td className="p-2 font-mono text-slate-500">{signal.signalDate}</td><td className="max-w-[520px] p-2 text-slate-400">{signal.reason}</td></tr>)}</tbody></table>
          {visibleSignals.length === 0 && <div className="p-4 text-center text-[10px] text-slate-500">No hay BUY/ADD/SELL dentro del rango visible.</div>}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[10px] text-sky-100">Este gráfico es investigación de un activo aislado. El zoom, SMA20/SMA50 y la tabla son capas visuales: no alteran señales, cartera ni reglas del motor.</div>
    </>}
  </section>;
};

export const SingleAssetResearchPanel = React.memo(SingleAssetResearchPanelImpl);
