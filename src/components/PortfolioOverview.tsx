import React from 'react';
import { Portfolio, Asset } from '../types';
import { ALL_AVAILABLE_ASSETS } from '../data/marketData';
import { ShieldCheck, Info, ArrowUpRight, ArrowDownRight, PieChart as PieIcon, RefreshCw, Lock, Sparkles, Plus, Minus, TrendingUp, Award, Zap } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface PortfolioOverviewProps {
  portfolio: Portfolio;
  onOpenTradeModal: (asset: Asset, defaultType?: 'BUY' | 'SELL') => void;
  onOpenMyInvestorBridge: () => void;
  onGoToRiskCenter: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  liquidez: '#10b981', // emerald
  monetario: '#06b6d4', // cyan
  renta_fija: '#6366f1', // indigo
  renta_variable: '#a855f7', // purple
  materias_primas: '#f59e0b', // amber
  semiconductores: '#ec4899', // pink
  megatrend: '#8b5cf6', // violet
  crypto_etp: '#f97316' // orange
};

export const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({
  portfolio,
  onOpenTradeModal,
  onOpenMyInvestorBridge,
  onGoToRiskCenter
}) => {
  // Chart Data preparation
  const chartData = [
    {
      name: 'Efectivo / Liquidez',
      value: Number(portfolio.cashBalance.toFixed(2)),
      color: CATEGORY_COLORS.liquidez,
      category: 'liquidez'
    },
    ...portfolio.positions.map(pos => {
      const asset = ALL_AVAILABLE_ASSETS.find(a => a.id === pos.assetId);
      const cat = asset ? asset.category : 'renta_fija';
      return {
        name: asset ? asset.name : pos.assetId,
        value: Number(pos.currentValuation.toFixed(2)),
        color: CATEGORY_COLORS[cat] || '#64748b',
        category: cat
      };
    })
  ].filter(item => item.value > 0);

  const effectiveWealth = portfolio.totalValuation + (portfolio.vaultWithdrawnAmount || 0);
  const pnlIsPositive = portfolio.totalPnlAmount >= 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Capital & Health Header Card with Frosted Glass */}
      <div id="card-portfolio-header" className="glass-card rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 mb-1">
              <span>Patrimonio Total en Simulación</span>
              <span className="glass px-2 py-0.5 rounded-full border border-white/10 text-white font-mono">
                Base Inicial: 100,00 €
              </span>
            </div>
            
            <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
                {effectiveWealth.toFixed(2)} €
              </h1>
              <div className={`flex items-center text-xs sm:text-sm font-semibold font-mono ${pnlIsPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pnlIsPositive ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
                <span>
                  {pnlIsPositive ? '+' : ''}{portfolio.totalPnlAmount.toFixed(2)} € ({pnlIsPositive ? '+' : ''}{portfolio.totalPnlPercentage.toFixed(2)}%)
                </span>
              </div>
            </div>
            
            <p className="text-[11px] sm:text-xs text-slate-300 mt-1.5 max-w-xl leading-relaxed">
              Supervisión de cartera con simulación de órdenes en tiempo real, gestión de liquidez y disciplina de protección contra pérdidas permanentes.
            </p>
          </div>

          {/* Key Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="glass-panel p-3 sm:p-3.5 rounded-xl sm:rounded-2xl">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400">Colchón Efectivo</div>
              <div className="text-sm sm:text-base font-bold font-mono text-emerald-400 mt-0.5">
                {portfolio.cashBalance.toFixed(2)} €
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400">{portfolio.cashReservePercentage.toFixed(0)}% del total</div>
            </div>

            <div className="glass-panel p-3 sm:p-3.5 rounded-xl sm:rounded-2xl">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400">Bóveda Asegurada</div>
              <div className="text-sm sm:text-base font-bold font-mono text-amber-400 mt-0.5 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                {(portfolio.vaultWithdrawnAmount || 0).toFixed(2)} €
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400">Capital Retirado</div>
            </div>

            <div className="glass-panel p-3 sm:p-3.5 rounded-xl sm:rounded-2xl col-span-2 sm:col-span-1">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400">Riesgo Global</div>
              <div className="text-sm sm:text-base font-bold font-mono text-sky-400 mt-0.5">
                CNMV {portfolio.portfolioRiskScore}/7
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400">Escala de Volatilidad</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Allocation Chart & Conservative Rule Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* Left: Allocation Visualizer */}
        <div id="card-allocation-breakdown" className="lg:col-span-6 glass-card rounded-2xl p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">Distribución Real de Activos</h3>
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-slate-400">Simulación Paper Trading</span>
            </div>

            {/* Recharts Pie Chart Container with responsive height */}
            <div className="h-48 sm:h-56 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${Number(value).toFixed(2)} €`, 'Valor']}
                    contentStyle={{
                      backgroundColor: 'rgba(10, 17, 34, 0.92)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      backdropFilter: 'blur(12px)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Allocation breakdown list */}
            <div className="mt-3 sm:mt-4 space-y-2">
              {chartData.map((item, idx) => {
                const pct = portfolio.totalValuation > 0 ? ((item.value / portfolio.totalValuation) * 100).toFixed(1) : '0.0';
                return (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-200 truncate">{item.name}</span>
                    </div>
                    <div className="font-mono text-right shrink-0">
                      <strong className="text-white font-bold">{item.value.toFixed(2)} €</strong>
                      <span className="text-slate-400 ml-1.5">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total en cartera activa:</span>
            <span className="text-emerald-400 font-bold">{portfolio.totalValuation.toFixed(2)} €</span>
          </div>
        </div>

        {/* Right: Golden Rules & Health Check */}
        <div id="card-golden-rules" className="lg:col-span-6 glass-card rounded-2xl p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">Pilares de Control de Riesgo</h3>
              </div>
              <button
                onClick={onGoToRiskCenter}
                className="text-xs text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
              >
                Auditoría Completa →
              </button>
            </div>

            <div className="space-y-2.5 sm:space-y-3 text-xs">
              <div className="p-3 sm:p-3.5 glass-panel rounded-xl flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                  1
                </div>
                <div>
                  <div className="font-bold text-white">Trailing Stop & Limitación de Pérdidas</div>
                  <div className="text-slate-300 mt-0.5 leading-relaxed">
                    Si un activo cae más de un 3% desde máximos, se liquida de inmediato para no arriesgar la base de capital.
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-3.5 glass-panel rounded-xl flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                  2
                </div>
                <div>
                  <div className="font-bold text-white">Regla de Extracción a 200 € (House Money)</div>
                  <div className="text-slate-300 mt-0.5 leading-relaxed">
                    Al duplicar el capital inicial, se retiran 100 € a la Bóveda para jugar 100% con beneficios de la casa con riesgo cero.
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-3.5 glass-panel rounded-xl flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                  3
                </div>
                <div>
                  <div className="font-bold text-white">Cero Deuda y Cero Apalancamiento Tóxico</div>
                  <div className="text-slate-300 mt-0.5 leading-relaxed">
                    Solo se opera con el saldo real disponible, impidiendo balances negativos o llamadas de margen.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Assisted Mode Badge */}
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Conector MyInvestor / Broker: <strong>Modo Asistido</strong></span>
            </div>
            <button
              id="btn-open-myinvestor-bridge"
              onClick={onOpenMyInvestorBridge}
              className="px-3.5 py-2 glass hover:bg-white/15 text-indigo-300 hover:text-indigo-200 border border-indigo-400/30 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm text-center min-h-[40px] flex items-center justify-center"
            >
              Configurar Broker (MyInvestor)
            </button>
          </div>
        </div>
      </div>

      {/* Asset Positions: Responsive Dual View */}
      <div id="card-positions-table" className="glass-card rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base">Posiciones en Cartera</h3>
            <p className="text-[11px] sm:text-xs text-slate-400">Detalle de participaciones y valoración actual</p>
          </div>
          <div className="text-xs text-slate-300 font-mono">
            Total Invertido: <strong className="text-white">{(portfolio.totalValuation - portfolio.cashBalance).toFixed(2)} €</strong> + <strong className="text-emerald-400">{portfolio.cashBalance.toFixed(2)} €</strong> efectivo
          </div>
        </div>

        {/* 1. Mobile Card View (Visible on small screens < md) */}
        <div className="block md:hidden p-3 space-y-3">
          
          {/* Cash Card */}
          <div className="p-3.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-bold text-white text-xs">Efectivo / Liquidez Disponible</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                Riesgo 1/7
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/10 font-mono">
              <div>
                <div className="text-[10px] text-slate-400">Saldo Disponible:</div>
                <div className="font-bold text-emerald-400 text-sm">{portfolio.cashBalance.toFixed(2)} €</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Peso en Cartera:</div>
                <div className="font-bold text-white text-sm">{portfolio.cashReservePercentage.toFixed(1)}%</div>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-300">
              Colchón de seguridad para compras con descuento e imprevistos.
            </div>
          </div>

          {/* Asset Position Cards */}
          {portfolio.positions.map(pos => {
            const asset = ALL_AVAILABLE_ASSETS.find(a => a.id === pos.assetId);
            if (!asset) return null;
            const posPnlPositive = pos.pnlAmount >= 0;

            return (
              <div key={pos.assetId} className="p-3.5 rounded-xl glass-panel space-y-3 border border-white/10">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-white text-xs leading-snug">{asset.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{asset.isin} · {asset.ticker}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                    asset.riskLevel <= 2
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : asset.riskLevel <= 4
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}>
                    CNMV {asset.riskLevel}/7
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/20 p-2.5 rounded-lg">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Valoración Actual:</span>
                    <span className="font-bold text-white text-sm">{pos.currentValuation.toFixed(2)} €</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">({pos.weightPercentage.toFixed(1)}% peso)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Rentabilidad (P&L):</span>
                    <span className={`font-bold text-sm block ${posPnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {posPnlPositive ? '+' : ''}{pos.pnlAmount.toFixed(2)} €
                    </span>
                    <span className={`text-[10px] font-semibold ${posPnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ({posPnlPositive ? '+' : ''}{pos.pnlPercentage.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* Mobile Touch Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => onOpenTradeModal(asset, 'BUY')}
                    className="w-full py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/40 text-emerald-200 border border-emerald-500/40 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Comprar</span>
                  </button>

                  <button
                    onClick={() => onOpenTradeModal(asset, 'SELL')}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Minus className="w-4 h-4" />
                    <span>Vender</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 2. Desktop Table View (Hidden on mobile < md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3 px-4">Fondo / Activo</th>
                <th className="py-3 px-3">Categoría</th>
                <th className="py-3 px-3">Riesgo</th>
                <th className="py-3 px-3 text-right">Invertido</th>
                <th className="py-3 px-3 text-right">Valor Actual</th>
                <th className="py-3 px-3 text-right">P&L (€)</th>
                <th className="py-3 px-3 text-right">P&L (%)</th>
                <th className="py-3 px-3 text-right">Peso</th>
                <th className="py-3 px-4 text-center">Operar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              
              {/* Cash Row */}
              <tr className="hover:bg-white/[0.02] transition-colors bg-emerald-500/[0.04]">
                <td className="py-3.5 px-4 font-sans">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                    <div>
                      <div className="font-bold text-white">Efectivo / Liquidez Disponible</div>
                      <div className="text-[10px] text-slate-400 font-mono">Colchón 20-40% para preservar capital</div>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-3 font-sans text-slate-300">Liquidez</td>
                <td className="py-3.5 px-3 font-sans">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    1 / 7
                  </span>
                </td>
                <td className="py-3.5 px-3 text-right text-slate-300">{portfolio.cashBalance.toFixed(2)} €</td>
                <td className="py-3.5 px-3 text-right font-bold text-emerald-400">{portfolio.cashBalance.toFixed(2)} €</td>
                <td className="py-3.5 px-3 text-right text-slate-400">0,00 €</td>
                <td className="py-3.5 px-3 text-right text-slate-400">0,00%</td>
                <td className="py-3.5 px-3 text-right font-bold text-white">{portfolio.cashReservePercentage.toFixed(1)}%</td>
                <td className="py-3.5 px-4 text-center">
                  <span className="text-[10px] text-slate-400 font-sans">Disponible</span>
                </td>
              </tr>

              {/* Position Rows */}
              {portfolio.positions.map(pos => {
                const asset = ALL_AVAILABLE_ASSETS.find(a => a.id === pos.assetId);
                if (!asset) return null;
                const posPnlPositive = pos.pnlAmount >= 0;

                return (
                  <tr key={pos.assetId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-sans">
                      <div className="font-bold text-white text-xs">{asset.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{asset.isin} · {asset.ticker}</div>
                    </td>
                    <td className="py-3.5 px-3 font-sans text-slate-300">{asset.categoryLabel}</td>
                    <td className="py-3.5 px-3 font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        asset.riskLevel <= 2
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : asset.riskLevel <= 4
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}>
                        {asset.riskLevel} / 7
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-300">{pos.investedAmount.toFixed(2)} €</td>
                    <td className="py-3.5 px-3 text-right font-bold text-white">{pos.currentValuation.toFixed(2)} €</td>
                    <td className={`py-3.5 px-3 text-right font-bold ${posPnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {posPnlPositive ? '+' : ''}{pos.pnlAmount.toFixed(2)} €
                    </td>
                    <td className={`py-3.5 px-3 text-right font-bold ${posPnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {posPnlPositive ? '+' : ''}{pos.pnlPercentage.toFixed(2)}%
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-200">{pos.weightPercentage.toFixed(1)}%</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenTradeModal(asset, 'BUY')}
                          className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          + Comprar
                        </button>
                        <button
                          onClick={() => onOpenTradeModal(asset, 'SELL')}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Vender
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
