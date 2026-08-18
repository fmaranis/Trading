import React, { useState, useEffect } from 'react';
import { ActiveTab, Portfolio, Asset, SimulatedOrder } from './types';
import { PortfolioEngine } from './services/portfolioEngine';
import { ALL_AVAILABLE_ASSETS } from './data/marketData';
import { LiveSimulationEngine } from './services/liveSimulationEngine';
import { Navbar } from './components/Navbar';
import { PortfolioOverview } from './components/PortfolioOverview';
import { GrowthTradingBot } from './components/GrowthTradingBot';
import { MarketTracker } from './components/MarketTracker';
import { RiskAnalysisCenter } from './components/RiskAnalysisCenter';
import { AlertsManager } from './components/AlertsManager';
import { EducationalHub } from './components/EducationalHub';
import { ArchitectureViewer } from './components/ArchitectureViewer';
import { BacktestCenter } from './components/BacktestCenter';
import { PaperTradingModal } from './components/PaperTradingModal';
import { LegalTaxDisclaimerModal } from './components/LegalTaxDisclaimerModal';
import { MyInvestorModal } from './components/MyInvestorModal';
import { CheckCircle2, ShieldCheck, Layers, TrendingUp, Bell, BookOpen, Zap, MoreHorizontal, Cpu, RefreshCw, X } from 'lucide-react';

