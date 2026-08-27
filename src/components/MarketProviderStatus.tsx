import React, { useEffect, useState } from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { AlphaVantageCrossValidationService, AlphaVantageStatus } from '../investment/data/marketData/alphaVantageCrossValidation';
import { EodhdCrossValidationService, EodhdStatus } from '../investment/data/marketData/eodhdCrossValidation';

export const MarketProviderStatus: React.FC = () => {
  const [alpha, setAlpha] = useState<AlphaVantageStatus | null>(null);
  const [eodhd, setEodhd] = useState<EodhdStatus | null>(null);

  useEffect(() => {
    void AlphaVantageCrossValidationService.getStatus().then(setAlpha).catch(() => setAlpha(null));
    void EodhdCrossValidationService.getStatus().then(setEodhd).catch(() => setEodhd(null));
  }, []);

  const badge = (configured: boolean | undefined, preferred = false) => configured
    ? `border-emerald-500/25 bg-emerald-500/10 text-emerald-300${preferred ? ' ring-1 ring-emerald-500/10' : ''}`
    : 'border-slate-700 bg-slate-950 text-slate-500';

  return (
    <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-sky-300" />
          <div>
            <div className="text-sm font-bold text-white">Fuentes de mercado REAL</div>
            <div className="text-[10px] text-slate-500">Las claves permanecen en backend; nunca se envían al navegador.</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-sky-300">Yahoo · PRINCIPAL ACTIVO</span>
          <span className={`rounded-full border px-3 py-1.5 ${badge(eodhd?.configured, true)}`}>EODHD · {eodhd?.configured ? 'VALIDADOR LISTO' : 'SIN CLAVE'}</span>
          <span className={`rounded-full border px-3 py-1.5 ${badge(alpha?.configured)}`}>Alpha · {alpha?.configured ? 'CONFIGURADO' : 'SIN CLAVE'}</span>
        </div>
      </div>
      {eodhd?.configured && <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> EODHD está disponible para validación cruzada no bloqueante.</div>}
    </section>
  );
};
