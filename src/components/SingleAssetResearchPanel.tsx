import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Search, TrendingDown, TrendingUp } from 'lucide-react';
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
const researchCache = new Map<string, CachedResearch>();

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function warmupStart(date: string): string { const d = new Date(`${date}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 2); return isoDate(d); }
function signed(value: number | null): string { return value == null ? 'N/D' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
function looksLikeIsin(value: string): boolean { return /^[A-Z]{2}[A-Z0-9]{10}$/.test(value); }

function ResearchTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return <div className="max-w-[290px] rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] shadow-xl">
    <div className="font-mono text-slate-400">{label}</div>
    <div className="mt-1 font-bold text-white">Cierre/NAV {Number(row?.price ?? 0).toFixed(2)}</div>
    {row?.marker && <><div className={`mt-2 font-black ${row.marker === 'SELL' ? 'text-rose-300' : row.marker === 'ADD' ? 'text-cyan-300' : 'text-emerald-300'}`}>{row.marker === 'BUY' ? 'COMPRAR' : row.marker === 'SELL' ? 'SALIR / REDUCIR' : 'AÑADIR'}</div><div className="mt-1 font-mono text-white">Ejecución {Number(row.executionPrice).toFixed(2)}</div><div className="mt-1 text-slate-300">Consenso {row.consensus > 0 ? '+' : ''}{row.consensus} · {row.favorable} favorables / {row.unfavorable} adversas</div><div className="mt-1 text-slate-500">Señal {row.signalDate} → ejecución {row.date}</div><div className="mt-1 text-slate-400">{row.reason}</div></>}
  </div>;
}

function BuyShape(props: any) { const { cx = 0, cy = 0 } = props; return <path d={`M ${cx} ${cy - 8} L ${cx - 7} ${cy + 6} L ${cx + 7} ${cy + 6} Z`} fill="#22c55e" stroke="#dcfce7" strokeWidth="1"/>; }
function SellShape(props: any) { const { cx = 0, cy = 0 } = props; return <path d={`M ${cx} ${cy + 8} L ${cx - 7} ${cy - 6} L ${cx + 7} ${cy - 6} Z`} fill="#fb7185" stroke="#ffe4e6" strokeWidth="1"/>; }
function AddShape(props: any) { const { cx = 0, cy = 0 } = props; return <path d={`M ${cx} ${cy - 7} L ${cx - 7} ${cy} L ${cx} ${cy + 7} L ${cx + 7} ${cy} Z`} fill="#22d3ee" stroke="#cffafe" strokeWidth="1"/>; }

const ResearchControls: React.FC<ResearchControlsProps> = React.memo(({ currentSymbol, suggestions, startDate, frequency, loading, onStartDateChange, onFrequencyChange, onAnalyze }) => {
  const [draftSymbol, setDraftSymbol] = useState(currentSymbol);
  const symbolInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftSymbol(currentSymbol);
  }, [currentSymbol]);

  const selectCatalogSymbol = (value: string) => {
    if (!value) return;
    setDraftSymbol(value.toUpperCase());
    window.setTimeout(() => symbolInputRef.current?.focus(), 0);
  };

  return <div className="mt-4 grid gap-2 md:grid-cols-[1.35fr_1fr_0.8fr_auto]">
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
      <label htmlFor="research-symbol-input" className="text-[9px] uppercase text-slate-500">Ticker / ISIN · escritura manual</label>
      <div onClick={() => symbolInputRef.current?.focus()} className="relative z-10 mt-1 flex min-h-12 cursor-text items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 touch-manipulation">
        <Search className="pointer-events-none h-4 w-4 shrink-0 text-slate-500"/>
        <input
          ref={symbolInputRef}
          id="research-symbol-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={draftSymbol}
          onChange={e => setDraftSymbol(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAnalyze(draftSymbol); } }}
          placeholder="Escribe o pega: AAPL / SAN.MC / IE00B03HD191…"
          className="relative z-20 min-h-11 w-full bg-transparent font-mono text-base font-bold text-white outline-none pointer-events-auto touch-manipulation"
        />
      </div>
      <label className="mt-2 block text-[9px] uppercase text-slate-500">O elegir del listado catalogado</label>
      <select value="" onChange={e => selectCatalogSymbol(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-800 bg-slate-900 px-2 text-xs text-slate-300 outline-none touch-manipulation">
        <option value="">Seleccionar ticker / fondo…</option>
        {suggestions.map(item => <option key={item.ticker} value={item.ticker}>{item.ticker} · {item.name}</option>)}
      </select>
      <div className="mt-1 text-[9px] text-slate-600">El listado solo rellena el campo. También puedes escribir o pegar cualquier ticker/ISIN que acepte el proveedor.</div>
    </div>
    <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Estudiar desde</span><input type="date" value={startDate} max={isoDate(new Date())} onChange={e => onStartDateChange(e.target.value)} className="mt-1 w-full bg-transparent font-mono text-sm outline-none"/></label>
    <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Revisión</span><select value={frequency} onChange={e => onFrequencyChange(e.target.value as SingleAssetResearchFrequency)} className="mt-1 w-full bg-transparent text-sm outline-none"><option className="bg-slate-900" value="WEEKLY">Semanal</option><option className="bg-slate-900" value="MONTHLY">Mensual</option><option className="bg-slate-900" value="QUARTERLY">Trimestral</option></select><span className="mt-1 block text-[9px] text-slate-500">Semanal es el modo por defecto: una revisión por semana con datos diarios y ejecución en la siguiente observación.</span></label>
    <button onClick={() => onAnalyze(draftSymbol)} disabled={loading || !draftSymbol.trim()} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Analizando…' : 'Analizar'}</button>
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
    if (cached) {
      setResult(cached.result);
      setMetadata(cached.metadata);
      setLoading(false);
      return;
    }

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
      if (requestId === requestIdRef.current) {
        setResult(null);
        setError(e?.message || String(e));
      }
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
    return result.chart.map(point => {
      const signal = markerByDate.get(point.date);
      return {
        date: point.date,
        price: point.close,
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

  const current = result?.currentAssessment ?? null;
  const currentLabel = current?.newMoneyAction === 'BUY' ? 'CANDIDATO A COMPRAR' : current?.newMoneyAction === 'AVOID' ? 'NO COMPRAR AHORA' : current ? 'VIGILAR' : 'SIN ANÁLISIS';
  const changeFrequency = (next: SingleAssetResearchFrequency) => {
    setFrequency(next);
    if (symbol) void analyzeSymbol(symbol, next);
  };

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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm text-white">Precio/NAV y decisiones del motor</b><div className="text-[9px] text-slate-500">▲ compra · ◆ añadir · ▼ salida/reducción. Cada marca está en la primera observación posterior a la señal; en valores cotizados es la siguiente apertura y en fondos es el siguiente NAV disponible.</div></div><div className="flex gap-3 text-[10px]"><span className="text-emerald-300"><TrendingUp className="mr-1 inline h-3.5 w-3.5"/>Comprar</span><span className="text-rose-300"><TrendingDown className="mr-1 inline h-3.5 w-3.5"/>Salir</span></div></div>
        <div className="h-[430px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 15, right: 15, left: 5, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="date" minTickGap={36} tick={{ fontSize: 9, fill: '#94a3b8' }}/><YAxis domain={['auto','auto']} width={62} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => Number(v).toFixed(0)}/><Tooltip content={<ResearchTooltip/>}/><Legend wrapperStyle={{ fontSize: 10 }}/><Line type="monotone" dataKey="price" name="Precio / NAV" stroke="#94a3b8" strokeWidth={2} dot={false}/><Scatter dataKey="buyPrice" name="COMPRAR ▲" shape={<BuyShape/>}/><Scatter dataKey="addPrice" name="AÑADIR ◆" shape={<AddShape/>}/><Scatter dataKey="sellPrice" name="SALIR ▼" shape={<SellShape/>}/></ComposedChart></ResponsiveContainer></div>
      </div>

      <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[10px] text-sky-100">Este gráfico es investigación de un activo aislado. No altera tu cartera real. La disponibilidad en MyInvestor se trata como asumida salvo que la marques expresamente como no disponible.</div>
    </>}
  </section>;
};

export const SingleAssetResearchPanel = React.memo(SingleAssetResearchPanelImpl);
