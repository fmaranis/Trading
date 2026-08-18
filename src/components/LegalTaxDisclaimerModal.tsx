import React from 'react';
import { X, ShieldAlert, AlertTriangle, Scale, BookOpen, ExternalLink, CheckCircle2 } from 'lucide-react';

interface LegalTaxDisclaimerModalProps {
  onClose: () => void;
}

export const LegalTaxDisclaimerModal: React.FC<LegalTaxDisclaimerModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-modal rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Aviso Legal, Regulatorio & Fiscal</h3>
              <p className="text-xs text-slate-400">Cumplimiento normativa CNMV y Directiva Europea MiFID II</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white glass hover:bg-white/15 transition-colors cursor-pointer border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-200 leading-relaxed">
          
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2 backdrop-blur-md">
            <div className="font-bold flex items-center gap-2 text-amber-300 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>1. Carácter Estrictamente Educativo y de Simulación (No Asesoramiento)</span>
            </div>
            <p>
              Esta plataforma es un software de simulación financiera, autocontrol de riesgo y monitorización de carteras. <strong>Bajo ningún concepto constituye un servicio de asesoramiento en materia de inversión</strong> regulado por la Comisión Nacional del Mercado de Valores (CNMV) conforme al artículo 140 del Real Decreto Legislativo 4/2015 de la Ley del Mercado de Valores.
            </p>
            <p>
              Las decisiones de inversión corresponden única y exclusivamente al usuario. Ninguna métrica mostrada garantiza rendimientos futuros. <strong>Rentabilidades pasadas no constituyen un indicador fiable de rentabilidades futuras.</strong>
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-panel space-y-2">
            <div className="font-bold flex items-center gap-2 text-slate-100 text-sm">
              <BookOpen className="w-4 h-4 text-teal-400" />
              <span>2. Régimen Fiscal en España (Art. 94 Ley IRPF)</span>
            </div>
            <p>
              La mención a la <em>traspasabilidad de fondos</em> se refiere a la normativa española que permite a las personas físicas residentes fiscales en España transferir su capital de un fondo de inversión a otro sin tributar por las plusvalías latentes hasta el momento del reembolso definitivo.
            </p>
            <div className="p-3 bg-white/[0.04] rounded-xl border border-white/10 text-[11px] text-slate-300">
              ⚠️ <strong>Recordatorio Fiscal:</strong> La fiscalidad aplicable depende de la situación individual de cada inversor y puede verse modificada en el futuro. Te recomendamos consultar siempre a un profesional fiscal o a la Agencia Tributaria antes de tomar decisiones impositivas.
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-panel space-y-2">
            <div className="font-bold flex items-center gap-2 text-slate-100 text-sm">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>3. Integración con Entidades Financieras (MyInvestor / Inversis)</span>
            </div>
            <p>
              La conexión con brokers o entidades bancarias se realiza de acuerdo estricto con los estándares de <strong>Open Banking (PSD2)</strong> y únicamente mediante APIs oficiales públicas y autorizadas. La plataforma nunca solicitará, interceptará ni almacenará tus credenciales de acceso a banca digital.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 cursor-pointer border border-emerald-400/50"
          >
            He leído y comprendido el aviso legal
          </button>
        </div>

      </div>
    </div>
  );
};
