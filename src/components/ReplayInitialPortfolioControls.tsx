import React, { useMemo, useState } from 'react';
import {
  AssetUniverseScanner,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  UserPortfolioService,
  type DynamicReplayInitialAllocation,
  type DynamicReplayInitialPortfolioSource,
  type DynamicReplaySimulationMode
} from '../investment/decision';

export interface ReplayScenarioDraft {
  source: DynamicReplayInitialPortfolioSource;
  simulationMode: DynamicReplaySimulationMode;
  cashEur: number;
  allocations: DynamicReplayInitialAllocation[];
}

export const DEFAULT_REPLAY_SCENARIO: ReplayScenarioDraft = {
  source: 'ZERO',
  simulationMode: 'CUSTODIA_ENGINE',
  cashEur: 0,
  allocations: []
};

interface Props {
  value: ReplayScenarioDraft;
  disabled?: boolean;
  onChange: (value: ReplayScenarioDraft) => void;
}

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function normalizeAllocations(rows: DynamicReplayInitialAllocation[]): DynamicReplayInitialAllocation[] {
  const byAsset = new Map<string, number>();
  for (const row of rows) {
    const assetId = String(row.assetId || '').trim();
    const amountEur = Math.max(0, Number(row.amountEur) || 0);
    if (!assetId || !(amountEur > 0)) continue;
    byAsset.set(assetId, (byAsset.get(assetId) ?? 0) + amountEur);
  }
  return [...byAsset.entries()].map(([assetId, amountEur]) => ({ assetId, amountEur })).sort((a, b) => a.assetId.localeCompare(b.assetId));
}
function catalogueName(assetId: string): string {
  const item = EUR_PORTFOLIO_DISCOVERY_UNIVERSE.find(asset => asset.assetId === assetId);
  return item ? `${item.ticker} · ${item.name}` : assetId;
}
function findCatalogAsset(input: { ticker?: string | null; isin?: string | null; name?: string | null }) {
  const ticker = String(input.ticker ?? '').trim().toUpperCase();
  const isin = String(input.isin ?? '').trim().toUpperCase();
  const name = String(input.name ?? '').trim().toLowerCase();
  return EUR_PORTFOLIO_DISCOVERY_UNIVERSE.find(asset =>
    (ticker && asset.ticker.toUpperCase() === ticker)
    || (isin && String(asset.isin ?? '').toUpperCase() === isin)
    || (name && asset.name.trim().toLowerCase() === name)
  ) ?? null;
}

