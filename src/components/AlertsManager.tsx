import React, { useState } from 'react';
import { Portfolio, AlertRule } from '../types';
import { INITIAL_ALERT_RULES } from '../data/marketData';
import { Bell, ShieldAlert, CheckCircle2, Sliders, Sparkles, AlertCircle } from 'lucide-react';

interface AlertsManagerProps {
  portfolio: Portfolio;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({ portfolio }) => {
  const [alerts, setAlerts] = useState<AlertRule[]>(INITIAL_ALERT_RULES);
  const [simulatedTriggered, setSimulatedTriggered] = useState<string | null>(null);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const handleSimulateAlert = (id: string) => {
    setSimulatedTriggered(id);
    setTimeout(() => {
      setSimulatedTriggered(null);
    }, 5000);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Header */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-300 mb-1">
              <Bell className="w-4 h-4 text-rose-400" />
              <span>Sistema Preventivo & Control Emocional</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Alertas & Recordatorios Prudenciales
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Diseñado para proteger la psicología del inversor. Sin avisos ruidosos ni notificaciones tóxicas de volatilidad intradiaria. Solo avisos de desviación de reglas.
            </p>
          </div>

          <div className="glass-panel p-3 rounded-xl sm:rounded-2xl text-xs shrink-0">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider">Política Anti-Spam</div>
            <div className="font-bold text-emerald-400 mt-0.5 text-xs sm:text-sm">Máximo 1 aviso al día</div>
            <div className="text-[10px] text-slate-400">Evita el sobre-operar por impulso</div>
          </div>
        </div>
      </div>

      {/* Simulated Live Alert Banner if triggered */}
      {simulatedTriggered && (
        <div className="p-3.5 sm:p-4 bg-amber-500/15 border border-amber-500/40 rounded-xl sm:rounded-2xl flex items-start gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-white text-xs sm:text-sm">
              Notificación Disparada (Simulación)
            </div>
            <p className="text-xs text-amber-200 mt-1 leading-relaxed">
              {alerts.find(a => a.id === simulatedTriggered)?.message}
            </p>
            <div className="mt-2 text-[11px] text-slate-300">
              <strong>Acción sugerida:</strong> Revisa tu colchón de liquidez antes de ejecutar cualquier movimiento. No actúes por impulso.
            </div>
          </div>
        </div>
      )}

      {/* Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border transition-all flex flex-col justify-between ${
              alert.active
                ? 'glass-card border-white/10'
                : 'bg-white/[0.02] border-white/5 opacity-60 backdrop-blur-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  alert.severity === 'high'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : alert.severity === 'medium'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                }`}>
                  {alert.severity === 'high' ? 'Riesgo Crítico' : alert.severity === 'medium' ? 'Aviso Preventivo' : 'Informativo'}
                </span>

                {/* Enable/Disable Toggle Switch */}
                <button
                  onClick={() => toggleAlert(alert.id)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    alert.active ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      alert.active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <h4 className="font-bold text-white text-xs sm:text-sm font-mono text-indigo-300 mb-1">
                [{alert.type}]
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed">{alert.message}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-mono text-slate-400">
                Umbral: <strong className="text-slate-200">{alert.threshold}%</strong> ({alert.comparison})
              </span>

              <button
                onClick={() => handleSimulateAlert(alert.id)}
                className="px-3 py-1 text-xs text-indigo-300 hover:text-white glass hover:bg-white/15 rounded-xl border border-white/10 transition-colors cursor-pointer min-h-[32px]"
              >
                Probar Disparo
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Psychology of Risk Box */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm sm:text-base">Estrategia Psicológica de Inversión</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              El 90% de los errores en inversores principiantes ocurren por sobrerreaccionar a noticias de prensa económica o fluctuaciones normales de corto plazo. Custodia filtra el ruido y te entrena para mantener el rumbo fijado sin alterar tu plan por pánico o euforia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
