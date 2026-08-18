import React, { useState } from 'react';
import { EDUCATIONAL_PILLS } from '../data/marketData';
import { BookOpen, HelpCircle, ShieldCheck, CheckCircle2, ArrowRight, AlertTriangle, Sparkles, Scale } from 'lucide-react';

export const EducationalHub: React.FC = () => {
  const [selectedPillId, setSelectedPillId] = useState<string>(EDUCATIONAL_PILLS[0].id);
  const activePill = EDUCATIONAL_PILLS.find(p => p.id === selectedPillId) || EDUCATIONAL_PILLS[0];

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Header with Frosted Glass */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-300 mb-1">
              <BookOpen className="w-4 h-4 text-teal-400" />
              <span>Academia de Inversión Prudente & Fiscalidad</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Píldoras Educativas de Preservación de Capital
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Aprende los fundamentos matemáticos de la inversión pasiva indexada, el impacto acumulativo de las comisiones (TER) y el régimen de traspasabilidad fiscal en España.
            </p>
          </div>

          <div className="glass-panel p-3 rounded-xl sm:rounded-2xl text-xs shrink-0">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider">Objetivo del Inversor</div>
            <div className="font-bold text-teal-300 mt-0.5 text-xs sm:text-sm">Independencia de Criterio</div>
            <div className="text-[10px] text-slate-400">Evitar errores de novato</div>
          </div>
        </div>
      </div>

      {/* Grid: Pills list + Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* Left Pills Menu */}
        <div className="lg:col-span-4 space-y-2 sm:space-y-2.5">
          {EDUCATIONAL_PILLS.map(pill => (
            <button
              key={pill.id}
              onClick={() => setSelectedPillId(pill.id)}
              className={`w-full text-left p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer ${
                pill.id === selectedPillId
                  ? 'glass-card border-teal-400/50 shadow-lg ring-1 ring-teal-400/30'
                  : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/15'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  {pill.tag}
                </span>
                <span className="text-slate-400 text-[10px] sm:text-[11px] font-mono">{pill.readTime}</span>
              </div>
              <h4 className="font-bold text-white text-xs sm:text-sm mt-2 leading-snug">{pill.title}</h4>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">{pill.summary}</p>
            </button>
          ))}
        </div>

        {/* Right Active Pill Reader */}
        <div className="lg:col-span-8 glass-card rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 sm:pb-4">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                {activePill.tag}
              </span>
              <span className="text-xs text-slate-400 font-mono">{activePill.readTime}</span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
              {activePill.title}
            </h3>

            <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-3 font-normal">
              {activePill.content}
            </div>

            {/* Key Takeaway Box */}
            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-teal-500/10 border border-teal-500/30 text-xs sm:text-sm text-teal-100 flex items-start gap-3 backdrop-blur-md">
              <Sparkles className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-teal-300">Conclusión Clave: </strong>
                <span>{activePill.keyTakeaway}</span>
              </div>
            </div>
          </div>

          {/* Legal / Risk Note */}
          <div className="pt-3 border-t border-white/10 flex items-start gap-2 text-[11px] text-slate-400">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{activePill.riskNote}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