export const ReplayInitialPortfolioControls: React.FC<Props> = ({ value, disabled = false, onChange }) => {
  const [assetToAdd, setAssetToAdd] = useState(EUR_PORTFOLIO_DISCOVERY_UNIVERSE[0]?.assetId ?? '');
  const [amountToAdd, setAmountToAdd] = useState('1000');
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const invested = useMemo(() => value.allocations.reduce((sum, row) => sum + Math.max(0, Number(row.amountEur) || 0), 0), [value.allocations]);
  const total = Math.max(0, value.cashEur) + invested;

  const setSource = async (source: DynamicReplayInitialPortfolioSource) => {
    if (source === 'ZERO') {
      setLoadError(null);
      onChange({ ...value, source: 'ZERO', cashEur: 0, allocations: [] });
      return;
    }
    if (source === 'MANUAL') {
      setLoadError(null);
      onChange({ ...value, source: 'MANUAL' });
      return;
    }

    setLoadingCurrent(true);
    setLoadError(null);
    try {
      const portfolio = UserPortfolioService.load();
      const currentScan = await AssetUniverseScanner.scan(
        EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        yearsAgo(3),
        isoDate(new Date()),
        { forceRefresh: false, concurrency: 3, maxSelected: Math.max(12, EUR_PORTFOLIO_DISCOVERY_UNIVERSE.length), minimumBars: 252, maxDataAgeDays: 7 }
      );
      const latestPrice = (assetId: string): number | null => {
        const asset = currentScan.acceptedDataset.assets.find(row => row.assetId === assetId);
        const close = asset?.bars.at(-1)?.close;
        return close != null && close > 0 ? close : null;
      };

      const allocations: DynamicReplayInitialAllocation[] = [];
      const missing: string[] = [];
      for (const holding of portfolio.holdings) {
        const asset = findCatalogAsset({ ticker: holding.ticker });
        if (!asset) { missing.push(holding.ticker); continue; }
        const price = latestPrice(asset.assetId);
        if (!(price != null && price > 0)) { missing.push(holding.ticker); continue; }
        allocations.push({ assetId: asset.assetId, amountEur: Math.max(0, holding.shares) * price });
      }
      for (const fund of portfolio.funds ?? []) {
        const asset = findCatalogAsset({ isin: fund.isin, name: fund.name });
        if (!asset) { missing.push(fund.isin || fund.name); continue; }
        let amount = Number(fund.currentValueEur);
        if (!(amount > 0) && Number(fund.units) > 0) {
          const price = latestPrice(asset.assetId);
          if (price != null) amount = Number(fund.units) * price;
        }
        if (!(amount > 0)) { missing.push(fund.isin || fund.name); continue; }
        allocations.push({ assetId: asset.assetId, amountEur: amount });
      }
      if (missing.length) throw new Error(`No puedo reproducir con valor actual estas posiciones: ${missing.join(', ')}.`);
      onChange({
        source: 'CURRENT_PORTFOLIO',
        simulationMode: value.simulationMode,
        cashEur: Math.max(0, Number(portfolio.cashEur) || 0),
        allocations: normalizeAllocations(allocations)
      });
    } catch (error: any) {
      setLoadError(error?.message || String(error));
    } finally {
      setLoadingCurrent(false);
    }
  };

  const addAsset = () => {
    const amountEur = Math.max(0, Number(amountToAdd) || 0);
    if (!assetToAdd || !(amountEur > 0)) return;
    onChange({ ...value, allocations: normalizeAllocations([...value.allocations, { assetId: assetToAdd, amountEur }]) });
  };

  return <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-950/10 p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div><b className="text-xs text-white">Estado inicial y modo del replay</b><div className="mt-1 text-[9px] text-slate-500">No crea otro motor: define únicamente de qué cartera parte el replay existente y si después actúa Custodia o se mantienen las posiciones sin decisiones.</div></div>
      <div className="text-right text-[9px] text-slate-500">Total definido<br/><b className="text-sm text-violet-200">{value.source === 'ZERO' ? 'Capital general' : `${total.toFixed(2)} €`}</b></div>
    </div>

    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="text-[10px] text-slate-400">Cartera de partida
        <select value={value.source} disabled={disabled || loadingCurrent} onChange={e => void setSource(e.target.value as DynamicReplayInitialPortfolioSource)} className="mt-1 w-full rounded-lg border border-violet-500/30 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60">
          <option value="ZERO">Desde cero · comportamiento actual</option>
          <option value="MANUAL">Definir manualmente</option>
          <option value="CURRENT_PORTFOLIO">Usar mi cartera actual · mismos € y cash</option>
        </select>
      </label>
      <label className="text-[10px] text-slate-400">Motor de simulación
        <select value={value.simulationMode} disabled={disabled} onChange={e => onChange({ ...value, simulationMode: e.target.value as DynamicReplaySimulationMode })} className="mt-1 w-full rounded-lg border border-violet-500/30 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60">
          <option value="CUSTODIA_ENGINE">Motor Custodia · gestionar la cartera</option>
          <option value="HOLD_ONLY">Mantener cartera · sin motor</option>
        </select>
        <span className="mt-1 block text-[8px] text-slate-600">“Mantener” no compra, añade, reduce, sale ni rota; el cash sí sigue remunerándose como en el replay normal.</span>
      </label>
    </div>

    {loadingCurrent && <div className="mt-3 text-[10px] text-violet-200">Valorando la cartera actual con precios REAL…</div>}
    {loadError && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-2 text-[10px] text-rose-100">{loadError}</div>}

    {value.source !== 'ZERO' && <>
      <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_150px_auto] md:items-end">
        <label className="text-[10px] text-slate-400">Cash inicial (€)<input type="number" min="0" step="100" value={value.cashEur} disabled={disabled} onChange={e => onChange({ ...value, cashEur: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"/></label>
        <label className="text-[10px] text-slate-400">Añadir activo<select value={assetToAdd} disabled={disabled} onChange={e => setAssetToAdd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60">{EUR_PORTFOLIO_DISCOVERY_UNIVERSE.map(asset => <option key={asset.assetId} value={asset.assetId}>{asset.ticker} · {asset.name}</option>)}</select></label>
        <label className="text-[10px] text-slate-400">Importe (€)<input type="number" min="0" step="100" value={amountToAdd} disabled={disabled} onChange={e => setAmountToAdd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"/></label>
        <button type="button" disabled={disabled || !assetToAdd || !(Number(amountToAdd) > 0)} onClick={addAsset} className="min-h-10 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[10px] font-bold text-violet-100 disabled:opacity-40">Añadir al replay</button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[640px] text-[10px]"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Activo inicial</th><th className="p-2 text-right">€ al iniciar</th><th className="p-2 text-right">Acción</th></tr></thead><tbody>
          {value.allocations.length === 0 && <tr><td colSpan={3} className="p-3 text-center text-slate-600">Sin posiciones iniciales. Puedes dejar todo en cash o añadir activos.</td></tr>}
          {value.allocations.map(row => <tr key={row.assetId} className="border-t border-slate-800"><td className="p-2 text-slate-300">{catalogueName(row.assetId)}</td><td className="p-2 text-right"><input type="number" min="0" step="100" value={row.amountEur} disabled={disabled} onChange={e => onChange({ ...value, allocations: value.allocations.map(item => item.assetId === row.assetId ? { ...item, amountEur: Math.max(0, Number(e.target.value) || 0) } : item).filter(item => item.amountEur > 0) })} className="w-36 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-white disabled:opacity-60"/></td><td className="p-2 text-right"><button type="button" disabled={disabled} onClick={() => onChange({ ...value, allocations: value.allocations.filter(item => item.assetId !== row.assetId) })} className="rounded border border-rose-500/25 px-2 py-1 text-rose-200 disabled:opacity-40">Quitar</button></td></tr>)}
        </tbody></table>
      </div>
      <div className="mt-2 text-[9px] text-slate-500">Al elegir una fecha histórica se mantienen los euros definidos por posición y se recalculan las unidades con el precio REAL disponible en esa fecha. Después puedes editar, quitar o añadir posiciones antes de calcular.</div>
    </>}
  </div>;
};
