import React, { useState, useMemo } from 'react';
import { Portfolio, Asset } from '../types';
import { ALL_AVAILABLE_ASSETS } from '../data/marketData';
import { RiskEngine } from '../services/riskEngine';
import { PortfolioEngine } from '../services/portfolioEngine';
import { PositionSizingEngine, PositionSizingResult } from '../investment/risk/positionSizing';
import { PortfolioAnalyticsEngine, RebalanceSuggestion, PortfolioStressTest, CorrelationPair } from '../investment/risk/portfolioAnalytics';
import {
  ShieldCheck,
  Activity,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Sliders,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Info
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface RiskAnalysisCenterProps {
  portfolio: Portfolio;
}

export const RiskAnalysisCenter: React.FC<RiskAnalysisCenterProps> = ({ portfolio }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'position_sizing' | 'rebalance' | 'stress_test' | 'dca'>('audit');
  const [selectedScenario, setSelectedScenario] = useState<'covid_2020' | 'rate_hikes_2022' | 'lehman_2008'>('covid_2020');

  // Position Sizing Interactive Calculator State
  const [sizingAssetId, setSizingAssetId] = useState<string>('vanguard-msci-world');
  const [sizingWinRate, setSizingWinRate] = useState<number>(55);
  const [sizingWinLossRatio, setSizingWinLossRatio] = useState<number>(1.8);
  const [sizingRiskPerTradePct, setSizingRiskPerTradePct] = useState<number>(1.5);
  const [sizingStopLossPct, setSizingStopLossPct] = useState<number>(3.5);
  const [sizingTargetVolPct, setSizingTargetVolPct] = useState<number>(10.0);

  // DCA Calculator state
  const [initialCapital, setInitialCapital] = useState<number>(100);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(25);
  const [investmentYears, setInvestmentYears] = useState<number>(10);
  const [expectedReturn, setExpectedReturn] = useState<number>(5.0);

  const selectedSizingAsset = useMemo(() => {
    return ALL_AVAILABLE_ASSETS.find(a => a.id === sizingAssetId) || ALL_AVAILABLE_ASSETS[0];
  }, [sizingAssetId]);

  // Sizing Calculations
  const kellyResult: PositionSizingResult = useMemo(() => {
    return PositionSizingEngine.calculateKellySizing({
      portfolioValuation: portfolio?.totalValuation || 0,
      availableCash: portfolio?.cashBalance || 0,
      asset: selectedSizingAsset,
      winRatePct: sizingWinRate,
      winLossRatio: sizingWinLossRatio,
      stopLossDistancePct: sizingStopLossPct
    }, 0.35); // Conservative Quarter-Kelly
  }, [portfolio, selectedSizingAsset, sizingWinRate, sizingWinLossRatio, sizingStopLossPct]);

  const fixedRiskResult: PositionSizingResult = useMemo(() => {
    return PositionSizingEngine.calculateFixedRiskSizing(
      {
        portfolioValuation: portfolio?.totalValuation || 0,
        availableCash: portfolio?.cashBalance || 0,
        asset: selectedSizingAsset,
        winRatePct: sizingWinRate,
        winLossRatio: sizingWinLossRatio
      },
      sizingRiskPerTradePct,
      sizingStopLossPct
    );
  }, [portfolio, selectedSizingAsset, sizingWinRate, sizingWinLossRatio, sizingRiskPerTradePct, sizingStopLossPct]);

  const volTargetResult: PositionSizingResult = useMemo(() => {
    return PositionSizingEngine.calculateVolatilityTargetSizing(
      {
        portfolioValuation: portfolio?.totalValuation || 0,
        availableCash: portfolio?.cashBalance || 0,
        asset: selectedSizingAsset,
        winRatePct: sizingWinRate,
        winLossRatio: sizingWinLossRatio,
        stopLossDistancePct: sizingStopLossPct
      },
      sizingTargetVolPct
    );
  }, [portfolio, selectedSizingAsset, sizingWinRate, sizingWinLossRatio, sizingStopLossPct, sizingTargetVolPct]);

  // Rebalance Plan
  const rebalancePlan: RebalanceSuggestion[] = useMemo(() => {
    return portfolio ? PortfolioAnalyticsEngine.generateRebalancePlan(portfolio) : [];
  }, [portfolio]);

  // Stress Tests
  const advancedStressTests: PortfolioStressTest[] = useMemo(() => {
    return portfolio ? PortfolioAnalyticsEngine.runStressTests(portfolio) : [];
  }, [portfolio]);

  // Correlation Matrix
  const correlationPairs: CorrelationPair[] = useMemo(() => {
    return PortfolioAnalyticsEngine.calculateCorrelationMatrix(ALL_AVAILABLE_ASSETS.slice(0, 6));
  }, []);

  const riskRules = useMemo(() => {
    return portfolio ? RiskEngine.getPortfolioRiskRules(portfolio) : [];
  }, [portfolio]);
  const stressResult = PortfolioEngine.runStressTest(selectedScenario, portfolio?.totalValuation || 0);
  const dcaProjection = PortfolioEngine.calculateDcaProjection(initialCapital, monthlyContribution, investmentYears, expectedReturn);

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300 mb-1">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Centro de Gestión de Riesgo & Dimensionamiento</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Control Cuantitativo de Riesgo & Preservación de Capital
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Cálculo de tamaño de posición por Criterio de Kelly y Volatility Targeting, auditoría de límites normativos y simulación de escenarios de estrés.
            </p>
          </div>

          <div className="glass-panel p-3 rounded-xl sm:rounded-2xl text-xs shrink-0 flex items-center gap-4">
            <div>
              <div className="text-slate-400 text-[10px] uppercase tracking-wider">Patrimonio Total</div>
              <div className="font-bold font-mono text-emerald-400 text-sm">{(portfolio?.totalValuation || 0).toFixed(2)} €</div>
            </div>
            <div className="border-l border-white/10 pl-3">
              <div className="text-slate-400 text-[10px] uppercase tracking-wider">Liquidez Colchón</div>
              <div className="font-bold font-mono text-indigo-300 text-sm">{(portfolio?.cashBalance || 0).toFixed(2)} €</div>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Auditoría de Normas ({riskRules.filter(r => r.status === 'safe').length}/{riskRules.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('position_sizing')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'position_sizing' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Dimensionamiento (Kelly / Vol Target)</span>
          </button>

          <button
            onClick={() => setActiveTab('rebalance')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rebalance' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Plan de Rebalanceo</span>
          </button>

          <button
            onClick={() => setActiveTab('stress_test')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'stress_test' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Estrés & Correlaciones</span>
          </button>

          <button
            onClick={() => setActiveTab('dca')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dca' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Planificador DCA</span>
          </button>
        </div>
      </div>

      {/* TAB 1: AUDITORÍA DE NORMAS */}
      {activeTab === 'audit' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {riskRules.map(rule => (
            <div
              key={rule.id}
              className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border flex flex-col justify-between transition-all ${
                rule.status === 'safe'
                  ? 'glass-card border-white/10'
                  : rule.status === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 backdrop-blur-md'
                  : 'bg-rose-500/10 border-rose-500/30 backdrop-blur-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {rule.category}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    rule.status === 'safe'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : rule.status === 'warning'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}>
                    {rule.status === 'safe' ? 'OK / Seguro' : rule.status === 'warning' ? 'Precaución' : 'Infracción'}
                  </span>
                </div>

                <h4 className="font-bold text-white text-xs sm:text-sm mt-2">{rule.title}</h4>
                <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">{rule.description}</p>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-baseline justify-between">
                <div>
                  <span className="text-[9px] uppercase text-slate-400">Valor Actual</span>
                  <div className={`text-sm sm:text-base font-bold font-mono ${
                    rule.status === 'safe' ? 'text-emerald-400' : rule.status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {rule.currentValue.toFixed(1)} {rule.unit}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase text-slate-400">Límite Seguro</span>
                  <div className="text-xs font-semibold text-slate-200 font-mono">
                    {rule.limitValue} {rule.unit}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: POSITION SIZING (KELLY / VOL TARGET) */}
      {activeTab === 'position_sizing' && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Calculadora Matemática de Tamaño de Posición
                </h3>
                <p className="text-xs text-slate-400">Evita el riesgo de ruina ajustando el importe de la orden a la volatilidad y probabilidad real.</p>
              </div>

              <div>
                <select
                  value={sizingAssetId}
                  onChange={e => setSizingAssetId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none"
                >
                  {ALL_AVAILABLE_ASSETS.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.ticker} · {a.name.slice(0, 25)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Win Rate Histórico (%)</label>
                <input
                  type="number"
                  value={sizingWinRate}
                  onChange={e => setSizingWinRate(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Payoff (Win/Loss Ratio)</label>
                <input
                  type="number"
                  step="0.1"
                  value={sizingWinLossRatio}
                  onChange={e => setSizingWinLossRatio(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Distancia Stop Loss (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={sizingStopLossPct}
                  onChange={e => setSizingStopLossPct(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Riesgo Máx por Trade (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={sizingRiskPerTradePct}
                  onChange={e => setSizingRiskPerTradePct(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3 Sizing Method Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Kelly */}
            <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-indigo-400">Quarter-Kelly Criterion</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">
                    Fracción 35%
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-white mb-1">
                  {kellyResult.recommendedAmountEur.toFixed(2)} €
                </div>
                <div className="text-xs text-slate-400 mb-3">
                  Peso sugerido: <strong className="text-slate-200">{kellyResult.recommendedWeightPct}%</strong> del capital
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {kellyResult.rationale}
                </p>
              </div>

              <div className="border-t border-slate-800 pt-2 text-[11px] font-mono text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Pérdida máx en Stop:</span>
                  <span className="text-rose-400">-{kellyResult.riskMetrics.maxLossEurAtStop} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Impacto en Cartera:</span>
                  <span className="text-slate-200">{kellyResult.riskMetrics.portfolioLossImpactPct}%</span>
                </div>
              </div>
            </div>

            {/* Fixed Risk (2% Rule) */}
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-emerald-400">Regla de Riesgo Fijo (1.5%)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                    Riesgo Acotado
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-white mb-1">
                  {fixedRiskResult.recommendedAmountEur.toFixed(2)} €
                </div>
                <div className="text-xs text-slate-400 mb-3">
                  Peso sugerido: <strong className="text-slate-200">{fixedRiskResult.recommendedWeightPct}%</strong> del capital
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {fixedRiskResult.rationale}
                </p>
              </div>

              <div className="border-t border-slate-800 pt-2 text-[11px] font-mono text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Pérdida máx en Stop:</span>
                  <span className="text-rose-400">-{fixedRiskResult.riskMetrics.maxLossEurAtStop} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Impacto en Cartera:</span>
                  <span className="text-slate-200">{fixedRiskResult.riskMetrics.portfolioLossImpactPct}%</span>
                </div>
              </div>
            </div>

            {/* Volatility Targeting */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-amber-400">Volatility Targeting (10%)</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                    Paridad de Riesgo
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-white mb-1">
                  {volTargetResult.recommendedAmountEur.toFixed(2)} €
                </div>
                <div className="text-xs text-slate-400 mb-3">
                  Peso sugerido: <strong className="text-slate-200">{volTargetResult.recommendedWeightPct}%</strong> del capital
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {volTargetResult.rationale}
                </p>
              </div>

              <div className="border-t border-slate-800 pt-2 text-[11px] font-mono text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Pérdida máx en Stop:</span>
                  <span className="text-rose-400">-{volTargetResult.riskMetrics.maxLossEurAtStop} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Impacto en Cartera:</span>
                  <span className="text-slate-200">{volTargetResult.riskMetrics.portfolioLossImpactPct}%</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: PLAN DE REBALANCEO */}
      {activeTab === 'rebalance' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                Matriz de Rebalanceo Inteligente
              </h3>
              <span className="text-xs text-slate-400 font-mono">Umbral de Rebalanceo: ±2.0%</span>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Ajusta automáticamente las desviaciones patrimoniales para mantener la distribución de activos alineada con tus objetivos de riesgo y evitar sobreexposiciones accidentales.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Activo</th>
                    <th className="py-2.5 px-3">Peso Actual</th>
                    <th className="py-2.5 px-3">Objetivo</th>
                    <th className="py-2.5 px-3">Desviación</th>
                    <th className="py-2.5 px-3">Acción Sugerida</th>
                    <th className="py-2.5 px-3">Importe (€)</th>
                    <th className="py-2.5 px-3">Urgencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {rebalancePlan.map(item => (
                    <tr key={item.assetId} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-200 font-mono">{item.ticker}</div>
                        <div className="text-[11px] text-slate-400">{item.name}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-200">{item.currentWeightPct}%</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{item.targetWeightPct}%</td>
                      <td className={`py-3 px-3 font-mono font-bold ${item.diffWeightPct > 0 ? 'text-emerald-400' : item.diffWeightPct < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {item.diffWeightPct > 0 ? '+' : ''}{item.diffWeightPct}%
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          item.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' :
                          item.action === 'SELL' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {item.action === 'BUY' ? 'COMPRAR' : item.action === 'SELL' ? 'VENDER / RECOGER' : 'MANTENER'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-white font-bold">{item.amountEur.toFixed(2)} €</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.urgency === 'ALTA' ? 'bg-rose-500/20 text-rose-300' :
                          item.urgency === 'MEDIA' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {item.urgency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ESTRÉS & CORRELACIONES */}
      {activeTab === 'stress_test' && (
        <div className="space-y-5">
          {/* Stress Scenarios */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-bold text-base text-white mb-1 flex items-center gap-2">
              <Activity className="w-5 h-5 text-rose-400" />
              Simulaciones de Estrés Macroeconómico
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Comportamiento esperado del patrimonio ante shocks extremos de mercado.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {advancedStressTests.map((t, idx) => (
                <div key={idx} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-sm text-slate-200">{t.scenarioName}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300">
                      Shock {t.marketShockPct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{t.description}</p>
                  
                  <div className="flex items-baseline justify-between border-t border-slate-800/80 pt-2 font-mono text-xs">
                    <span className="text-slate-400">Pérdida Estimada Cartera:</span>
                    <span className="text-rose-400 font-bold">-{t.estimatedLossEur.toFixed(2)} € ({t.estimatedPortfolioImpactPct}%)</span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs font-mono mt-1">
                    <span className="text-slate-400">Resiliencia Cartera:</span>
                    <span className="text-emerald-400 font-bold">{t.resilienceScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Correlation Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-bold text-base text-white mb-1">Matriz de Correlación Cruzada</h3>
            <p className="text-xs text-slate-400 mb-4">
              Valores cercanos a 0 o negativos protegen la cartera ante caídas generalizadas de renta variable.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
              {correlationPairs.map((p, idx) => (
                <div key={idx} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-slate-300 font-bold">{p.tickerA} / {p.tickerB}</span>
                    <span className="text-[10px] text-slate-500 block">{p.relationship}</span>
                  </div>
                  <span className={`text-sm font-bold ${
                    p.correlation > 0.7 ? 'text-amber-400' : p.correlation < 0.2 ? 'text-emerald-400' : 'text-slate-300'
                  }`}>
                    {p.correlation > 0 ? '+' : ''}{p.correlation.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DCA */}
      {activeTab === 'dca' && (
        <div id="card-dca-planner" className="glass-card rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">Planificador DCA & Crecimiento Compuesto</h3>
            </div>
            <span className="text-[10px] sm:text-xs font-mono text-slate-400">Proyección matemática sin hype</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            
            {/* Sliders Form */}
            <div className="lg:col-span-5 space-y-3.5 sm:space-y-4">
              
              {/* Initial Capital */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Capital Inicial:</span>
                  <span className="font-bold text-white font-mono">{initialCapital} €</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="w-full accent-indigo-400 bg-white/10 rounded-lg h-2"
                />
              </div>

              {/* Monthly Contribution */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Aportación Mensual (DCA):</span>
                  <span className="font-bold text-emerald-400 font-mono">+{monthlyContribution} € / mes</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="5"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                  className="w-full accent-emerald-400 bg-white/10 rounded-lg h-2"
                />
              </div>

              {/* Horizon Years */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Horizonte Temporal:</span>
                  <span className="font-bold text-white font-mono">{investmentYears} años</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="25"
                  step="1"
                  value={investmentYears}
                  onChange={(e) => setInvestmentYears(Number(e.target.value))}
                  className="w-full accent-sky-400 bg-white/10 rounded-lg h-2"
                />
              </div>

              {/* Expected Annual Return */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Rentabilidad Anual Estimada:</span>
                  <span className="font-bold text-amber-400 font-mono">{expectedReturn.toFixed(1)}% anual</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="8.0"
                  step="0.5"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(Number(e.target.value))}
                  className="w-full accent-amber-400 bg-white/10 rounded-lg h-2"
                />
                <div className="text-[10px] text-slate-400 mt-0.5">
                  4.0% - 5.5% corresponde a una cartera prudente equilibrada.
                </div>
              </div>

              {/* Output Summary Card */}
              <div className="p-3.5 glass-panel rounded-xl sm:rounded-2xl text-xs space-y-1.5 mt-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Aportado:</span>
                  <span className="font-bold text-white font-mono">{dcaProjection.totalInvested.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Interés Compuesto:</span>
                  <span className="font-bold text-emerald-400 font-mono">+{dcaProjection.totalGains.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/10 text-xs sm:text-sm font-bold">
                  <span className="text-white">Patrimonio Final:</span>
                  <span className="text-indigo-300 font-mono">{dcaProjection.finalBalance.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Chart visualizer */}
            <div className="lg:col-span-7 h-56 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dcaProjection.dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="year"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(y) => `A${y}`}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(v) => `${v}€`}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${Number(value).toFixed(2)} €`]}
                    contentStyle={{ backgroundColor: 'rgba(10, 17, 34, 0.9)', borderColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '12px', color: '#f8fafc', backdropFilter: 'blur(12px)', fontSize: '11px' }}
                  />
                  <Legend formatter={(val) => <span className="text-[11px] text-slate-300">{val === 'balance' ? 'Patrimonio Total' : 'Capital Aportado'}</span>} />
                  <Area type="monotone" dataKey="balance" stroke="#818cf8" fill="#4f46e5" fillOpacity={0.35} />
                  <Area type="monotone" dataKey="invested" stroke="#10b981" fill="#059669" fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
