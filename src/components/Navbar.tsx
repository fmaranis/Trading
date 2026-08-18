import React, { useState } from 'react';
import { ActiveTab, Portfolio } from '../types';
import { ShieldCheck, Layers, BookOpen, Bell, TrendingUp, Cpu, RefreshCw, Zap, Award, Menu, X, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  portfolio: Portfolio;
  onResetPortfolio: () => void;
  onOpenLegalDisclaimer: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  portfolio,
  onResetPortfolio,
  onOpenLegalDisclaimer
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pnlIsPositive = portfolio.totalPnlAmount >= 0;
  const effectiveWealth = portfolio.totalValuation + (portfolio.vaultWithdrawnAmount || 0);

  const navItems: { id: ActiveTab; label: string; shortLabel: string; icon: React.ReactNode; badge?: string; highlight?: boolean }[] = [
    {
      id: 'growth_bot',
      label: '⚡ Bot en Tiempo Real (2X)',
      shortLabel: '⚡ Bot 2X',
      icon: <Zap className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />,
      badge: 'Meta 200€',
      highlight: true
    },
    {
      id: 'backtest_lab',
      label: '📊 Backtesting & Métricas',
      shortLabel: '📊 Backtesting',
      icon: <TrendingUp className="w-4 h-4 text-indigo-400 shrink-0" />,
      badge: '4 Estrategias',
      highlight: true
    },
    {
      id: 'dashboard',
      label: 'Mi Cartera',
      shortLabel: 'Cartera',
      icon: <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
    },
    {
      id: 'risk_center',
      label: 'Control de Riesgo & Kelly',
      shortLabel: 'Riesgo',
      icon: <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
    },
    {
      id: 'market',
      label: 'Mercado & Fondos',
      shortLabel: 'Mercado',
      icon: <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />
    },
    {
      id: 'alerts',
      label: 'Alertas',
      shortLabel: 'Alertas',
      icon: <Bell className="w-4 h-4 text-rose-400 shrink-0" />
    },
    {
      id: 'education',
      label: 'Academia',
      shortLabel: 'Academia',
      icon: <BookOpen className="w-4 h-4 text-teal-400 shrink-0" />
    },
    {
      id: 'architecture_docs',
      label: 'Arquitectura & FinRL',
      shortLabel: 'Arquitectura',
      icon: <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
    }
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header id="main-header" className="bg-[#0f172a]/95 border-b border-slate-800 text-slate-100 sticky top-0 z-40 backdrop-blur-md">
      
      {/* Top Advisory Banner */}
      <div id="compliance-top-banner" className="flex bg-indigo-950/50 border-b border-indigo-500/20 px-3 sm:px-4 py-1 text-[11px] sm:text-xs text-indigo-200 items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-1.5 truncate">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
          <span className="truncate">
            <strong>Simulación Algorítmica:</strong> Meta 100€ → 200€ con Trailing Stop y Backtesting cuantitativo.
          </span>
        </div>
        <button
          id="btn-view-legal-disclaimer"
          onClick={onOpenLegalDisclaimer}
          className="underline hover:text-amber-200 font-semibold cursor-pointer transition-colors text-[11px] shrink-0 ml-2"
        >
          Aviso MiFID II →
        </button>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center shadow-sm shrink-0">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base sm:text-lg text-white tracking-tight">Custodia</span>
                <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded-md font-mono font-bold">
                  2X BOT
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Trading & Backtest Lab</p>
            </div>
          </div>

          {/* Desktop Portfolio Metric Snapshot */}
          <div className="hidden lg:flex items-center gap-5 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Patrimonio Total</div>
              <div className="font-bold font-mono text-sm text-white">{effectiveWealth.toFixed(2)} €</div>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Efectivo Activo</div>
              <div className="font-bold font-mono text-sm text-emerald-400">
                {portfolio.cashBalance.toFixed(2)} €
              </div>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Bóveda (Retirado)</div>
              <div className="font-bold font-mono text-sm text-amber-400 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                {(portfolio.vaultWithdrawnAmount || 0).toFixed(2)} €
              </div>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">P&L Acumulado</div>
              <div className={`font-bold font-mono text-sm ${pnlIsPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pnlIsPositive ? '+' : ''}{portfolio.totalPnlAmount.toFixed(2)} € ({portfolio.totalPnlPercentage.toFixed(1)}%)
              </div>
            </div>
          </div>

          {/* Action Buttons & Mobile Menu Trigger */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Compact metrics on mobile */}
            <div className="flex sm:hidden items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-xs font-mono">
              <span className="font-bold text-white">{effectiveWealth.toFixed(0)}€</span>
              <span className={`text-[10px] ${pnlIsPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({pnlIsPositive ? '+' : ''}{portfolio.totalPnlPercentage.toFixed(0)}%)
              </span>
            </div>

            {/* Quick Access to Backtest */}
            <button
              id="btn-quick-backtest"
              onClick={() => handleSelectTab('backtest_lab')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                activeTab === 'backtest_lab'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                  : 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30 hover:bg-indigo-900/60'
              }`}
              title="Abrir Laboratorio de Backtesting"
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              <span className="hidden sm:inline">Backtesting</span>
            </button>

            {/* Quick Access to Bot */}
            <button
              id="btn-switch-bot"
              onClick={() => handleSelectTab('growth_bot')}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                activeTab === 'growth_bot'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>Bot 2X</span>
            </button>

            <button
              id="btn-reset-portfolio"
              onClick={onResetPortfolio}
              title="Reiniciar cartera a 100€"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">Reiniciar</span>
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              id="btn-toggle-mobile-menu"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer md:hidden"
              aria-label="Abrir menú de módulos"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Universal Top Navigation Tabs (Horizontally scrollable on mobile/tablet, flex on desktop) */}
        <div className="border-t border-slate-800/80 py-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          <nav className="flex items-center space-x-1.5 min-w-max">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`tab-top-${item.id}`}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? item.id === 'growth_bot'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-sm'
                        : item.id === 'backtest_lab'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold shadow-sm'
                        : 'bg-slate-800 text-white font-semibold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                      isActive ? 'bg-black/20 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Drawer Slide-Down Menu */}
      {isMobileMenuOpen && (
        <div id="mobile-navigation-drawer" className="md:hidden bg-[#0b0f19] border-b border-slate-800 px-4 py-3 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Todos los Módulos Disponibles</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cerrar ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isActive
                      ? 'bg-slate-800 border-amber-500/50 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{item.label}</div>
                      {item.badge && <span className="text-[10px] text-amber-400 font-mono">{item.badge}</span>}
                    </div>
                  </div>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Quick links inside mobile drawer */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                onResetPortfolio();
                setIsMobileMenuOpen(false);
              }}
              className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reiniciar a 100€
            </button>
            <button
              onClick={() => {
                onOpenLegalDisclaimer();
                setIsMobileMenuOpen(false);
              }}
              className="text-slate-400 hover:text-slate-200 underline text-[11px]"
            >
              Aviso MiFID II
            </button>
          </div>
        </div>
      )}

    </header>
  );
};

