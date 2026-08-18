import React, { useState, useEffect } from 'react';
import { MyInvestorTicket, Asset } from '../types';
import {
  ShieldCheck,
  Lock,
  X,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  KeyRound,
  FileText,
  Building2,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';

interface MyInvestorAssistedSignatureModalProps {
  ticket: MyInvestorTicket;
  asset?: Asset;
  onConfirmSignature: (ticket: MyInvestorTicket, otpEntered: string) => void;
  onRejectSignature: (ticket: MyInvestorTicket) => void;
  onClose: () => void;
}

export const MyInvestorAssistedSignatureModal: React.FC<MyInvestorAssistedSignatureModalProps> = ({
  ticket,
  asset,
  onConfirmSignature,
  onRejectSignature,
  onClose
}) => {
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [copiedIsin, setCopiedIsin] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(180); // 3 minutes validity

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyIsin = () => {
    navigator.clipboard.writeText(ticket.isin);
    setCopiedIsin(true);
    setTimeout(() => setCopiedIsin(false), 2000);
  };

  const handleAutoFillOtp = () => {
    setEnteredOtp(ticket.otpCode);
  };

  const handleSignOrder = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onConfirmSignature(ticket, enteredOtp || ticket.otpCode);
    }, 450);
  };

  const isBuy = ticket.operationType === 'SUSCRIPCION';
  const isSell = ticket.operationType === 'REEMBOLSO';

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-[#0b1329] border border-cyan-500/40 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl shadow-cyan-950/50 animate-in fade-in zoom-in-95 duration-200 text-slate-200">
        
        {/* Top Header - MyInvestor Assisted Mode Branding */}
        <div className="bg-gradient-to-r from-[#0e1d3e] via-[#102450] to-[#0a1835] px-5 py-4 border-b border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold font-mono text-sm shadow-inner">
              MI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-extrabold text-sm tracking-wide">MyInvestor</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 font-bold uppercase tracking-wider">
                  Modo Asistido Simulado
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Firma de Orden Asistida · Andbank España S.A.U. (CNMV Nº 272)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto custom-scrollbar">
          
          {/* Signal Alert Banner */}
          <div className={`p-3.5 rounded-2xl border flex items-start gap-3 text-xs ${
            isBuy
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}>
            <div className={`p-2 rounded-xl shrink-0 ${
              isBuy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {isBuy ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
            <div className="space-y-1">
              <div className="font-bold text-white text-xs sm:text-sm flex items-center justify-between gap-2">
                <span>Señal del Bot: {ticket.triggerReason === 'MOMENTUM_ENTRY' ? '🚀 Entrada por Momentum Técnico' : ticket.triggerReason === 'TRAILING_STOP' ? '🛡️ Activación de Trailing Stop' : ticket.triggerReason === 'TAKE_PROFIT_2X' ? '💰 Toma de Beneficios' : '⚡ Señal Asistida'}</span>
                <span className="text-[10px] font-mono text-slate-400">{ticket.timestamp}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                {ticket.botNote}
              </p>
            </div>
          </div>

          {/* Operation Ticket Details */}
          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400 font-sans font-semibold">Tipo de Operación:</span>
              <span className={`px-2 py-0.5 rounded font-bold uppercase text-[11px] ${
                isBuy ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {ticket.operationType} ({ticket.isIndexFund ? 'Fondo Indexado' : 'ETF Cotizado'})
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-start">
                <span className="text-slate-400 font-sans">Activo / Fondo:</span>
                <span className="text-white font-bold font-sans text-right max-w-xs">{ticket.assetName}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Código ISIN:</span>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-300 font-bold">{ticket.isin}</span>
                  <button
                    onClick={handleCopyIsin}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors cursor-pointer border border-slate-700 flex items-center gap-1 font-sans"
                  >
                    {copiedIsin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIsin ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Importe de la Operación:</span>
                <span className="text-base font-black text-amber-300">{ticket.amountEur.toFixed(2)} €</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Precio Cotización / V.L.:</span>
                <span className="text-slate-200">{ticket.quotedPrice.toFixed(2)} €</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Participaciones Estimadas:</span>
                <span className="text-slate-200">{ticket.estimatedShares.toFixed(4)} títulos</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-[11px]">
                <span className="text-slate-400 font-sans">Comisión Gestión (TER):</span>
                <span className="text-emerald-400 font-sans font-semibold">
                  {ticket.ter}% anual · Clase Limpia (Sin Custodia)
                </span>
              </div>
            </div>
          </div>

          {/* 2FA / OTP Signature Box (Simulated) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-[#0b1329] border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-xs">Firma Electrónica de Seguridad (2FA)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                Válido: {formatSeconds(timeRemaining)}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              En MyInvestor real recibirías un SMS o notificación push en tu móvil para autorizar la orden. Para esta simulación, usa el código de firma generado:
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="flex items-center justify-between w-full sm:w-auto flex-1 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 font-mono text-sm">
                <span className="text-slate-500 text-xs">Clave SMS:</span>
                <span className="text-cyan-300 font-bold tracking-widest">{ticket.otpCode}</span>
                <button
                  onClick={handleAutoFillOtp}
                  className="px-2 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-sans font-bold cursor-pointer transition-colors"
                >
                  Auto-rellenar
                </button>
              </div>

              <input
                type="text"
                value={enteredOtp}
                onChange={e => setEnteredOtp(e.target.value.toUpperCase())}
                placeholder="Ingresar clave..."
                className="w-full sm:w-36 px-3 py-2 bg-slate-950 border border-cyan-500/40 rounded-xl text-center text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
          </div>

          {/* Legal / Tax Reminder Note */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              {ticket.isIndexFund 
                ? 'Régimen de Traspasos (Art. 94 Ley IRPF): Puedes mover plusvalías a otros fondos indexados en MyInvestor con diferimiento fiscal total (0% de IRPF al traspasar).'
                : 'Operación sobre ETF cotizado: Las plusvalías tributan al 19%-28% en base del ahorro únicamente en el momento de liquidar a efectivo.'}
            </p>
          </div>

        </div>

        {/* Action Buttons Footer */}
        <div className="px-5 py-4 bg-[#0a1024] border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => onRejectSignature(ticket)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            Rechazar Señal
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleSignOrder}
              disabled={isSubmitting}
              className="w-full sm:w-auto flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Transmitiendo orden a MyInvestor...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Firmar y Confirmar en MyInvestor</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
