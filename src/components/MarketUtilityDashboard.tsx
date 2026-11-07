import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { EodhdCrossValidationResult } from '../investment/data/marketData/eodhdCrossValidation';
import {
  applyTaxAwareExecutionOverlay,
  buildH2CapitalMobilityReadout,
  AssetUniverseScanResult,
  buildPortfolioExecutionPlan,
  CashBenchmarkService,
  evaluatePortfolioDecision,
  getMyInvestorAvailability,
  InvestmentDecisionResult,
  MYINVESTOR_AVAILABILITY_UPDATED_EVENT,
  SPANISH_TAX_SETTINGS_UPDATED_EVENT,
  SpanishTaxSettingsService,
  TaxLotLedgerService,
  UserPortfolioService,
  type UserHolding,
  type PortfolioExecutionPlan,
  type PortfolioPositionHealthResult
} from '../investment/decision';
import { downloadJsonFile } from '../jsonDownload';
import { CurrentOpportunityAlertsPanel } from './CurrentOpportunityAlertsPanel';
import { UserPortfolioPanel } from './UserPortfolioPanel';
import { PortfolioExecutionPlanPanel } from './PortfolioExecutionPlanPanel';
import { RealPurchaseRegistrationPanel } from './RealPurchaseRegistrationPanel';
import { StrategyConsensusPanel } from './StrategyConsensusPanel';
import { PilotOperationsPanel } from './PilotOperationsPanel';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  eodhdValidation: EodhdCrossValidationResult | null;
  positionHealth: PortfolioPositionHealthResult | null;
  onInspectAsset?: (symbolOrIsin: string) => void;
}

function applyBrokerAvailabilityOverlay(plan: PortfolioExecutionPlan, scan: AssetUniverseScanResult): PortfolioExecutionPlan {
  let blocked = 0;
  const lines = plan.lines.map(line => {
    if (!['BUY_ETF', 'SUBSCRIBE_FUND', 'TRANSFER_FUND'].includes(line.action)) return line;
    const candidate = scan.candidates.find(row =>
      (!!line.targetAssetId && row.asset.assetId === line.targetAssetId)
      || (!!line.targetTicker && row.asset.ticker.toUpperCase() === line.targetTicker.toUpperCase())
      || (!!line.targetIsin && row.asset.isin?.toUpperCase() === line.targetIsin.toUpperCase())
    );
    if (!candidate || getMyInvestorAvailability(candidate.asset).status !== 'USER_CONFIRMED_UNAVAILABLE') return line;
    blocked += 1;
    return {
      ...line,
      action: 'REVIEW' as const,
      instruction: `No ejecutar ${line.targetTicker ?? line.targetName ?? 'esta compra'}: el instrumento está marcado por ti como no disponible en MyInvestor.`,
      rationale: `${line.rationale} [BROKER_USER_CONFIRMED_UNAVAILABLE] La señal de inversión se conserva como evidencia, pero no existe una orden ejecutable mientras mantengas esta marca.`
    };
  });
  if (blocked === 0) return plan;
  return { ...plan, lines, warnings: [...plan.warnings, `BROKER_USER_CONFIRMED_UNAVAILABLE:${blocked}`] };
}

