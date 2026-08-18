import React, { useState } from 'react';
import { Asset } from '../types';
import { ALL_AVAILABLE_ASSETS } from '../data/marketData';
import { TrendingUp, ShieldCheck, Sparkles, Filter, Info, ArrowUpRight, ArrowDownRight, Search, Zap, Flame } from 'lucide-react';

interface MarketTrackerProps {
  onOpenTradeModal: (asset: Asset) => void;
}

export const MarketTracker: React.FC<MarketTrackerProps> = ({ onOpenTradeModal }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredAssets = ALL_AVAILABLE_ASSETS.filter(asset => {
    let matchesCategory = selectedCategory === 'all';
    if (selectedCategory === 'growth') {
      matchesCategory = !!asset.isHighGrowth;
    } else if (selectedCategory !== 'all') {
      matchesCategory = asset.category === selectedCategory;
    }

    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.isin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.ticker.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <span>Universo de Inversión y Simulación</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Monitor de Mercados, ETFs & Fondos Indexados
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Supervisión de instrumentos tanto conservadores (monetarios €STR, bonos) como activos de alto crecimiento para el <strong>Bot 2X</strong> (Semiconductores IA, Nasdaq-100, Crypto ETP).
            </p>
          </div>

          <div className="glass-panel p-3 rounded-xl sm:rounded-2xl text-xs shrink-0">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider">Control de Riesgo</div>
            <div className="font-bold text-emerald-400 mt-0.5 text-xs sm:text-sm">Trailing Stop Obligatorio</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Protege el capital inicial contra caídas</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 relative z-10">
          
          {/* Category Filter Chips */}
          <div className="flex overflow-x-auto no-scrollbar space-x-1.5 sm:space-x-2 py-1 -mx-1 px-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600/80 text-white border border-indigo-400/50 shadow-md shadow-indigo-950/40'
                  : 'glass text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              Todos ({ALL_AVAILABLE_ASSETS.length})
            </button>
            <button
              onClick={() => setSelectedCategory('growth')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                selectedCategory === 'growth'
                  ? 'bg-amber-500 text-slate-950 border border-amber-400 shadow-md shadow-amber-500/20'
                  : 'glass text-amber-300 hover:bg-amber-500/15'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>⚡ Crecimiento Rápido 2X</span>
            </button>
            <button
              onClick={() => setSelectedCategory('monetario')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] ${
                selectedCategory === 'monetario'
                  ? 'bg-cyan-600/80 text-white border border-cyan-400/50 shadow-md shadow-cyan-950/40'
                  : 'glass text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              Monetarios (€STR)
            </button>
            <button
              onClick={() => setSelectedCategory('renta_fija')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] ${
                selectedCategory === 'renta_fija'
                  ? 'bg-blue-600/80 text-white border border-blue-400/50 shadow-md shadow-blue-950/40'
                  : 'glass text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              Bonos Soberanos
            </button>
            <button
              onClick={() => setSelectedCategory('renta_variable')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] ${
                selectedCategory === 'renta_variable'
                  ? 'bg-purple-600/80 text-white border border-purple-400/50 shadow-md shadow-purple-950/40'
                  : 'glass text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              Renta Variable Global
            </button>
            <button
              onClick={() => setSelectedCategory('materias_primas')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] ${
                selectedCategory === 'materias_primas'
                  ? 'bg-amber-600/80 text-white border border-amber-400/50 shadow-md shadow-amber-950/40'
                  : 'glass text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              Oro / Refugio
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, ticker, ISIN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 glass rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400/60 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Asset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssets.map(asset => {
          const isPos = asset.change24h >= 0;

          return (
            <div
              key={asset.id}
              className={`glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-indigo-500/40 ${
                asset.isHighGrowth ? 'border-amber-500/30' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-bold text-xs text-indigo-300">{asset.ticker}</span>
                    <span className="text-[10px] text-slate-400 font-mono">· {asset.isin}</span>
                    {asset.isHighGrowth && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        ALTA BETA
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    asset.riskLevel <= 2
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : asset.riskLevel <= 4
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}>
                    CNMV {asset.riskLevel}/7
                  </span>
                </div>

                <h3 className="font-bold text-white text-sm sm:text-base leading-snug mb-1">
                  {asset.name}
                </h3>
                <p className="text-xs text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                  {asset.description}
                </p>

                {/* Price & Volatility metrics */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-black/20 font-mono text-xs mb-3">
                  <div>
                    <div className="text-[10px] text-slate-400">Precio</div>
                    <div className="font-bold text-white mt-0.5">{asset.currentPrice.toFixed(2)} €</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">24h</div>
                    <div className={`font-bold mt-0.5 ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPos ? '+' : ''}{asset.change24h.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">TER (Coste)</div>
                    <div className="font-bold text-slate-200 mt-0.5">{asset.ter.toFixed(2)}%</div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Volatilidad anual: <strong className="text-slate-200">{asset.volatilityAnnual}%</strong>
                </span>
                <button
                  onClick={() => onOpenTradeModal(asset)}
                  className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  Simular Orden →
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