const STORAGE_KEY = 'custodia_portfolio_state_v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('growth_bot');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const [portfolio, setPortfolio] = useState<Portfolio>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load portfolio from localStorage, resetting to default', e);
    }
    return PortfolioEngine.getInitialPortfolio();
  });

  // Modals state
  const [tradeModalAsset, setTradeModalAsset] = useState<Asset | null>(null);
  const [tradeModalDefaultType, setTradeModalDefaultType] = useState<'BUY' | 'SELL'>('BUY');
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [isMyInvestorModalOpen, setIsMyInvestorModalOpen] = useState<boolean>(false);
  
  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    } catch (e) {
      console.error('Failed to save portfolio to localStorage', e);
    }
  }, [portfolio]);

  const handleResetPortfolio = () => {
    const fresh = PortfolioEngine.getInitialPortfolio();
    setPortfolio(fresh);
    showToast('Cartera y simulación reiniciadas a 100,00 € de capital inicial.');
  };

  const handleOpenTradeModal = (asset: Asset, defaultType: 'BUY' | 'SELL' = 'BUY') => {
    setTradeModalAsset(asset);
    setTradeModalDefaultType(defaultType);
  };

  const handleConfirmOrder = (order: SimulatedOrder, asset: Asset) => {
    const updated = PortfolioEngine.executeOrder(portfolio, order, asset);
    setPortfolio(updated);
    showToast(`Operación simulada: ${order.orderType === 'BUY' ? 'Compra' : 'Venta'} de ${order.amountEur.toFixed(2)} € en ${asset.name}`);
  };

  const handleExtractCapitalToVault = () => {
    const updated = LiveSimulationEngine.executeCapitalExtraction(portfolio, ALL_AVAILABLE_ASSETS);
    setPortfolio(updated);
    showToast('🎯 ¡100,00 € de Capital Inicial extraídos a la Bóveda con éxito! Ahora operas con riesgo cero.');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans relative pb-16 md:pb-0">
      
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        portfolio={portfolio}
        onResetPortfolio={handleResetPortfolio}
        onOpenLegalDisclaimer={() => setIsLegalModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* Active Tab View Rendering */}
        {activeTab === 'growth_bot' && (
          <GrowthTradingBot
            portfolio={portfolio}
            onExecuteOrder={handleConfirmOrder}
            onExtractCapitalToVault={handleExtractCapitalToVault}
            onResetPortfolio={handleResetPortfolio}
          />
        )}

        {activeTab === 'backtest_lab' && (
          <BacktestCenter />
        )}

        {activeTab === 'dashboard' && (
          <PortfolioOverview
            portfolio={portfolio}
            onOpenTradeModal={handleOpenTradeModal}
            onOpenMyInvestorBridge={() => setIsMyInvestorModalOpen(true)}
            onGoToRiskCenter={() => setActiveTab('risk_center')}
          />
        )}

        {activeTab === 'market' && (
          <MarketTracker
            onOpenTradeModal={handleOpenTradeModal}
          />
        )}

        {activeTab === 'risk_center' && (
          <RiskAnalysisCenter
            portfolio={portfolio}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsManager
            portfolio={portfolio}
          />
        )}

        {activeTab === 'education' && (
          <EducationalHub />
        )}

        {activeTab === 'architecture_docs' && (
          <ArchitectureViewer />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0f172a] py-6 text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold text-slate-200">Custodia · Simulación en Tiempo Real & Bot 2X</span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-400 font-mono text-[11px]">Base: 100,00 € → Objetivo: 200,00 €</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[11px]">
            <button
              onClick={() => setIsLegalModalOpen(true)}
              className="hover:text-slate-200 underline cursor-pointer transition-colors"
            >
              Aviso MiFID II & CNMV
            </button>
            <span className="text-slate-600">·</span>
            <button
              onClick={() => setIsMyInvestorModalOpen(true)}
              className="hover:text-slate-200 underline cursor-pointer transition-colors"
            >
              Conector MyInvestor PSD2
            </button>
            <span className="text-slate-600">·</span>
            <button
              onClick={() => setActiveTab('architecture_docs')}
              className="text-slate-300 hover:text-white font-medium cursor-pointer transition-colors"
            >
              Documentación Técnica
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0f172a]/95 border-t border-slate-800 px-1.5 py-1 backdrop-blur-md">
        <div className="grid grid-cols-5 gap-1 text-center">
          <button
            onClick={() => setActiveTab('growth_bot')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'growth_bot'
                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400 mb-0.5 animate-pulse" />
            <span className="text-[10px] font-medium">Bot 2X</span>
          </button>

          <button
            onClick={() => setActiveTab('backtest_lab')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'backtest_lab'
                ? 'bg-indigo-600/30 border border-indigo-500/60 text-indigo-200 font-bold'
                : 'text-indigo-400/80 hover:text-indigo-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-indigo-400 mb-0.5" />
            <span className="text-[10px] font-medium">Backtest</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-slate-800 text-white font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-400 mb-0.5" />
            <span className="text-[10px] font-medium">Cartera</span>
          </button>

          <button
            onClick={() => setActiveTab('risk_center')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'risk_center'
                ? 'bg-slate-800 text-white font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400 mb-0.5" />
            <span className="text-[10px] font-medium">Riesgo</span>
          </button>

          <button
            onClick={() => setIsMobileMoreOpen(true)}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors cursor-pointer ${
              ['market', 'alerts', 'education', 'architecture_docs'].includes(activeTab)
                ? 'bg-slate-800 text-white font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MoreHorizontal className="w-4 h-4 text-slate-300 mb-0.5" />
            <span className="text-[10px] font-medium">Más...</span>
          </button>
        </div>
      </div>

      {/* Mobile More Sheet */}
      {isMobileMoreOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150">
          <div className="bg-[#0f172a] border-t border-slate-800 rounded-t-2xl p-4 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white">Todos los Módulos de Custodia</span>
              </div>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setActiveTab('growth_bot');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  activeTab === 'growth_bot'
                    ? 'bg-amber-500/20 border-amber-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-300">
                  <Zap className="w-4 h-4" />
                  Bot 2X Tiempo Real
                </div>
                <span className="text-[10px] text-slate-400">Meta 100€ → 200€ y Trailing Stop</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('backtest_lab');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  activeTab === 'backtest_lab'
                    ? 'bg-indigo-900/40 border-indigo-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-300">
                  <TrendingUp className="w-4 h-4" />
                  Backtesting Lab
                </div>
                <span className="text-[10px] text-slate-400">Sharpe, Sortino, Walk-Forward</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-800 border-emerald-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-300">
                  <Layers className="w-4 h-4" />
                  Mi Cartera
                </div>
                <span className="text-[10px] text-slate-400">Valuación y asignación</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('risk_center');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  activeTab === 'risk_center'
                    ? 'bg-slate-800 border-amber-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-300">
                  <ShieldCheck className="w-4 h-4" />
                  Control de Riesgo
                </div>
                <span className="text-[10px] text-slate-400">Calculadora Kelly & Estrés</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('market');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  activeTab === 'market'
                    ? 'bg-slate-800 border-sky-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-sky-300">
                  <TrendingUp className="w-4 h-4" />
                  Mercado & Fondos
                </div>
                <span className="text-[10px] text-slate-400">Cotizaciones & ISIN</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('alerts');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  activeTab === 'alerts'
                    ? 'bg-slate-800 border-rose-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-rose-300">
                  <Bell className="w-4 h-4" />
                  Alertas de Precio
                </div>
                <span className="text-[10px] text-slate-400">Triggers y avisos</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('education');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  activeTab === 'education'
                    ? 'bg-slate-800 border-teal-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-teal-300">
                  <BookOpen className="w-4 h-4" />
                  Academia
                </div>
                <span className="text-[10px] text-slate-400">Píldoras y fiscalidad</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('architecture_docs');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  activeTab === 'architecture_docs'
                    ? 'bg-slate-800 border-indigo-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-300">
                  <Cpu className="w-4 h-4" />
                  Arquitectura
                </div>
                <span className="text-[10px] text-slate-400">Docs técnicos & FinRL</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  handleResetPortfolio();
                  setIsMobileMoreOpen(false);
                }}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reiniciar Cartera a 100€
              </button>

              <button
                onClick={() => {
                  setIsLegalModalOpen(true);
                  setIsMobileMoreOpen(false);
                }}
                className="text-slate-400 underline text-[11px]"
              >
                Aviso MiFID II
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {tradeModalAsset && (
        <PaperTradingModal
          asset={tradeModalAsset}
          portfolio={portfolio}
          defaultType={tradeModalDefaultType}
          onClose={() => setTradeModalAsset(null)}
          onConfirmOrder={handleConfirmOrder}
        />
      )}

      {isLegalModalOpen && (
        <LegalTaxDisclaimerModal
          onClose={() => setIsLegalModalOpen(false)}
        />
      )}

      {isMyInvestorModalOpen && (
        <MyInvestorModal
          portfolio={portfolio}
          onClose={() => setIsMyInvestorModalOpen(false)}
          onExecuteManualOrder={handleConfirmOrder}
        />
      )}

      {/* Floating Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-16 md:bottom-6 left-3 right-3 md:left-auto md:right-6 z-50 bg-slate-900 border border-emerald-500/50 text-white px-3.5 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs">{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
