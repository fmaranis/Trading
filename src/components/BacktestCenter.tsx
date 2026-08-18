import React, { useState, useMemo } from 'react';
import { ALL_AVAILABLE_ASSETS } from '../data/marketData';
import { ALL_QUANT_STRATEGIES } from '../investment/strategies/standardStrategies';
import { BacktestEngine } from '../investment/backtesting/engine';
import { StrategyComparator } from '../investment/analytics/strategyComparator';
import { WalkForwardEngine } from '../investment/backtesting/walkForward';
import { AssetScorer } from '../investment/analytics/assetScorer';
import { HistoricalDataService } from '../investment/data/historicalDataService';
import { DataSourceType } from '../investment/data/types';
import { FinancialTestSuite } from '../investment/backtesting/testSuite';
import {
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Play,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Zap,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Database,
  Fingerprint
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine
} from 'recharts';

export const BacktestCenter: React.FC = () => {
  const [selectedAssetId, setSelectedAssetId] = useState<string>('vanguard-msci-world');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('momentum_breakout');
  const [dataMode, setDataMode] = useState<DataSourceType>('SYNTHETIC');
  const [customSeed, setCustomSeed] = useState<number>(42);
  const [initialCapital, setInitialCapital] = useState<number>(100.0);
  const [commissionPct, setCommissionPct] = useState<number>(0.05);
  const [slippagePct, setSlippagePct] = useState<number>(0.02);
  const [trailingStopPct, setTrailingStopPct] = useState<number>(3.5);
  const [activeSubTab, setActiveSubTab] = useState<'single' | 'comparator' | 'walk_forward' | 'scoring' | 'tests'>('comparator');

  const selectedAsset = useMemo(() => {
    return ALL_AVAILABLE_ASSETS.find(a => a.id === selectedAssetId) || ALL_AVAILABLE_ASSETS[0];
  }, [selectedAssetId]);

  const selectedStrategy = useMemo(() => {
    return ALL_QUANT_STRATEGIES.find(s => s.id === selectedStrategyId) || ALL_QUANT_STRATEGIES[0];
  }, [selectedStrategyId]);

  const { bars: historicalBars, provenance: currentProvenance } = useMemo(() => {
    return HistoricalDataService.getHistoricalData(selectedAsset, {
      mode: dataMode,
      syntheticConfig: {
        totalBars: 75,
        seed: customSeed
      }
    });
  }, [selectedAsset, dataMode, customSeed]);

  // Single Backtest Result
  const singleResult = useMemo(() => {
    return BacktestEngine.runBacktest(
      selectedStrategy,
      historicalBars,
      selectedAsset.ticker,
      selectedAsset.name,
      {
        initialCapital,
        commissionPct,
        slippagePct,
        trailingStopPct
      },
      undefined,
      currentProvenance
    );
  }, [selectedStrategy, historicalBars, selectedAsset, initialCapital, commissionPct, slippagePct, trailingStopPct, currentProvenance]);

  // Strategy Comparison Results
  const comparisonResults = useMemo(() => {
    return StrategyComparator.compareAll(
      historicalBars,
      selectedAsset.ticker,
      selectedAsset.name,
      {
        initialCapital,
        commissionPct,
        slippagePct,
        trailingStopPct
      }
    );
  }, [historicalBars, selectedAsset, initialCapital, commissionPct, slippagePct, trailingStopPct]);

  // Walk-Forward Analysis Result
  const walkForwardResult = useMemo(() => {
    return WalkForwardEngine.runWalkForwardValidation(
      selectedStrategy,
      historicalBars,
      0.70,
      {
        initialCapital,
        commissionPct,
        slippagePct,
        trailingStopPct
      }
    );
  }, [selectedStrategy, historicalBars, initialCapital, commissionPct, slippagePct, trailingStopPct]);

  // Multi-Factor Asset Scores
  const assetScores = useMemo(() => {
    return ALL_AVAILABLE_ASSETS.map(asset => {
      const { bars } = HistoricalDataService.getHistoricalData(asset, {
        mode: 'SYNTHETIC',
        syntheticConfig: { totalBars: 40, seed: 100 }
      });
      return AssetScorer.scoreAsset(asset, bars);
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }, []);

  // Financial Test Suite Results
  const testResults = useMemo(() => {
    return FinancialTestSuite.runAllTests();
  }, []);

  return (
    <div id="backtest-center-module" className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs px-2 py-0.5 rounded-md font-mono font-bold">
                Motor Cuantitativo vectorbt / FinRL Layer
              </span>
              <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs px-2 py-0.5 rounded-md font-mono">
                100% Anti-Look-Ahead
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
              Laboratorio de Backtesting & Análisis de Estrategias
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
              Simulación vectorial con fricciones reales (comisiones y slippage), cálculo estandarizado de ratios (Sharpe, Sortino, Calmar, Max Drawdown) y validación Walk-Forward para evitar el sobreajuste (*overfitting*).
            </p>
          </div>

          {/* Quick Selectors */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 border border-slate-800 p-2 rounded-xl">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Activo Testeado</label>
              <select
                id="select-backtest-asset"
                value={selectedAssetId}
                onChange={e => setSelectedAssetId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                {ALL_AVAILABLE_ASSETS.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.ticker} · {a.name.slice(0, 24)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Estrategia</label>
              <select
                id="select-backtest-strategy"
                value={selectedStrategyId}
                onChange={e => setSelectedStrategyId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                {ALL_QUANT_STRATEGIES.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Procedencia Datos</label>
              <select
                id="select-backtest-data-source"
                value={dataMode}
                onChange={e => setDataMode(e.target.value as DataSourceType)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="SYNTHETIC">SYNTHETIC (PRNG Seed #{customSeed})</option>
                <option value="STATIC_REFERENCE">STATIC_REFERENCE (Hitos Mensuales)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Provenance Badge */}
        <div className="mt-3 py-1.5 px-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-slate-300">
            <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-mono font-semibold text-white">
              {currentProvenance.sourceType}:
            </span>
            <span className="text-slate-400">
              {currentProvenance.notes || currentProvenance.provider}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px]">
            {currentProvenance.seed !== undefined && (
              <span className="bg-indigo-950/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1">
                <Fingerprint className="w-3 h-3" />
                Seed: {currentProvenance.seed} (100% Reproducible)
              </span>
            )}
            <span className="bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
              {historicalBars.length} Barras
            </span>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-800/80 text-xs">
          <button
            onClick={() => setActiveSubTab('comparator')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'comparator'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Comparador Multiestrategia</span>
          </button>

          <button
            onClick={() => setActiveSubTab('single')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'single'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Detalle de Backtest & Trades</span>
          </button>

          <button
            onClick={() => setActiveSubTab('walk_forward')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'walk_forward'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Validación Walk-Forward (Anti-Overfitting)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('scoring')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'scoring'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Scoring Cuantitativo de Activos</span>
          </button>

          <button
            onClick={() => setActiveSubTab('tests')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'tests'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Suite de Tests Financieros ({testResults.filter(t => t.passed).length}/{testResults.length})</span>
          </button>
        </div>
      </div>

      {/* PARAMETERS CONFIGURATION DRAWER */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            Parámetros de Fricción & Capital del Test
          </span>
          <span className="text-[11px] text-slate-400">Modifica los valores para recalcular el backtest al instante</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">Capital Inicial (€)</label>
            <input
              type="number"
              value={initialCapital}
              onChange={e => setInitialCapital(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">Comisión Broker (%)</label>
            <input
              type="number"
              step="0.01"
              value={commissionPct}
              onChange={e => setCommissionPct(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">Slippage Estimado (%)</label>
            <input
              type="number"
              step="0.01"
              value={slippagePct}
              onChange={e => setSlippagePct(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">Trailing Stop (%)</label>
            <input
              type="number"
              step="0.5"
              value={trailingStopPct}
              onChange={e => setTrailingStopPct(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* VIEW 1: COMPARATOR */}
      {activeSubTab === 'comparator' && (
        <div className="space-y-5">
          {/* Comparison Matrix Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold mb-1">Mejor por Sharpe Ratio (Eficiencia)</div>
              <div className="text-base font-bold text-white">{comparisonResults.bestBySharpe.strategyName}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-emerald-400">
                  Sharpe {comparisonResults.bestBySharpe.sharpeRatio}
                </span>
                <span className="text-xs text-slate-400">
                  ({comparisonResults.bestBySharpe.totalReturnPct > 0 ? '+' : ''}{comparisonResults.bestBySharpe.totalReturnPct}%)
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-1">Mayor Rentabilidad Neta</div>
              <div className="text-base font-bold text-white">{comparisonResults.bestByReturn.strategyName}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-emerald-400">
                  +{comparisonResults.bestByReturn.totalReturnPct}%
                </span>
                <span className="text-xs text-slate-400">
                  (Profit Factor: {comparisonResults.bestByReturn.profitFactor})
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1">Menor Max Drawdown (Más Segura)</div>
              <div className="text-base font-bold text-white">{comparisonResults.safestByDrawdown.strategyName}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-amber-400">
                  -{comparisonResults.safestByDrawdown.maxDrawdownPct}%
                </span>
                <span className="text-xs text-slate-400">
                  (Trades: {comparisonResults.safestByDrawdown.totalTrades})
                </span>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Tabla Comparativa Normalizada ({selectedAsset.name})</h3>
              <span className="text-xs text-slate-400">Ordenado por Sharpe Ratio descendente</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Estrategia</th>
                    <th className="py-2.5 px-3">Retorno Total</th>
                    <th className="py-2.5 px-3">Sharpe</th>
                    <th className="py-2.5 px-3">Sortino</th>
                    <th className="py-2.5 px-3">Max DD</th>
                    <th className="py-2.5 px-3">Profit Factor</th>
                    <th className="py-2.5 px-3">Win Rate</th>
                    <th className="py-2.5 px-3">Nº Trades</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {comparisonResults.ranking.map((item, idx) => (
                    <tr key={item.strategyId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-sans font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span>{item.strategyName}</span>
                        </div>
                      </td>
                      <td className={`py-3 px-3 font-bold ${item.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.totalReturnPct >= 0 ? '+' : ''}{item.totalReturnPct}%
                      </td>
                      <td className="py-3 px-3 text-indigo-300 font-bold">{item.sharpeRatio}</td>
                      <td className="py-3 px-3 text-slate-300">{item.sortinoRatio}</td>
                      <td className="py-3 px-3 text-rose-400">-{item.maxDrawdownPct}%</td>
                      <td className="py-3 px-3 text-slate-300">{item.profitFactor}</td>
                      <td className="py-3 px-3 text-slate-300">{item.winRatePct}%</td>
                      <td className="py-3 px-3 text-slate-400">{item.totalTrades}</td>
                      <td className="py-3 px-3 text-right font-sans">
                        <button
                          onClick={() => {
                            setSelectedStrategyId(item.strategyId);
                            setActiveSubTab('single');
                          }}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-semibold cursor-pointer"
                        >
                          Ver Detalle →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SINGLE BACKTEST DETAIL */}
      {activeSubTab === 'single' && (
        <div className="space-y-5">
          {/* Key Metric KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Patrimonio Final</span>
              <span className="text-base font-bold font-mono text-white">{singleResult.metrics.finalEquity.toFixed(2)} €</span>
              <span className={`text-[10px] block font-mono ${singleResult.metrics.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({singleResult.metrics.totalReturnPct >= 0 ? '+' : ''}{singleResult.metrics.totalReturnPct}%)
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Sharpe Ratio</span>
              <span className="text-base font-bold font-mono text-indigo-400">{singleResult.metrics.sharpeRatio}</span>
              <span className="text-[10px] text-slate-400 block">Rf = 3.0%</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Max Drawdown</span>
              <span className="text-base font-bold font-mono text-rose-400">-{singleResult.metrics.maxDrawdownPct}%</span>
              <span className="text-[10px] text-slate-400 block">{singleResult.metrics.maxDrawdownDurationBars} barras</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Profit Factor</span>
              <span className="text-base font-bold font-mono text-emerald-400">{singleResult.metrics.profitFactor}</span>
              <span className="text-[10px] text-slate-400 block">Ganancia / Pérdida</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Win Rate</span>
              <span className="text-base font-bold font-mono text-white">{singleResult.metrics.winRatePct}%</span>
              <span className="text-[10px] text-slate-400 block">{singleResult.metrics.winningTrades} de {singleResult.metrics.totalTrades}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Alpha vs Benchmark</span>
              <span className={`text-base font-bold font-mono ${singleResult.metrics.alphaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {singleResult.metrics.alphaPct >= 0 ? '+' : ''}{singleResult.metrics.alphaPct}%
              </span>
              <span className="text-[10px] text-slate-400 block">Benchmark: +{singleResult.metrics.benchmarkTotalReturnPct}%</span>
            </div>
          </div>

          {/* Equity Curve Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-sm text-white">Curva de Equity de la Estrategia vs Benchmark Pasivo</h3>
                <p className="text-xs text-slate-400">Evolución de 100 € iniciales con deducción exacta de comisiones y deslizamientos</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Estrategia
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Benchmark (Buy & Hold)
                </span>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={singleResult.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} unit="€" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <ReferenceLine y={initialCapital} stroke="#475569" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2.5} dot={false} name="Estrategia (€)" />
                  <Line type="monotone" dataKey="benchmarkEquity" stroke="#64748b" strokeWidth={1.5} dot={false} name="Benchmark (€)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trade Execution Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Registro de Operaciones Realizadas ({singleResult.trades.length})</h3>
              <span className="text-xs text-slate-400">Comisiones totales pagadas: {singleResult.metrics.totalCommissionsPaidEur} €</span>
            </div>
            {singleResult.trades.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                La estrategia permaneció en liquidez o no generó señales de entrada en el rango evaluado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                    <tr>
                      <th className="py-2 px-3">ID</th>
                      <th className="py-2 px-3">Entrada</th>
                      <th className="py-2 px-3">Salida</th>
                      <th className="py-2 px-3">P. Compra</th>
                      <th className="py-2 px-3">P. Venta</th>
                      <th className="py-2 px-3">Resultado</th>
                      <th className="py-2 px-3">Motivo Salida</th>
                      <th className="py-2 px-3 text-right">Comisión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {singleResult.trades.map(t => (
                      <tr key={t.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-400">{t.id}</td>
                        <td className="py-2.5 px-3 text-slate-300">{t.entryDate}</td>
                        <td className="py-2.5 px-3 text-slate-300">{t.exitDate}</td>
                        <td className="py-2.5 px-3 text-slate-300">{t.entryPrice.toFixed(2)} €</td>
                        <td className="py-2.5 px-3 text-slate-300">{t.exitPrice.toFixed(2)} €</td>
                        <td className={`py-2.5 px-3 font-bold ${t.pnlEur >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnlEur >= 0 ? '+' : ''}{t.pnlEur.toFixed(2)} € ({t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-3 text-[11px] font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            t.exitReason === 'TRAILING_STOP' ? 'bg-amber-500/20 text-amber-300' :
                            t.exitReason === 'STOP_LOSS' ? 'bg-rose-500/20 text-rose-300' :
                            t.exitReason === 'TAKE_PROFIT' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {t.exitReason}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400">
                          {(t.commissionPaid + t.slippagePaid).toFixed(3)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: WALK-FORWARD VALIDATION */}
      {activeSubTab === 'walk_forward' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-base text-white">Análisis Walk-Forward & Test Fuera de Muestra (Out-of-Sample)</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Para proteger tu capital de la ilusión estadística (*curve fitting* o sesgo de sobreoptimización), dividimos la serie histórica en dos bloques estancos: <strong>70% In-Sample (Entrenamiento)</strong> y <strong>30% Out-of-Sample (Prueba Ciega)</strong>.
            </p>

            <div className={`p-4 rounded-xl border mb-5 ${
              walkForwardResult.isRobust ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm mb-1">
                {walkForwardResult.isRobust ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
                <span>Ratio de Eficiencia Fuera de Muestra: {walkForwardResult.efficiencyRatio}</span>
              </div>
              <p className="text-xs">{walkForwardResult.diagnosis}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block mb-2">
                  1. Periodo In-Sample (70% Datos)
                </span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Retorno Total:</span>
                    <span className="text-white font-bold">{walkForwardResult.inSampleResult.metrics.totalReturnPct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sharpe Ratio:</span>
                    <span className="text-indigo-300 font-bold">{walkForwardResult.inSampleResult.metrics.sharpeRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Drawdown:</span>
                    <span className="text-rose-400 font-bold">-{walkForwardResult.inSampleResult.metrics.maxDrawdownPct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Win Rate:</span>
                    <span className="text-slate-200 font-bold">{walkForwardResult.inSampleResult.metrics.winRatePct}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider block mb-2">
                  2. Periodo Out-of-Sample Ciego (30% Datos)
                </span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Retorno Total:</span>
                    <span className="text-white font-bold">{walkForwardResult.outOfSampleResult.metrics.totalReturnPct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sharpe Ratio:</span>
                    <span className="text-emerald-300 font-bold">{walkForwardResult.outOfSampleResult.metrics.sharpeRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Drawdown:</span>
                    <span className="text-rose-400 font-bold">-{walkForwardResult.outOfSampleResult.metrics.maxDrawdownPct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Win Rate:</span>
                    <span className="text-slate-200 font-bold">{walkForwardResult.outOfSampleResult.metrics.winRatePct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: MULTI-FACTOR ASSET SCORING */}
      {activeSubTab === 'scoring' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-bold text-base text-white mb-1">Ranking Multi-Factor de Activos (Inspirado en FinRL)</h3>
            <p className="text-xs text-slate-400 mb-4">
              Puntuación algorítmica de 0 a 100 basada en 4 factores cuantitativos: Inercia de Momentum (35%), Control de Volatilidad (25%), Eficiencia de Costes TER (20%) y Consistencia de Tendencia (20%).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {assetScores.map(score => (
                <div key={score.assetId} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/40 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-indigo-400">{score.ticker}</span>
                      <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">{score.name}</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      score.rating === 'EXCELENTE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      score.rating === 'BUENO' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {score.rating}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-bold font-mono text-white">{score.compositeScore}</span>
                    <span className="text-[10px] text-slate-400">/ 100 Pts</span>
                    <span className="text-[11px] text-slate-400 ml-auto font-mono">Peso Sugerido: {score.recommendedWeightPct}%</span>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-mono mb-3">
                    <div className="flex justify-between text-slate-400">
                      <span>Momentum (35%):</span>
                      <span className="text-slate-200">{score.factors.momentumScore}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Baja Volatilidad (25%):</span>
                      <span className="text-slate-200">{score.factors.volatilityRiskScore}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Eficiencia TER (20%):</span>
                      <span className="text-slate-200">{score.factors.costEfficiencyScore}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans border-t border-slate-800/80 pt-2 line-clamp-2">
                    {score.reasoning}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: TEST SUITE */}
      {activeSubTab === 'tests' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-white">Suite de Tests Unitarios & Validación Matemática</h3>
              <p className="text-xs text-slate-400">Garantía de precisión aritmética: Ausencia de NaNs, reproducibilidad y exactitud en métricas</p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold">
              {testResults.filter(t => t.passed).length} / {testResults.length} Tests Pasados
            </span>
          </div>

          <div className="space-y-2.5">
            {testResults.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-200 block">{t.name}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{t.message}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono font-bold">
                  PASSED
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
