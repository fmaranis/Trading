import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { brokerCommission } from './costAwareExecutionPolicy';
import { CurrentOpportunityAlertEngine, type CurrentOpportunityAlert } from './currentOpportunityAlerts';
import type { PortfolioPositionHealthResult, PortfolioPositionHealthSnapshot } from './portfolioPositionHealth';
import {
  assessTaxAwareRotation,
  estimateFundRealizedGain,
  SpanishTaxSettingsService,
  TaxLotLedgerService,
  type TaxAwareRotationAssessment
} from './spanishTaxModel';
import type { UserPortfolioState } from './userPortfolio';

export type PortfolioRotationStatus = 'USE_LIQUIDITY_FIRST' | 'ROTATE_NOW' | 'KEEP' | 'NEEDS_TAX_DATA' | 'NO_DESTINATION';

export interface PortfolioRotationReview {
  sourceId: string | null;
  sourceLabel: string | null;
  sourceAction: PortfolioPositionHealthSnapshot['action'] | null;
  targetAssetId: string | null;
  targetTicker: string | null;
  targetName: string | null;
  targetLevel: CurrentOpportunityAlert['level'] | null;
  amountEur: number | null;
  status: PortfolioRotationStatus;
  assessment: TaxAwareRotationAssessment | null;
  reason: string;
}

function candidateFor(scan: AssetUniverseScanResult, key: string) {
  const normalized = key.toUpperCase();
  return scan.candidates.find(c => c.asset.assetId === key || c.asset.ticker.toUpperCase() === normalized || c.asset.isin?.toUpperCase() === normalized);
}

function sourceAnnualProxy(health: PortfolioPositionHealthSnapshot, cashBenchmarkAnnualPct: number): number | null {
  return health.excessVsCashPctPoints == null ? null : cashBenchmarkAnnualPct + health.excessVsCashPctPoints;
}

function bestDestination(scan: AssetUniverseScanResult, cashBenchmarkAnnualPct: number): CurrentOpportunityAlert | null {
  return CurrentOpportunityAlertEngine.evaluate(scan, cashBenchmarkAnnualPct)
    .find(alert => alert.level === 'HIGH_CONVICTION' || alert.level === 'GOOD_ENTRY') ?? null;
}

