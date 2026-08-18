import React, { useState } from 'react';
import { Asset, Portfolio, SimulatedOrder } from '../types';
import { RiskEngine } from '../services/riskEngine';
import { PortfolioEngine } from '../services/portfolioEngine';
import { X, ShieldCheck, AlertTriangle, CheckCircle2, Lock, ArrowRight, ShieldAlert, Sparkles, Scale } from 'lucide-react';

interface PaperTradingModalProps {
  asset: Asset;
  portfolio: Portfolio;
  defaultType?: 'BUY' | 'SELL';
  onClose: () => void;
  onConfirmOrder: (order: SimulatedOrder, asset: Asset) => void;
}

export const PaperTradingModal: React.FC<PaperTradingModalProps> = ({
  asset,
  portfolio,
  defaultType = 'BUY',
  onClose,
  onConfirmOrder
}) => {
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>(defaultType);
  const [amountEur, setAmountEur] = useState<number>(10);
  const [hasConfirmedChecklist, setHasConfirmedChecklist] = useState<boolean>(false);
  const [isFinalStep, setIsFinalStep] = useState<boolean>(false);

  // Existing position
  const currentPosition = portfolio.positions.find(p => p.assetId === asset.id);
  const maxSellEur = currentPosition ? currentPosition.currentValuation : 0;

  // Validation
  const validation = RiskEngine.validateTrade(portfolio, asset, amountEur, orderType);
  const sharesCalculated = amountEur / asset.currentPrice;

  const handleProceedToFinalConfirm = () => {
    if (!validation.isValid) return;
    setIsFinalStep(true);
  };

  const handleFinalExecute = () => {
    if (!validation.isValid || !hasConfirmedChecklist) return;

    const simulatedOrder: SimulatedOrder = {
      id: 'ord_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
      assetId: asset.id,
      assetName: asset.name,
      orderType,
      amountEur,
      shares: sharesCalculated,
      quotedPrice: asset.currentPrice,
      executionPrice: asset.currentPrice,
      latencyMs: 380,
      slippagePct: 0.02,
      status: 'EXECUTED',
      riskValidationPassed: true,
      validationErrors: [],
      userConfirmed: true,
      notes: `TER: ${asset.ter}% · Ejecución Paper Trading`
    };

    onConfirmOrder(simulatedOrder, asset);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-modal rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 rounded-xl glass border border-white/10 text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base">Simulador Paper Trading</h3>
                <span className="text-[9px] sm:text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  Sin Dinero Real
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400">Protección y control de riesgo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white glass hover:bg-white/15 transition-colors cursor-pointer border border-white/10"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          
          {/* Asset Summary Banner */}
          <div className="p-4 rounded-2xl glass-panel flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {asset.categoryLabel} · Riesgo CNMV {asset.riskLevel}/7
              </span>
              <h4 className="font-bold text-white text-base mt-0.5">{asset.name}</h4>
              <div className="text-xs font-mono text-slate-400 mt-0.5">ISIN: {asset.isin}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase text-slate-400">Precio / NAV</div>
              <div className="font-bold font-mono text-white text-base">{asset.currentPrice.toFixed(2)} €</div>
              <div className="text-[10px] font-mono text-amber-400">TER: {asset.ter}%/año</div>
            </div>
          </div>

          {!isFinalStep ? (
            /* Step 1: Configuration & Risk Validation */
            <div className="space-y-4">
              
              {/* Buy / Sell Tabs with Frosted Glass */}
              <div className="grid grid-cols-2 gap-2 p-1 glass-panel rounded-xl">
                <button
                  onClick={() => setOrderType('BUY')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    orderType === 'BUY'
                      ? 'bg-emerald-600/90 text-white shadow-md border border-emerald-400/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Comprar / Suscribir
                </button>
                <button
                  onClick={() => setOrderType('SELL')}
                  disabled={!currentPosition || currentPosition.shares <= 0}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    orderType === 'SELL'
                      ? 'bg-rose-600/90 text-white shadow-md border border-rose-400/50'
                      : 'text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                >
                  Vender / Reembolsar
                </button>
              </div>

              {/* Amount input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300 font-semibold">Importe a simular (€):</label>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {orderType === 'BUY' 
                      ? `Disponible: ${portfolio.cashBalance.toFixed(2)} €` 
                      : `En cartera: ${maxSellEur.toFixed(2)} €`}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="5"
                    max={orderType === 'BUY' ? portfolio.cashBalance : maxSellEur}
                    value={amountEur}
                    onChange={(e) => setAmountEur(Math.max(1, Number(e.target.value)))}
                    className="w-full glass-input rounded-xl px-4 py-2.5 font-mono text-base font-bold text-white focus:outline-none focus:border-indigo-400/60"
                  />
                  <span className="absolute right-4 top-2.5 text-slate-400 font-mono text-sm">EUR</span>
                </div>

                {/* Quick preset buttons */}
                <div className="flex gap-2">
                  {[5, 10, 20, 30].map(val => (
                    <button
                      key={val}
                      onClick={() => setAmountEur(val)}
                      className="px-2.5 py-1 rounded-lg glass text-slate-300 hover:text-white hover:bg-white/15 text-xs font-mono transition-colors cursor-pointer border border-white/10"
                    >
                      +{val}€
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculations breakdown */}
              <div className="p-3.5 glass-panel rounded-xl text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Participaciones calculadas:</span>
                  <span className="text-white font-bold">{sharesCalculated.toFixed(4)} partes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coste de gestión estimado anual:</span>
                  <span className="text-amber-400 font-bold">
                    {((amountEur * asset.ter) / 100).toFixed(3)} € / año
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Régimen fiscal aplicable:</span>
                  <span className="text-emerald-400 font-bold">Art. 94 LIRPF (Traspasable)</span>
                </div>
              </div>

              {/* Risk Engine Live Validation Feedback */}
              <div className={`p-4 rounded-2xl border text-xs space-y-1.5 backdrop-blur-md ${
                validation.isValid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm">
                  {validation.isValid ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Validación de Riesgo Aprobada</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Operación Bloqueada por Control de Riesgo</span>
                    </>
                  )}
                </div>
                <div className="space-y-1 mt-1">
                  {validation.isValid ? (
                    <p className="leading-relaxed">
                      La orden cumple con el colchón mínimo de liquidez del 20% y el límite de concentración máxima del 35%.
                    </p>
                  ) : (
                    validation.blockers.map((b, i) => (
                      <p key={i} className="leading-relaxed font-semibold">{b}</p>
                    ))
                  )}
                  {validation.warnings.map((w, i) => (
                    <p key={i} className="text-amber-300 text-[11px] leading-relaxed">⚠️ {w}</p>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            /* Step 2: Final Human-In-The-Loop Confirmation */
            <div className="space-y-4">
              
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2 backdrop-blur-md">
                <div className="font-bold flex items-center gap-2 text-amber-300 text-sm">
                  <Scale className="w-4 h-4" />
                  <span>Protocolo Obligatorio de Confirmación Explícita</span>
                </div>
                <p>
                  Conforme a los principios de <strong>No Ejecución Autónoma</strong>, esta plataforma exige tu validación manual consciente. Revisa el ticket de orden antes de confirmar:
                </p>
              </div>

              <div className="p-4 glass-panel rounded-2xl text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tipo de Orden:</span>
                  <span className="text-white font-bold">{orderType === 'BUY' ? 'SUSCRIPCIÓN (COMPRA)' : 'REEMBOLSO (VENTA)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fondo / Activo:</span>
                  <span className="text-white font-bold">{asset.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Importe Simulado:</span>
                  <span className="text-emerald-400 font-bold text-sm">{amountEur.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Participaciones:</span>
                  <span className="text-white font-bold">{sharesCalculated.toFixed(4)}</span>
                </div>
              </div>

              {/* Mandatory Checklist */}
              <div className="space-y-2.5 pt-2">
                <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasConfirmedChecklist}
                    onChange={(e) => setHasConfirmedChecklist(e.target.checked)}
                    className="mt-0.5 accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                  />
                  <span>
                    He verificado que esta orden cumple con mi plan de inversión conservador, mantiene mi colchón de liquidez intocable y entiendo que se trata de una <strong>simulación educativa</strong>.
                  </span>
                </label>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          {!isFinalStep ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 glass hover:bg-white/15 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-white/10"
              >
                Cancelar
              </button>
              <button
                id="btn-proceed-order"
                onClick={handleProceedToFinalConfirm}
                disabled={!validation.isValid}
                className="px-5 py-2 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer border border-emerald-400/50"
              >
                <span>Revisar y Confirmar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsFinalStep(false)}
                className="px-4 py-2 glass hover:bg-white/15 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-white/10"
              >
                Volver a Modificar
              </button>
              <button
                id="btn-final-confirm-order"
                onClick={handleFinalExecute}
                disabled={!hasConfirmedChecklist}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 cursor-pointer border border-emerald-400/50"
              >
                Confirmar Ejecución Simulada
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
