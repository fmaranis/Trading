import React, { useState } from 'react';
import { Asset, Portfolio, SimulatedOrder } from '../types';
import { ALL_AVAILABLE_ASSETS, CONSERVATIVE_ASSETS, HIGH_GROWTH_MOMENTUM_ASSETS } from '../data/marketData';
import {
  X,
  Lock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  AlertCircle,
  Building2,
  KeyRound,
  TrendingUp,
  Percent,
  Sparkles,
  Search,
  ArrowRight,
  Info
} from 'lucide-react';

interface MyInvestorModalProps {
  portfolio: Portfolio;
  onClose: () => void;
  onExecuteManualOrder?: (order: SimulatedOrder, asset: Asset) => void;
}

export const MyInvestorModal: React.FC<MyInvestorModalProps> = ({
  portfolio,
  onClose,
  onExecuteManualOrder
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'conservative' | 'growth'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(CONSERVATIVE_ASSETS[0].id);
  const [copiedIsin, setCopiedIsin] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(30.0);
  const [showSignatureSim, setShowSignatureSim] = useState<boolean>(false);
  const [simulatedOtp, setSimulatedOtp] = useState<string>('MYINV-8492');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [orderConfirmed, setOrderConfirmed] = useState<boolean>(false);

  const filterAssets = () => {
    let list = selectedCategory === 'conservative' 
      ? CONSERVATIVE_ASSETS 
      : selectedCategory === 'growth' 
      ? HIGH_GROWTH_MOMENTUM_ASSETS 
      : ALL_AVAILABLE_ASSETS;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => 
        a.name.toLowerCase().includes(q) || 
        a.ticker.toLowerCase().includes(q) || 
        a.isin.toLowerCase().includes(q)
      );
    }
    return list;
  };

  const displayedAssets = filterAssets();
  const selectedAsset = ALL_AVAILABLE_ASSETS.find(a => a.id === selectedAssetId) || ALL_AVAILABLE_ASSETS[0];

  const handleCopyIsin = (isin: string) => {
    navigator.clipboard.writeText(isin);
    setCopiedIsin(isin);
    setTimeout(() => setCopiedIsin(null), 2000);
  };

  const handleStartSignature = () => {
    const newOtp = `MYINV-${Math.floor(1000 + Math.random() * 9000)}`;
    setSimulatedOtp(newOtp);
    setEnteredOtp('');
    setOrderConfirmed(false);
    setShowSignatureSim(true);
  };

  const handleCompleteOrder = () => {
    setOrderConfirmed(true);
    if (onExecuteManualOrder && selectedAsset) {
      const shares = customAmount / selectedAsset.currentPrice;
      const simOrder: SimulatedOrder = {
        id: `ord-myinv-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
        assetId: selectedAsset.id,
        assetName: selectedAsset.name,
        orderType: 'BUY',
        amountEur: customAmount,
        shares,
        quotedPrice: selectedAsset.currentPrice,
        executionPrice: selectedAsset.currentPrice,
        latencyMs: 420,
        slippagePct: 0.02,
        status: 'EXECUTED',
        riskValidationPassed: true,
        validationErrors: [],
        userConfirmed: true,
        triggerReason: 'MANUAL',
        notes: `🏦 [MyInvestor Asistido · Suscripción Manual] ISIN: ${selectedAsset.isin}`
      };
      onExecuteManualOrder(simOrder, selectedAsset);
    }
    setTimeout(() => {
      setShowSignatureSim(false);
      setOrderConfirmed(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-[#0b1329] border border-cyan-500/40 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl shadow-cyan-950/50 animate-in fade-in zoom-in-95 duration-200 text-slate-200">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#0e1d3e] via-[#102450] to-[#0a1835] px-6 py-4 border-b border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center font-black font-mono text-base shadow-inner">
              MI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base">Centro de Integración MyInvestor</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 font-bold uppercase tracking-wider">
                  Modo Asistido Simulado
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Fichas de Fondos y ETFs con ISIN Oficiales · Clean Share Classes (Sin Custodia)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
          
          {/* Status Alert Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-slate-900 border border-cyan-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">¿Cómo funciona el Modo Asistido con MyInvestor?</div>
              <p className="text-slate-300 mt-1 leading-relaxed text-xs">
                Por normativa europea de protección bancaria (PSD2 y autenticación fuerte SCA/2FA), los bancos regulados no disponen de APIs abiertas para ejecutar órdenes sin autorización del titular. 
                Esta aplicación actúa como tu <strong>asistente algorítmico inteligente</strong>: calcula la asignación, genera la ficha con el ISIN exacto y te permite simular la firma electrónica OTP con latencia real.
              </p>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({ALL_AVAILABLE_ASSETS.length})
              </button>
              <button
                onClick={() => setSelectedCategory('conservative')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'conservative' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Indexados Conservadores
              </button>
              <button
                onClick={() => setSelectedCategory('growth')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'growth' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                ETFs Growth 2X
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por ISIN o nombre..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Asset Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
            {displayedAssets.map(asset => (
              <button
                key={asset.id}
                onClick={() => setSelectedAssetId(asset.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  asset.id === selectedAssetId
                    ? 'bg-cyan-950/60 border-cyan-400/80 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs font-mono text-white">{asset.ticker}</span>
                  <span className="text-[10px] text-cyan-300 font-mono">TER: {asset.ter}%</span>
                </div>
                <div className="text-[11px] font-semibold text-slate-200 truncate">{asset.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">ISIN: {asset.isin}</div>
              </button>
            ))}
          </div>

          {/* Selected Order Ticket Generator */}
          <div className="p-5 rounded-3xl bg-slate-950 border border-cyan-500/30 space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="text-white font-sans font-bold">Ficha Oficial para MyInvestor</span>
              </div>
              <span className="text-emerald-400 font-sans font-bold text-[11px]">
                Clase Limpia · 0,00% Custodia
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Activo:</span>
                  <span className="text-white font-bold font-sans text-right truncate max-w-[200px]">{selectedAsset.name}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Código ISIN:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold">{selectedAsset.isin}</span>
                    <button
                      onClick={() => handleCopyIsin(selectedAsset.isin)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] transition-colors cursor-pointer border border-slate-700 flex items-center gap-1 font-sans"
                    >
                      {copiedIsin === selectedAsset.isin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedIsin === selectedAsset.isin ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Categoría:</span>
                  <span className="text-slate-200 font-sans">{selectedAsset.categoryLabel}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Comisión TER:</span>
                  <span className="text-emerald-400 font-sans font-semibold">{selectedAsset.ter}% anual</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Precio actual:</span>
                  <span className="text-white font-bold">{selectedAsset.currentPrice.toFixed(2)} €</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Importe a Suscribir:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      max={portfolio.cashBalance}
                      step="5"
                      value={customAmount}
                      onChange={e => setCustomAmount(Number(e.target.value))}
                      className="w-20 px-2 py-1 bg-slate-900 border border-cyan-500/40 rounded-lg text-right font-bold text-amber-300 text-xs focus:outline-none"
                    />
                    <span className="text-slate-300 font-sans">€</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Títulos estimados:</span>
                  <span className="text-slate-300 font-mono">{(customAmount / selectedAsset.currentPrice).toFixed(4)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Ventaja Fiscal:</span>
                  <span className="text-sky-300 font-sans text-[10px]">
                    {selectedAsset.isIndexFund ? 'Traspaso sin peaje fiscal' : 'Liquidación cotizada D+1'}
                  </span>
                </div>
              </div>
            </div>

            {/* Launch Simulated Assisted Signature Button */}
            {!showSignatureSim ? (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400 font-sans">
                  Prueba la experiencia de firmar esta orden mediante el asistente.
                </div>
                <button
                  onClick={handleStartSignature}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs font-sans shadow-md shadow-cyan-500/20 cursor-pointer transition-all"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-950" />
                  <span>Simular Suscripción Asistida (2FA)</span>
                </button>
              </div>
            ) : (
              /* Inline Simulated Signature Workflow */
              <div className="mt-3 p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-sans font-bold text-white">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-cyan-400" />
                    <span>Confirmación de Orden MyInvestor (2FA OTP)</span>
                  </div>
                  <button
                    onClick={() => setShowSignatureSim(false)}
                    className="text-slate-400 hover:text-slate-200 text-[10px] underline cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex items-center justify-between w-full sm:w-auto flex-1 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 font-mono text-xs">
                    <span className="text-slate-500">Clave SMS:</span>
                    <span className="text-cyan-300 font-bold tracking-widest">{simulatedOtp}</span>
                    <button
                      onClick={() => setEnteredOtp(simulatedOtp)}
                      className="px-2 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-sans font-bold cursor-pointer transition-colors"
                    >
                      Rellenar
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Clave..."
                    value={enteredOtp}
                    onChange={e => setEnteredOtp(e.target.value.toUpperCase())}
                    className="w-full sm:w-32 px-3 py-2 bg-slate-900 border border-cyan-500/40 rounded-xl text-center text-xs font-mono font-bold text-white placeholder-slate-600 focus:outline-none"
                  />

                  <button
                    onClick={handleCompleteOrder}
                    disabled={orderConfirmed}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-sans rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
                  >
                    {orderConfirmed ? '¡Orden Confirmada!' : 'Firmar y Ejecutar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3 Step Instruction for Real MyInvestor Account */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2 text-[11px] text-slate-300">
            <div className="font-bold text-white text-xs flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>Cómo ejecutar esta orden en tu cuenta real de MyInvestor:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-sans">
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-400 text-xs">Paso 1</span>
                <p className="text-slate-300">Abre la app de MyInvestor y entra en el buscador de <strong>Fondos / ETFs</strong>.</p>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-400 text-xs">Paso 2</span>
                <p className="text-slate-300">Pega el código ISIN <strong>{selectedAsset.isin}</strong> en el buscador oficial.</p>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-400 text-xs">Paso 3</span>
                <p className="text-slate-300">Introduce el importe ({customAmount.toFixed(2)} €) y pulsa en <strong>Suscribir</strong> con tu clave 2FA.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#0a1024] flex items-center justify-between text-xs">
          <div className="text-[11px] text-slate-400">
            Entidad custodia: Andbank España (FGD 100.000 €).
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
          >
            Cerrar Pasarela
          </button>
        </div>

      </div>
    </div>
  );
};