export const MarketUtilityDashboard: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  const [taxRevision, setTaxRevision] = useState(0);
  const [brokerRevision, setBrokerRevision] = useState(0);
  // Explicit local-only research opt-in; never stored or sent to the backend.
  const [h2ResearchEnabled, setH2ResearchEnabled] = useState(false);
  const cashBenchmarkAnnualPct = CashBenchmarkService.load();
  // A portfolio save in the parent triggers a fresh positionHealth object before
  // this dashboard becomes actionable again. Memoizing the load prevents an
  // unrelated child render from rebuilding Date.now()-based execution-line IDs.
  const portfolio = useMemo(() => UserPortfolioService.load(), [positionHealth, decision.asOfDate]);

  useEffect(() => {
    const refreshTax = () => setTaxRevision(value => value + 1);
    const refreshBroker = () => setBrokerRevision(value => value + 1);
    window.addEventListener(SPANISH_TAX_SETTINGS_UPDATED_EVENT, refreshTax as EventListener);
    window.addEventListener(MYINVESTOR_AVAILABILITY_UPDATED_EVENT, refreshBroker as EventListener);
    return () => {
      window.removeEventListener(SPANISH_TAX_SETTINGS_UPDATED_EVENT, refreshTax as EventListener);
      window.removeEventListener(MYINVESTOR_AVAILABILITY_UPDATED_EVENT, refreshBroker as EventListener);
    };
  }, []);

  const portfolioDecision = useMemo(() => evaluatePortfolioDecision({
    portfolio,
    scan,
    decision,
    positionHealth: positionHealth?.byKey,
    cashBenchmarkAnnualPct,
    researchReachTrace: h2ResearchEnabled
  }), [portfolio, scan, decision, positionHealth, cashBenchmarkAnnualPct, h2ResearchEnabled]);

  const h2Readout = useMemo(() => {
    if (!h2ResearchEnabled || !portfolioDecision.researchReachTrace) return null;
    // Read only existing private FIFO coverage; do not expose lots, costs or
    // tax amounts in the research readout. Mutual funds remain UNKNOWN.
    const fiscalCoverageByAssetId: Record<string, 'FIFO_TRACKED' | 'UNKNOWN'> = {};
    const holdingsByTicker = new Map<string, UserHolding>(
      portfolio.holdings.map((row): [string, UserHolding] => [row.ticker.toUpperCase(), row])
    );
    for (const pair of portfolioDecision.researchReachTrace.capitalMobilityShadow?.potentialPairs ?? []) {
      const incumbent = scan.candidates.find(row => row.asset.assetId === pair.incumbentAssetId);
      const ticker = incumbent?.asset.ticker.toUpperCase();
      const holding = ticker ? holdingsByTicker.get(ticker) : undefined;
      fiscalCoverageByAssetId[pair.incumbentAssetId] = holding && ticker
        && TaxLotLedgerService.fifoCostBasis(ticker, holding.shares, holding.shares).precision === 'FIFO_TRACKED'
        ? 'FIFO_TRACKED' : 'UNKNOWN';
    }
    return buildH2CapitalMobilityReadout({
      informationDate: decision.asOfDate,
      portfolioDecision,
      fiscalCoverageByAssetId
    });
  }, [h2ResearchEnabled, portfolioDecision, portfolio, scan, decision.asOfDate, taxRevision]);

  const executionPlan = useMemo(() => {
    const raw = buildPortfolioExecutionPlan({
      portfolio,
      scan,
      decisionAsOf: decision.asOfDate,
      portfolioDecision,
      cashBenchmarkAnnualPct
    });
    const healthEntries = Object.entries(positionHealth?.byKey ?? {}) as Array<[string, PortfolioPositionHealthResult['positions'][number]]>;
    const currentValueByKey = Object.fromEntries(healthEntries.map(([key, health]) => [key, health.currentValueEur ?? null]));
    const taxAware = applyTaxAwareExecutionOverlay({
      plan: raw,
      portfolio,
      portfolioDecision,
      scan,
      horizonYears: decision.horizonYears,
      taxSettings: SpanishTaxSettingsService.load(),
      currentValueByKey
    });
    return applyBrokerAvailabilityOverlay(taxAware, scan);
  }, [portfolio, scan, decision.asOfDate, decision.horizonYears, portfolioDecision, cashBenchmarkAnnualPct, positionHealth, taxRevision, brokerRevision]);

  return <section className="space-y-4">
    {/* One canonical portfolio decision plus one canonical executable plan. */}
    <CurrentOpportunityAlertsPanel scan={scan} decision={decision} portfolioDecision={portfolioDecision} executionPlan={executionPlan} onInspectAsset={onInspectAsset} />

    {/* Registration is derived from the exact executable plan shown above. */}
    <RealPurchaseRegistrationPanel scan={scan} executionPlan={executionPlan} />

    {/* Actual portfolio state reuses the same canonical decision; edits stay drafts until saved. */}
    <UserPortfolioPanel scan={scan} portfolioDecision={portfolioDecision} positionHealth={positionHealth} onInspectAsset={onInspectAsset} />

    {/* Historical/pilot bookkeeping is secondary and cannot create a headline recommendation. */}
    <details className="rounded-2xl border border-violet-500/15 bg-slate-900/50 p-4">
      <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-3">
        <div><div className="font-bold text-white">Seguimiento operativo e historial</div><div className="mt-1 text-[10px] text-slate-500">Archiva la misma decisión/plan, disponibilidad MyInvestor y operaciones registradas. No genera una segunda decisión.</div></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500"/>
      </summary>
      <div className="mt-4"><PilotOperationsPanel scan={scan} decision={decision} portfolioDecision={portfolioDecision} executionPlan={executionPlan} positionHealth={positionHealth} onInspectAsset={onInspectAsset} /></div>
    </details>

    <details className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-3">
        <div><div className="font-bold text-white">Controles y detalle de ejecución</div><div className="mt-1 text-[10px] text-slate-500">Consenso, fiscalidad, broker y plan operativo del mismo resultado. Los ajustes de ejecución pueden aplazar una orden, pero no crean otra estrategia.</div></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500"/>
      </summary>
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-slate-700 p-3 text-xs text-slate-300">
          <div className="font-semibold text-slate-100">H2 · movilidad del capital (investigación)</div>
          <p className="mt-1 text-slate-400">Diagnóstico opcional de la misma decisión. No propone ventas, no abre resultados futuros y no guarda datos automáticamente.</p>
          <button type="button" className="mt-2 rounded-md border border-slate-600 px-3 py-2 text-slate-100"
            onClick={() => setH2ResearchEnabled(value => !value)}>
            {h2ResearchEnabled ? 'Desactivar diagnóstico H2' : 'Activar diagnóstico H2 (solo local)'}
          </button>
          {h2Readout && <div className="mt-2 space-y-1">
            <p>Fecha de información: {h2Readout.informationDate}. Pares: {h2Readout.pairCount}; fuente REAL en ambos extremos: {h2Readout.realProvenancePairs}; cobertura FIFO conocida: {h2Readout.fifoCoveredPairs}.</p>
            <p>Resultado económico neto: N/D. Las diferencias de momentum no son rentabilidad prevista.</p>
            <p>Entradas nuevas permitidas: {h2Readout.newPositionDecisionLimit}. Despliegue inicial ampliado: {h2Readout.bootstrapDeploymentActive ? 'sí' : 'no'}.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-[11px]">
                <thead><tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-1 pr-2">Oportunidad</th>
                  <th className="py-1 pr-2">Ranking</th>
                  <th className="py-1 pr-2">Prioridad</th>
                  <th className="py-1 pr-2">Timing</th>
                  <th className="py-1 pr-2">Vol. anual</th>
                  <th className="py-1 pr-2">Propuesta</th>
                  <th className="py-1">Motivo</th>
                </tr></thead>
                <tbody>{h2Readout.opportunityAllocationAudit.map(row => <tr key={row.assetId} className="border-b border-slate-800">
                  <td className="py-1 pr-2">{row.ticker}</td>
                  <td className="py-1 pr-2">{row.rankingScore.toFixed(2)}</td>
                  <td className="py-1 pr-2">{row.allocationPriority.toFixed(2)}</td>
                  <td className="py-1 pr-2">{row.timingState}</td>
                  <td className="py-1 pr-2">{row.annualizedVolatilityPct == null ? 'N/D' : `${row.annualizedVolatilityPct.toFixed(1)}%`}</td>
                  <td className="py-1 pr-2">{row.plannedAmountEur.toFixed(2)} €</td>
                  <td className="py-1">{row.fundingReason}{row.targetGapEur != null && row.minimumMeaningfulGapEur != null ? ` · gap ${row.targetGapEur.toFixed(2)} € / mínimo ${row.minimumMeaningfulGapEur.toFixed(2)} €` : ''}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <p className="text-slate-500">Ranking y prioridad son medidas actuales, no rentabilidad futura. Un gap N/D significa que la evaluación quedó bloqueada antes de calcularlo.</p>
            <button type="button" className="mt-1 rounded-md border border-slate-600 px-3 py-2 text-slate-100"
              onClick={() => downloadJsonFile(`h2-research-${h2Readout.informationDate.slice(0, 10)}.json`, h2Readout)}>
              Descargar evidencia H2 en este dispositivo
            </button>
            <p className="text-slate-500">El JSON puede incluir identificadores y valores de posiciones. No se envía a GitHub ni a otros usuarios mediante este botón.</p>
          </div>}
        </div>
        <StrategyConsensusPanel scan={scan} />
        <PortfolioExecutionPlanPanel scan={scan} executionPlan={executionPlan} onInspectAsset={onInspectAsset} />
      </div>
    </details>
  </section>;
};