export class PortfolioRotationReviewEngine {
  static evaluate(input: {
    portfolio: UserPortfolioState;
    scan: AssetUniverseScanResult;
    positionHealth: PortfolioPositionHealthResult | null;
    cashBenchmarkAnnualPct: number;
    horizonYears: number;
  }): PortfolioRotationReview {
    const destination = bestDestination(input.scan, input.cashBenchmarkAnnualPct);
    if (!destination) return { sourceId: null, sourceLabel: null, sourceAction: null, targetAssetId: null, targetTicker: null, targetName: null, targetLevel: null, amountEur: null, status: 'NO_DESTINATION', assessment: null, reason: 'No hay hoy una entrada de alta convicción o buena oportunidad que justifique estudiar una rotación.' };

    const positions = input.positionHealth?.positions.filter(position => position.currentValueEur != null && position.currentValueEur > 0 && position.action !== 'ADD' && position.action !== 'EXIT' && position.action !== 'REDUCE') ?? [];
    const invested = positions.reduce((sum, position) => sum + (position.currentValueEur ?? 0), 0);
    const liquidity = Math.max(0, input.portfolio.cashEur) + Math.max(0, input.portfolio.stagedCapitalPlan?.availableEur ?? 0);
    const total = invested + liquidity;
    if (liquidity > 500 && (total <= 0 || liquidity / total > 0.10)) {
      return {
        sourceId: null, sourceLabel: null, sourceAction: null,
        targetAssetId: destination.assetId, targetTicker: destination.ticker, targetName: destination.name, targetLevel: destination.level,
        amountEur: null, status: 'USE_LIQUIDITY_FIRST', assessment: null,
        reason: `Hay ${liquidity.toFixed(2)} € de liquidez disponible. Antes de vender una posición y generar costes/impuestos, el motor prioriza financiar ${destination.ticker} con dinero nuevo.`
      };
    }

    const destinationProxy = destination.annualizedProxyPct;
    const rankedSources = positions
      .map(position => ({ position, proxy: sourceAnnualProxy(position, input.cashBenchmarkAnnualPct) }))
      .filter(row => row.proxy != null && destinationProxy != null && destinationProxy - row.proxy! >= 5)
      .sort((a, b) => (a.proxy ?? Infinity) - (b.proxy ?? Infinity));
    const sourceRow = rankedSources[0];
    if (!sourceRow) {
      return {
        sourceId: null, sourceLabel: null, sourceAction: null,
        targetAssetId: destination.assetId, targetTicker: destination.ticker, targetName: destination.name, targetLevel: destination.level,
        amountEur: null, status: 'KEEP', assessment: null,
        reason: `La mejor oportunidad actual es ${destination.ticker}, pero ninguna posición mantenida presenta una desventaja proxy de al menos 5 pp que justifique estudiar su venta.`
      };
    }

    const source = sourceRow.position;
    const currentValue = source.currentValueEur ?? 0;
    const fraction = source.action === 'WATCH' ? 0.50 : 0.25;
    const amountEur = Math.max(0, currentValue * fraction);
    const targetCandidate = candidateFor(input.scan, destination.assetId);
    const sourceFund = (input.portfolio.funds ?? []).find(fund => fund.id === source.key || fund.isin.toUpperCase() === source.tickerOrIsin.toUpperCase());
    const sourceHolding = input.portfolio.holdings.find(holding => holding.ticker.toUpperCase() === source.tickerOrIsin.toUpperCase());
    const targetIsFund = targetCandidate?.asset.instrumentType === 'MUTUAL_FUND';
    const taxDeferredTransfer = Boolean(sourceFund?.transferable && targetIsFund);
    let realizedGainEur: number | null = null;
    let feesEur = 0;

    if (sourceFund) {
      realizedGainEur = taxDeferredTransfer ? 0 : estimateFundRealizedGain(currentValue, sourceFund.investedEur, amountEur);
      if (!targetIsFund) feesEur += brokerCommission(amountEur);
    } else if (sourceHolding) {
      const unitValue = sourceHolding.shares > 0 ? currentValue / sourceHolding.shares : null;
      const sharesToSell = unitValue && unitValue > 0 ? Math.min(sourceHolding.shares, Math.max(1, Math.floor(amountEur / unitValue))) : 0;
      if (sharesToSell > 0 && unitValue) {
        const notional = sharesToSell * unitValue;
        const basis = TaxLotLedgerService.fifoCostBasis(sourceHolding.ticker, sourceHolding.shares, sharesToSell);
        realizedGainEur = basis.costBasisEur == null ? null : Math.max(0, notional - basis.costBasisEur);
        feesEur += brokerCommission(notional);
        if (!targetIsFund) feesEur += brokerCommission(notional);
      }
    }

    const assessment = assessTaxAwareRotation({
      realizedGainEur,
      notionalEur: amountEur,
      feeEur: feesEur,
      sourceAnnualProxyPct: sourceRow.proxy,
      destinationAnnualProxyPct: destinationProxy,
      horizonYears: input.horizonYears,
      settings: SpanishTaxSettingsService.load(),
      taxDeferredTransfer
    });

    if (assessment.tax.method === 'UNKNOWN_COST_BASIS') {
      return {
        sourceId: source.key, sourceLabel: source.label, sourceAction: source.action,
        targetAssetId: destination.assetId, targetTicker: destination.ticker, targetName: destination.name, targetLevel: destination.level,
        amountEur, status: 'NEEDS_TAX_DATA', assessment,
        reason: `Podría existir una rotación interesante ${source.label} → ${destination.ticker}, pero falta base de adquisición/FIFO suficiente para comprobar el coste fiscal sin inventarlo.`
      };
    }

    if (assessment.passesEconomicGate === true) {
      return {
        sourceId: source.key, sourceLabel: source.label, sourceAction: source.action,
        targetAssetId: destination.assetId, targetTicker: destination.ticker, targetName: destination.name, targetLevel: destination.level,
        amountEur, status: 'ROTATE_NOW', assessment,
        reason: `Rotación candidata: reducir aproximadamente ${(fraction * 100).toFixed(0)}% de ${source.label} para financiar ${destination.ticker}. ${assessment.reason}`
      };
    }

    return {
      sourceId: source.key, sourceLabel: source.label, sourceAction: source.action,
      targetAssetId: destination.assetId, targetTicker: destination.ticker, targetName: destination.name, targetLevel: destination.level,
      amountEur, status: 'KEEP', assessment,
      reason: `No rotar ${source.label} hacia ${destination.ticker}: ${assessment.reason}`
    };
  }
}
