import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ALL_AVAILABLE_ASSETS } from '../data/marketData';
import { ALL_QUANT_STRATEGIES } from '../investment/strategies/standardStrategies';
import { BacktestEngine } from '../investment/backtesting/engine';
import { StrategyComparator } from '../investment/analytics/strategyComparator';
import { WalkForwardEngine } from '../investment/backtesting/walkForward';
import { AssetScorer } from '../investment/analytics/assetScorer';
import { HistoricalDataService } from '../investment/data/historicalDataService';
import { DataSourceType, HistoricalDataResponse } from '../investment/data/types';
import { ExecutionMode, OptimizationMetric, ParameterRange } from '../investment/backtesting/types';
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
  Fingerprint,
  RefreshCw,
  GitBranch,
  Target,
  Globe,
  Loader2
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
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('NEXT_OPEN');
  const [customSeed, setCustomSeed] = useState<number>(42);
  const [initialCapital, setInitialCapital] = useState<number>(100.0);
  const [commissionPct, setCommissionPct] = useState<number>(0.05);
  const [slippagePct, setSlippagePct] = useState<number>(0.02);
  const [trailingStopPct, setTrailingStopPct] = useState<number>(3.5);
  const [activeSubTab, setActiveSubTab] = useState<'single' | 'comparator' | 'walk_forward' | 'scoring' | 'tests'>('comparator');

  // Asynchronous Data Loading State (Step 6)
  const [dataLoadStatus, setDataLoadStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [loadedDataset, setLoadedDataset] = useState<HistoricalDataResponse | null>(null);
  const [forceRefreshCount, setForceRefreshCount] = useState<number>(0);
  const reqCounterRef = useRef<number>(0);

  // Walk-Forward Optimization & Validation State
  const [wfValidationMode, setWfValidationMode] = useState<'wfo' | 'holdout'>('wfo');
  const [wfoTrainBars, setWfoTrainBars] = useState<number>(35);
  const [wfoTestBars, setWfoTestBars] = useState<number>(15);
  const [wfoStepBars, setWfoStepBars] = useState<number>(15);
  const [wfoMetric, setWfoMetric] = useState<OptimizationMetric>('SHARPE');
  const [wfoExpanding, setWfoExpanding] = useState<boolean>(false);
  const [wfoMinTrades, setWfoMinTrades] = useState<number>(0);

  const selectedAsset = useMemo(() => {
    return ALL_AVAILABLE_ASSETS.find(a => a.id === selectedAssetId) || ALL_AVAILABLE_ASSETS[0];
  }, [selectedAssetId]);

  const selectedStrategy = useMemo(() => {
    return ALL_QUANT_STRATEGIES.find(s => s.id === selectedStrategyId) || ALL_QUANT_STRATEGIES[0];
  }, [selectedStrategyId]);

  // Strategy default parameter grids for WFO
  const strategyParameterGrid = useMemo<ParameterRange[]>(() => {
    switch (selectedStrategyId) {
      case 'ema_cross':
        return [
          { name: 'fastPeriod', values: [5, 10, 15] },
          { name: 'slowPeriod', values: [20, 30, 40] }
        ];
      case 'rsi_mean_reversion':
        return [
          { name: 'oversold', values: [25, 30, 35] },
          { name: 'overbought', values: [65, 70, 75] }
        ];
      case 'bollinger_mean_reversion':
        return [
          { name: 'period', values: [15, 20, 25] },
          { name: 'stdDevMultiplier', values: [1.8, 2.0, 2.2] }
        ];
      case 'momentum_breakout':
        return [
          { name: 'lookbackPeriod', values: [10, 15, 20, 30] }
        ];
      default:
        return [
          { name: 'stopLossPct', values: [2, 4, 6] }
        ];
    }
  }, [selectedStrategyId]);

  // Asynchronous fetch with Stale Request Protection & Zero Synthetic Fallback
  useEffect(() => {
    const currentRequestId = ++reqCounterRef.current;

    if (dataMode === 'SYNTHETIC' || dataMode === 'STATIC_REFERENCE') {
      try {
        const syncRes = HistoricalDataService.getHistoricalDataSync(selectedAsset, {
          mode: dataMode,
          syntheticConfig: {
            totalBars: 75,
            seed: customSeed
          }
        });
        if (reqCounterRef.current === currentRequestId) {
          setLoadedDataset(syncRes);
          setDataLoadStatus('SUCCESS');
          setDataLoadError(null);
        }
      } catch (err: any) {
        if (reqCounterRef.current === currentRequestId) {
          setDataLoadError(err.message || 'Error al generar cotizaciones locales.');
          setDataLoadStatus('ERROR');
        }
      }
    } else {
      // REAL mode
      setDataLoadStatus('LOADING');
      setDataLoadError(null);

      HistoricalDataService.getHistoricalData(selectedAsset, {
        mode: 'REAL',
        forceRefresh: forceRefreshCount > 0
      })
        .then(res => {
          if (reqCounterRef.current === currentRequestId) {
            setLoadedDataset(res);
            setDataLoadStatus('SUCCESS');
            setDataLoadError(null);
          }
        })
        .catch(err => {
          if (reqCounterRef.current === currentRequestId) {
            setDataLoadError(err.message || 'Error al descargar datos de mercado reales del servidor.');
            setDataLoadStatus('ERROR');
          }
        });
    }
  }, [selectedAsset, dataMode, customSeed, forceRefreshCount]);

  // Fallback initial dataset (only if not loaded yet)
  const defaultSyntheticFallback = useMemo(() => {
    return HistoricalDataService.getHistoricalDataSync(selectedAsset, {
      mode: 'SYNTHETIC',
      syntheticConfig: { totalBars: 75, seed: customSeed }
    });
  }, [selectedAsset, customSeed]);

  const historicalBars = loadedDataset?.bars || defaultSyntheticFallback.bars;
  const currentProvenance = loadedDataset?.provenance || defaultSyntheticFallback.provenance;
  const currentMetadata = loadedDataset?.metadata;

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
        trailingStopPct,
        executionMode
      },
      undefined,
      currentProvenance
    );
  }, [selectedStrategy, historicalBars, selectedAsset, initialCapital, commissionPct, slippagePct, trailingStopPct, executionMode, currentProvenance]);

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
        trailingStopPct,
        executionMode
      },
      undefined,
      currentProvenance
    );
  }, [historicalBars, selectedAsset, initialCapital, commissionPct, slippagePct, trailingStopPct, executionMode, currentProvenance]);

  // Holdout Validation (70/30 In-Sample vs Out-of-Sample Split)
  const holdoutResult = useMemo(() => {
    try {
      return WalkForwardEngine.runHoldoutValidation(
        selectedStrategy,
        historicalBars,
        0.70,
        {
          initialCapital,
          commissionPct,
          slippagePct,
          trailingStopPct,
          executionMode
        }
      );
    } catch {
      return null;
    }
  }, [selectedStrategy, historicalBars, initialCapital, commissionPct, slippagePct, trailingStopPct, executionMode]);

  // Quantitative Walk-Forward Optimization (Rolling/Expanding Windows)
  const wfoResult = useMemo(() => {
    try {
      return WalkForwardEngine.runWalkForwardOptimization(
        selectedStrategy,
        historicalBars,
        {
          trainWindowBars: wfoTrainBars,
          testWindowBars: wfoTestBars,
          stepBars: wfoStepBars,
          optimizationMetric: wfoMetric,
          minimumTrades: wfoMinTrades,
          parameterGrid: strategyParameterGrid,
          isExpandingWindow: wfoExpanding
        },
        {
          initialCapital,
          commissionPct,
          slippagePct,
          trailingStopPct,
          executionMode
        }
      );
    } catch {
      return null;
    }
  }, [
    selectedStrategy,
    historicalBars,
    wfoTrainBars,
    wfoTestBars,
    wfoStepBars,
    wfoMetric,
    wfoMinTrades,
    strategyParameterGrid,
    wfoExpanding,
    initialCapital,
    commissionPct,
    slippagePct,
    trailingStopPct,
    executionMode
  ]);

  // Multi-Factor Asset Scores
  const assetScores = useMemo(() => {
    return ALL_AVAILABLE_ASSETS.map(asset => {
      const { bars } = HistoricalDataService.getHistoricalDataSync(asset, {
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

  // Format helpers for nullable financial metrics
  const formatNum = (val: number | null | undefined, digits: number = 2): string => {
    if (val === null || val === undefined || isNaN(val)) return 'N/D';
    return val.toFixed(digits);
  };

  const formatPct = (val: number | null | undefined, digits: number = 2, showSign: boolean = true): string => {
    if (val === null || val === undefined || isNaN(val)) return 'N/D';
    const sign = showSign && val > 0 ? '+' : '';
    return `${sign}${val.toFixed(digits)}%`;
  };

  return (
    <div id="backtest-center-module" className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs px-2 py-0.5 rounded-md font-mono font-bold">
                Motor Cuantitativo TypeScript
              </span>
              <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs px-2 py-0.5 rounded-md font-mono">
                Backtesting experimental
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
                <option value="REAL">REAL (Datos Históricos Reales · Yahoo Finance)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Modo de Ejecución</label>
              <select
                id="select-backtest-execution-mode"
                value={executionMode}
                onChange={e => setExecutionMode(e.target.value as ExecutionMode)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="NEXT_OPEN">NEXT_OPEN · Señal Close(t) → Fill Open(t+1)</option>
                <option value="SAME_CLOSE">SAME_CLOSE (Experimental · Mismo Close)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Provenance & Execution Mode Badge */}
        <div className="mt-3 py-2 px-3.5 bg-slate-950/90 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            {currentProvenance.sourceType === 'REAL' ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px] flex items-center gap-1">
                <Globe className="w-3 h-3 text-emerald-400" />
                REAL
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-[11px] flex items-center gap-1">
                <Database className="w-3 h-3 text-indigo-400" />
                {currentProvenance.sourceType}
              </span>
            )}
            <span className="font-semibold text-white">
              {currentProvenance.provider || 'Proveedor Externo'}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {currentProvenance.symbol ? `· Símbolo: ${currentProvenance.symbol}` : (currentProvenance.notes ? `· ${currentProvenance.notes}` : '')}
            </span>
            {currentMetadata?.adjustmentStatus && (
              <span className="text-emerald-400/90 text-[10px] bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Ajustado (Splits/Dividendos)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px]">
            <span className={`px-2 py-0.5 rounded border ${
              executionMode === 'NEXT_OPEN'
                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/30'
            }`}>
              Modo: {executionMode === 'NEXT_OPEN' ? 'NEXT_OPEN' : 'SAME_CLOSE'}
            </span>
            {currentMetadata?.cached !== undefined && (
              <span className={`px-2 py-0.5 rounded border ${
                currentMetadata.cached
                  ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
              }`}>
                {currentMetadata.cached ? 'Caché: Sí (Memoria)' : 'Descargado: En vivo'}
              </span>
            )}
            {currentProvenance.seed !== undefined && (
              <span className="bg-indigo-950/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1">
                <Fingerprint className="w-3 h-3" />
                Seed: #{currentProvenance.seed}
              </span>
            )}
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              {historicalBars.length} Barras
            </span>
            {dataMode === 'REAL' && (
              <button
                onClick={() => setForceRefreshCount(c => c + 1)}
                title="Refrescar cotizaciones del servidor proxy"
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${dataLoadStatus === 'LOADING' ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            )}
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

      {/* ASYNCHRONOUS LOADING AND ERROR OVERLAYS FOR DATA FETCHING */}
      {activeSubTab !== 'tests' && dataLoadStatus === 'LOADING' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 text-center space-y-4 shadow-xl">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-950/70 border border-indigo-500/30 text-indigo-400">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Descargando Cotizaciones Históricas Reales...</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Consultando servidor proxy seguro para <strong>{selectedAsset.name}</strong> ({selectedAsset.ticker}).
              Validando orden cronológico ascendente, ausencia de duplicados e integridad OHLC.
            </p>
          </div>
          <div className="text-[11px] font-mono text-indigo-300/80 bg-indigo-950/40 py-1.5 px-3 rounded-lg inline-block border border-indigo-500/20">
            Estado: Asíncrono · Validando Dataset antes de ejecutar el Backtest
          </div>
        </div>
      )}

      {activeSubTab !== 'tests' && dataLoadStatus === 'ERROR' && (
        <div className="bg-rose-950/20 border border-rose-500/40 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl text-left">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Fallo en la Descarga de Datos de Mercado Reales
                </h3>
                <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">
                  PROHIBIDO FALLBACK SINTÉTICO
                </span>
              </div>
              <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed font-mono">
                {dataLoadError}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                El sistema prohíbe sustituir silenciosamente datos reales por simulaciones para garantizar que cualquier análisis cuantitativo se base exclusivamente en cotizaciones verificadas.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-rose-500/20 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setForceRefreshCount(c => c + 1)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar Conexión</span>
            </button>
            <button
              onClick={() => setDataMode('SYNTHETIC')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer border border-slate-700"
            >
              <span>Cambiar a Datos Sintéticos (Simulación PRNG)</span>
            </button>
          </div>
        </div>
      )}

      {/* PARAMETERS CONFIGURATION DRAWER */}
      {activeSubTab !== 'tests' && dataLoadStatus === 'SUCCESS' && (
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
      )}

      {/* VIEW 1: COMPARATOR */}
      {activeSubTab === 'comparator' && dataLoadStatus === 'SUCCESS' && (
        <div className="space-y-5">
          {/* Comparison Matrix Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold mb-1">Mejor por Sharpe Ratio (Eficiencia)</div>
              <div className="text-base font-bold text-white">{comparisonResults.bestBySharpe.strategyName}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-emerald-400">
                  Sharpe {formatNum(comparisonResults.bestBySharpe.sharpeRatio)}
                </span>
                <span className="text-xs text-slate-400">
                  ({formatPct(comparisonResults.bestBySharpe.totalReturnPct)})
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-1">Mayor Rentabilidad Neta</div>
              <div className="text-base font-bold text-white">{comparisonResults.bestByReturn.strategyName}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {formatPct(comparisonResults.bestByReturn.totalReturnPct)}
                </span>
                <span className="text-xs text-slate-400">
                  (Profit Factor: {formatNum(comparisonResults.bestByReturn.profitFactor)})
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1">Menor Max Drawdown (Más Segura)</div>
              <div className="text-base font-bold text-white">{comparisonResults.safestByDrawdown.strategyName}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-amber-400">
                  -{formatNum(comparisonResults.safestByDrawdown.maxDrawdownPct)}%
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
                    <th className="py-2.5 px-3">CAGR</th>
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
                        {formatPct(item.totalReturnPct)}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{formatPct(item.annualizedReturnPct)}</td>
                      <td className="py-3 px-3 text-indigo-300 font-bold">{formatNum(item.sharpeRatio)}</td>
                      <td className="py-3 px-3 text-slate-300">{formatNum(item.sortinoRatio)}</td>
                      <td className="py-3 px-3 text-rose-400">-{formatNum(item.maxDrawdownPct)}%</td>
                      <td className="py-3 px-3 text-slate-300">{formatNum(item.profitFactor)}</td>
                      <td className="py-3 px-3 text-slate-300">{formatNum(item.winRatePct)}%</td>
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
      {activeSubTab === 'single' && dataLoadStatus === 'SUCCESS' && (
        <div className="space-y-5">
          {/* Quality & Audit Header */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase border ${
                singleResult.metrics.diagnostics.quality === 'FULL'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : singleResult.metrics.diagnostics.quality === 'PARTIAL'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                Calidad: {singleResult.metrics.diagnostics.quality}
              </span>
              <span className="text-slate-400 font-mono">
                Frecuencia: <strong className="text-slate-200">{singleResult.metrics.diagnostics.frequencyDetected}</strong>
                {singleResult.metrics.diagnostics.periodsPerYearUsed ? ` (${singleResult.metrics.diagnostics.periodsPerYearUsed} periodos/año)` : ''}
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
              <span>Rf: <strong className="text-slate-200">3.0% anual</strong></span>
              <span>Costes Fricción: <strong className="text-amber-300">{formatNum(singleResult.metrics.totalTradingCostsEur)} € ({formatNum(singleResult.metrics.tradingCostsPctOfInitialCapital)}% cap)</strong></span>
            </div>
          </div>

          {/* Key Metric KPI grid (8 cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Patrimonio Final</span>
              <span className="text-base font-bold font-mono text-white">{formatNum(singleResult.metrics.finalEquity)} €</span>
              <span className={`text-[10px] block font-mono ${singleResult.metrics.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPct(singleResult.metrics.totalReturnPct)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">CAGR Anualizado</span>
              <span className={`text-base font-bold font-mono ${singleResult.metrics.cagrPct !== null && singleResult.metrics.cagrPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPct(singleResult.metrics.cagrPct)}
              </span>
              <span className="text-[10px] text-slate-400 block">Tiempo real</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Sharpe Ratio</span>
              <span className="text-base font-bold font-mono text-indigo-400">{formatNum(singleResult.metrics.sharpeRatio)}</span>
              <span className="text-[10px] text-slate-400 block">Vol: {formatPct(singleResult.metrics.annualizedVolatilityPct, 1, false)}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Sortino Ratio</span>
              <span className="text-base font-bold font-mono text-indigo-300">{formatNum(singleResult.metrics.sortinoRatio)}</span>
              <span className="text-[10px] text-slate-400 block">MAR = Rf</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Calmar Ratio</span>
              <span className="text-base font-bold font-mono text-cyan-400">{formatNum(singleResult.metrics.calmarRatio)}</span>
              <span className="text-[10px] text-slate-400 block">CAGR / MaxDD</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Max Drawdown</span>
              <span className="text-base font-bold font-mono text-rose-400">-{formatNum(singleResult.metrics.maxDrawdownPct)}%</span>
              <span className="text-[10px] text-slate-400 block">{singleResult.metrics.maxDrawdownDurationBars} barras {singleResult.metrics.maxDrawdownDurationDays ? `(${singleResult.metrics.maxDrawdownDurationDays}d)` : ''}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Jensen Alpha / Beta</span>
              <span className={`text-base font-bold font-mono ${singleResult.metrics.alphaAnnualizedPct !== null && singleResult.metrics.alphaAnnualizedPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPct(singleResult.metrics.alphaAnnualizedPct)}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">Beta: {formatNum(singleResult.metrics.beta)} (R²: {formatNum(singleResult.metrics.rSquared)})</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] uppercase text-slate-400 block">Profit Factor / Exp.</span>
              <span className="text-base font-bold font-mono text-emerald-400">{formatNum(singleResult.metrics.profitFactor)}</span>
              <span className="text-[10px] text-slate-400 block">Exp: {formatNum(singleResult.metrics.expectancyEur)} €/op</span>
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
                      <th className="py-2 px-3">Señal Compra (t)</th>
                      <th className="py-2 px-3">Ejecución Compra (t+1)</th>
                      <th className="py-2 px-3">Señal Venta</th>
                      <th className="py-2 px-3">Ejecución Venta</th>
                      <th className="py-2 px-3">Resultado</th>
                      <th className="py-2 px-3">Motivo Salida</th>
                      <th className="py-2 px-3 text-right">Costes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {singleResult.trades.map(t => (
                      <tr key={t.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-400">{t.id}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-slate-300 block">{t.signalDate || t.entryDate}</span>
                          <span className="text-[10px] text-slate-500 block">Close: {(t.signalPrice ?? t.entryPrice).toFixed(2)} €</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-slate-200 font-semibold block">{t.entryDate}</span>
                          <span className="text-[10px] text-indigo-400 block">Open: {t.entryPrice.toFixed(2)} €</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-slate-300 block">{t.exitSignalDate || t.exitDate}</span>
                          <span className="text-[10px] text-slate-500 block">Close: {(t.exitSignalPrice ?? t.exitPrice).toFixed(2)} €</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-slate-200 font-semibold block">{t.exitDate}</span>
                          <span className="text-[10px] text-indigo-400 block">Open: {t.exitPrice.toFixed(2)} €</span>
                        </td>
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

      {/* VIEW 3: WALK-FORWARD OPTIMIZATION & HOLDOUT VALIDATION */}
      {activeSubTab === 'walk_forward' && dataLoadStatus === 'SUCCESS' && (
        <div className="space-y-6">
          {/* Header & Sub-Mode Switcher */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-base text-white">Validación Cuantitativa & Walk-Forward</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Protección institucional contra sobreajuste (*curve fitting*): optimización estricta en Train con parámetros congelados en Test ciego.
                </p>
              </div>

              {/* Mode Selector */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setWfValidationMode('wfo')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    wfValidationMode === 'wfo'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Walk-Forward Optimization (WFO)
                </button>
                <button
                  onClick={() => setWfValidationMode('holdout')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    wfValidationMode === 'holdout'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Holdout Validation (70/30)
                </button>
              </div>
            </div>

            {/* WFO CONFIGURATION BAR */}
            {wfValidationMode === 'wfo' && (
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                  <Sliders className="w-4 h-4" />
                  <span>Configuración de Ventanas y Rejilla de Optimización</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Train Bars (IS)</label>
                    <input
                      type="number"
                      min={15}
                      max={60}
                      step={5}
                      value={wfoTrainBars}
                      onChange={(e) => setWfoTrainBars(Math.max(15, Number(e.target.value)))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Test Bars (OOS)</label>
                    <input
                      type="number"
                      min={5}
                      max={30}
                      step={5}
                      value={wfoTestBars}
                      onChange={(e) => setWfoTestBars(Math.max(5, Number(e.target.value)))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Paso (Step Bars)</label>
                    <input
                      type="number"
                      min={5}
                      max={30}
                      step={5}
                      value={wfoStepBars}
                      onChange={(e) => setWfoStepBars(Math.max(5, Number(e.target.value)))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Métrica Objetivo</label>
                    <select
                      value={wfoMetric}
                      onChange={(e) => setWfoMetric(e.target.value as OptimizationMetric)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                    >
                      <option value="SHARPE">Sharpe Ratio</option>
                      <option value="SORTINO">Sortino Ratio</option>
                      <option value="CALMAR">Calmar Ratio</option>
                      <option value="TOTAL_RETURN">Retorno Total (%)</option>
                      <option value="MAX_DRAWDOWN_ADJUSTED">Retorno / Max DD</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tipo de Ventana</label>
                    <select
                      value={wfoExpanding ? 'expanding' : 'rolling'}
                      onChange={(e) => setWfoExpanding(e.target.value === 'expanding')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                    >
                      <option value="rolling">Rolling (Deslizante)</option>
                      <option value="expanding">Expanding (Acumulativa)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Min Trades / Ventana</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={wfoMinTrades}
                      onChange={(e) => setWfoMinTrades(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Grid preview badges */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400">Rejilla activa para {selectedStrategy.name}:</span>
                  {strategyParameterGrid.map((p) => (
                    <span key={p.name} className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[10px] border border-slate-700">
                      {p.name}: [{p.values.join(', ')}]
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* WFO RESULTS SECTION */}
            {wfValidationMode === 'wfo' && wfoResult && (
              <div className="space-y-5">
                {/* Robustness Master Card */}
                <div className={`p-4 rounded-xl border ${
                  wfoResult.isRobust
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {wfoResult.isRobust ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold text-sm text-white">Score de Robustez Cuantitativa: </span>
                        <span className="font-mono font-bold text-base text-indigo-300">
                          {wfoResult.robustnessScore !== null ? `${wfoResult.robustnessScore}/100` : 'N/D'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px]">
                        Evidencia: <strong>{wfoResult.validationEvidence}</strong>
                      </span>
                      <span>Backtests: <strong>{wfoResult.executedBacktests}</strong> / {wfoResult.estimatedBacktests}</span>
                      <span>WFE Ratio: <strong className="text-white">{wfoResult.averageEfficiencyRatio !== null ? formatNum(wfoResult.averageEfficiencyRatio) : 'N/D'}</strong></span>
                      <span>Ventanas Ganadoras: <strong className="text-white">{wfoResult.profitableWindowsPct}%</strong> ({wfoResult.windows.filter(w => w.testMetrics && w.testMetrics.totalReturnPct > 0).length}/{wfoResult.windows.length})</span>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed mb-3">{wfoResult.diagnosis}</p>

                  {/* Robustness 4-Component Breakdown (40/25/20/15) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">OOS Sharpe (40%)</span>
                      <strong className="text-indigo-300">{wfoResult.robustnessComponents.oosPerformance ?? 'N/D'} pts</strong>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Degradación WFE (25%)</span>
                      <strong className="text-indigo-300">{wfoResult.robustnessComponents.degradation ?? 'N/D'} pts</strong>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Estabilidad Params (20%)</span>
                      <strong className="text-indigo-300">{wfoResult.robustnessComponents.parameterStability ?? 'N/D'} pts</strong>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Consistencia OOS (15%)</span>
                      <strong className="text-indigo-300">{wfoResult.robustnessComponents.consistency ?? 'N/D'} pts</strong>
                    </div>
                  </div>
                </div>

                {/* Stitched Out-of-Sample KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase text-slate-400 block">Patrimonio OOS</span>
                    <span className="text-base font-bold font-mono text-white">{formatNum(wfoResult.combinedOutOfSampleMetrics.finalEquity)} €</span>
                    <span className={`text-[10px] block font-mono ${wfoResult.combinedOutOfSampleMetrics.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatPct(wfoResult.combinedOutOfSampleMetrics.totalReturnPct)}
                    </span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase text-slate-400 block">CAGR OOS</span>
                    <span className={`text-base font-bold font-mono ${wfoResult.combinedOutOfSampleMetrics.cagrPct !== null && wfoResult.combinedOutOfSampleMetrics.cagrPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatPct(wfoResult.combinedOutOfSampleMetrics.cagrPct)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Tiempo real</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase text-slate-400 block">Sharpe OOS</span>
                    <span className="text-base font-bold font-mono text-indigo-400">{formatNum(wfoResult.combinedOutOfSampleMetrics.sharpeRatio)}</span>
                    <span className="text-[10px] text-slate-400 block">Vol: {formatPct(wfoResult.combinedOutOfSampleMetrics.annualizedVolatilityPct, 1, false)}</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase text-slate-400 block">Sortino OOS</span>
                    <span className="text-base font-bold font-mono text-indigo-300">{formatNum(wfoResult.combinedOutOfSampleMetrics.sortinoRatio)}</span>
                    <span className="text-[10px] text-slate-400 block">MAR = Rf</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase text-slate-400 block">Calmar OOS</span>
                    <span className="text-base font-bold font-mono text-cyan-400">{formatNum(wfoResult.combinedOutOfSampleMetrics.calmarRatio)}</span>
                    <span className="text-[10px] text-slate-400 block">CAGR / MaxDD</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase text-slate-400 block">Max DD OOS</span>
                    <span className="text-base font-bold font-mono text-rose-400">-{formatNum(wfoResult.combinedOutOfSampleMetrics.maxDrawdownPct)}%</span>
                    <span className="text-[10px] text-slate-400 block">{wfoResult.combinedOutOfSampleMetrics.maxDrawdownDurationBars} barras</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase text-slate-400 block">Win Rate OOS</span>
                    <span className="text-base font-bold font-mono text-emerald-400">{formatNum(wfoResult.combinedOutOfSampleMetrics.winRatePct)}%</span>
                    <span className="text-[10px] text-slate-400 block">{wfoResult.combinedOutOfSampleMetrics.winningTrades} / {wfoResult.combinedOutOfSampleMetrics.totalTrades}</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase text-slate-400 block">Costes Fricción</span>
                    <span className="text-base font-bold font-mono text-amber-300">{formatNum(wfoResult.combinedOutOfSampleMetrics.totalTradingCostsEur)} €</span>
                    <span className="text-[10px] text-slate-400 block">{formatNum(wfoResult.combinedOutOfSampleMetrics.tradingCostsPctOfInitialCapital)}% cap</span>
                  </div>
                </div>

                {/* Stitched Out-of-Sample Equity Curve vs Benchmark */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Curva de Equity Fuera de Muestra Encadenada (Stitched OOS Track Record)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Resultados estrictamente fuera de muestra de todas las ventanas concatenadas sin fuga de datos.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-indigo-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span> Estrategia WFO (OOS)
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block"></span> Benchmark
                      </span>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={wfoResult.combinedOutOfSampleEquity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(val: number) => [`${val.toFixed(2)} €`, 'Patrimonio']}
                        />
                        <Line type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2.5} dot={false} name="Estrategia WFO" />
                        <Line type="monotone" dataKey="benchmarkEquity" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Benchmark" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Window-by-Window Execution Table */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Auditoría Ventana por Ventana (Train vs Test OOS)
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">{wfoResult.windows.length} Ventanas Ejecutadas</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-mono">
                        <tr>
                          <th className="py-2 px-3">Ventana</th>
                          <th className="py-2 px-3">Estado</th>
                          <th className="py-2 px-3">Periodo Train</th>
                          <th className="py-2 px-3">Periodo Test OOS</th>
                          <th className="py-2 px-3">Parámetros</th>
                          <th className="py-2 px-3 text-right">Train Score</th>
                          <th className="py-2 px-3 text-right">Test Score</th>
                          <th className="py-2 px-3 text-right">WFE</th>
                          <th className="py-2 px-3 text-right">Degradación</th>
                          <th className="py-2 px-3 text-right">Sensibilidad</th>
                          <th className="py-2 px-3 text-right">Retorno OOS</th>
                          <th className="py-2 px-3 text-right">Trades</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {wfoResult.windows.map((w) => (
                          <tr key={w.windowIndex} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 font-bold text-slate-300">W{w.windowIndex}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                w.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                              }`}>
                                {w.status === 'SUCCESS' ? 'OK' : 'SIN PARAMS'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans">
                              {w.trainStart} → {w.trainEnd} ({w.trainBarsCount}b)
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 text-[11px] font-sans">
                              {w.testStart} → {w.testEnd} ({w.testBarsCount}b)
                            </td>
                            <td className="py-2.5 px-3">
                              {w.selectedParameters ? (
                                <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 text-[10px]">
                                  {Object.entries(w.selectedParameters).map(([k, v]) => `${k}=${v}`).join(', ')}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px]">N/A</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-indigo-300">
                              {w.trainScore !== null ? formatNum(w.trainScore) : 'N/D'}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              (w.testScore ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {w.testScore !== null ? formatNum(w.testScore) : 'N/D'}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              (w.efficiencyRatio ?? 0) >= 0.5 ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                              {w.efficiencyRatio !== null ? formatNum(w.efficiencyRatio) : 'N/D'}
                            </td>
                            <td className={`py-2.5 px-3 text-right text-[10px] ${
                              (w.degradationPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {w.degradationPct !== null ? `${formatPct(w.degradationPct, 1)}` : 'N/D'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                w.parameterSensitivity === 'LOW' ? 'bg-emerald-500/20 text-emerald-300' :
                                w.parameterSensitivity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' :
                                w.parameterSensitivity === 'HIGH' ? 'bg-rose-500/20 text-rose-300' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {w.parameterSensitivity}
                              </span>
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              (w.testMetrics?.totalReturnPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {w.testMetrics ? formatPct(w.testMetrics.totalReturnPct) : 'N/D'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-400">
                              {w.testMetrics ? w.testMetrics.totalTrades : 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Parameter Stability Analysis */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Estabilidad Temporal de Parámetros
                    </h4>
                    <span className="text-xs font-mono text-indigo-300">
                      Score Global de Estabilidad: <strong>{wfoResult.parameterStability.stabilityScore ?? 'N/D'}%</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Mide si los parámetros óptimos se mantienen estables a lo largo del tiempo o si mutan drásticamente entre ventanas consecutivas.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {wfoResult.parameterStability.parameterStats.map((pStat) => {
                      return (
                        <div key={pStat.parameter} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-indigo-300">{pStat.parameter}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              (pStat.stabilityScore ?? 0) >= 60 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              Estabilidad: {pStat.stabilityScore !== null ? `${pStat.stabilityScore}%` : 'N/D'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 space-y-1 mt-2 font-mono">
                            <div>Media: <strong className="text-white">{pStat.mean ?? 'N/D'}</strong> | StdDev: <strong className="text-white">{pStat.stdDev ?? 'N/D'}</strong></div>
                            <div>Rango: <strong className="text-white">[{pStat.min ?? 'N/D'} - {pStat.max ?? 'N/D'}]</strong></div>
                            <div>Valores Únicos Seleccionados: <strong className="text-white">{pStat.uniqueValues}</strong></div>
                            <div className="text-[10px] text-slate-500 truncate">Secuencia: [{pStat.selections.join(', ')}]</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* WFO INSUFFICIENT DATA ALERT */}
            {wfValidationMode === 'wfo' && !wfoResult && (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs">
                Se requieren más barras históricas ({historicalBars.length} disponibles) para la configuración actual de Train ({wfoTrainBars}) + Test ({wfoTestBars}). Reduce el tamaño de Train/Test o aumenta el total de barras en el panel lateral.
              </div>
            )}

            {/* HOLDOUT VALIDATION SECTION */}
            {wfValidationMode === 'holdout' && holdoutResult && (
              <div className="space-y-5">
                <div className={`p-4 rounded-xl border ${
                  holdoutResult.isRobust ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    {holdoutResult.isRobust ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
                    <span>Ratio de Eficiencia Holdout Fuera de Muestra: {formatNum(holdoutResult.efficiencyRatio)}</span>
                  </div>
                  <p className="text-xs">{holdoutResult.diagnosis}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block mb-2">
                      1. Periodo In-Sample (70% Datos)
                    </span>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Retorno Total:</span>
                        <span className="text-white font-bold">{formatPct(holdoutResult.inSampleResult.metrics.totalReturnPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">CAGR:</span>
                        <span className="text-slate-300 font-bold">{formatPct(holdoutResult.inSampleResult.metrics.cagrPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sharpe Ratio:</span>
                        <span className="text-indigo-300 font-bold">{formatNum(holdoutResult.inSampleResult.metrics.sharpeRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sortino Ratio:</span>
                        <span className="text-indigo-200 font-bold">{formatNum(holdoutResult.inSampleResult.metrics.sortinoRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max Drawdown:</span>
                        <span className="text-rose-400 font-bold">-{formatNum(holdoutResult.inSampleResult.metrics.maxDrawdownPct)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Win Rate:</span>
                        <span className="text-slate-200 font-bold">{formatNum(holdoutResult.inSampleResult.metrics.winRatePct)}%</span>
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
                        <span className="text-white font-bold">{formatPct(holdoutResult.outOfSampleResult.metrics.totalReturnPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">CAGR:</span>
                        <span className="text-slate-300 font-bold">{formatPct(holdoutResult.outOfSampleResult.metrics.cagrPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sharpe Ratio:</span>
                        <span className="text-emerald-300 font-bold">{formatNum(holdoutResult.outOfSampleResult.metrics.sharpeRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sortino Ratio:</span>
                        <span className="text-emerald-200 font-bold">{formatNum(holdoutResult.outOfSampleResult.metrics.sortinoRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max Drawdown:</span>
                        <span className="text-rose-400 font-bold">-{formatNum(holdoutResult.outOfSampleResult.metrics.maxDrawdownPct)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Win Rate:</span>
                        <span className="text-slate-200 font-bold">{formatNum(holdoutResult.outOfSampleResult.metrics.winRatePct)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
