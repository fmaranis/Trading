import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { brokerCommission } from './costAwareExecutionPolicy';
import { CurrentOpportunityAlertEngine, type CurrentOpportunityAlert } from './currentOpportunityAlerts';
import type { PortfolioPositionHealthResult, PortfolioPositionHealthSnapshot } from './portfolioPositionHealth';
import { strategicCoreBlocksTacticalRotation } from './strategicCorePolicy';
import {
  assessTaxAwareRotation,
  estimateFundRealizedGain,
  SpanishTaxSettingsService,
  TaxLotLedgerService,
  type SpanishTaxSettings,
  type TaxAwareRotationAssessment,
  type TrackedTaxLot
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

export interface PortfolioRotationPrivateContext {
  taxSettings?: SpanishTaxSettings | null;
  taxLotsByTicker?: Record<string, TrackedTaxLot[]> | null;
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

function fifoCostBasisFromLots(
  lots: TrackedTaxLot[],
  totalCurrentShares: number,
  sharesToSell: number
): { costBasisEur: number | null; precision: 'FIFO_TRACKED' | 'UNKNOWN' } {
  const shares = Math.max(0, sharesToSell);
  if (shares <= 0) return { costBasisEur: 0, precision: 'FIFO_TRACKED' };
  const ordered = lots.filter(lot => lot.shares > 0).sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));
  const trackedShares = ordered.reduce((sum, lot) => sum + lot.shares, 0);
  const untrackedShares = Math.max(0, totalCurrentShares - trackedShares);
  if (untrackedShares > 1e-8 || trackedShares + 1e-8 < shares) return { costBasisEur: null, precision: 'UNKNOWN' };

  let remaining = shares;
  let cost = 0;
  for (const lot of ordered) {
    if (remaining <= 1e-9) break;
    const used = Math.min(remaining, lot.shares);
    cost += lot.acquisitionCostEur * (used / lot.shares);
    remaining -= used;
  }
  return remaining <= 1e-8 ? { costBasisEur: cost, precision: 'FIFO_TRACKED' } : { costBasisEur: null, precision: 'UNKNOWN' };
}

export class PortfolioRotationReviewEngine {
  static evaluate(input: {
    portfolio: UserPortfolioState;
    scan: AssetUniverseScanResult;
    positionHealth: PortfolioPositionHealthResult | null;
    cashBenchmarkAnnualPct: number;
    horizonYears: number;
    privateContext?: PortfolioRotationPrivateContext;
  }): PortfolioRotationReview {
    const destination = bestDestination(input.scan, input.cashBenchmarkAnnualPct);
    if (!destination) return { sourceId: null, sourceLabel: null, sourceAction: null, targetAssetId: null, targetTicker: null, targetName: null, targetLevel: null, amountEur: null, status: 'NO_DESTINATION', assessment: null, reason: 'No hay hoy una entrada de alta convicción o buena oportunidad que justifique estudiar una rotación.' };

    const positions = (input.positionHealth?.positions ?? [])
      .filter(position => position.currentValueEur != null && position.currentValueEur > 0 && position.action !== 'ADD' && position.action !== 'EXIT' && position.action !== 'REDUCE')
      .filter(position => {
        const candidate = candidateFor(input.scan, position.key) ?? candidateFor(input.scan, position.tickerOrIsin);
        const assetId = candidate?.asset.assetId ?? position.key;
        return !strategicCoreBlocksTacticalRotation(assetId);
      });
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
        reason: `La mejor oportunidad actual es ${destination.ticker}, pero ninguna posición no-core mantenida presenta una desventaja proxy de al menos 5 pp que justifique estudiar su venta. El core global queda fuera de las fuentes tácticas de financiación.`
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
        const suppliedLots = input.privateContext?.taxLotsByTicker?.[sourceHolding.ticker.toUpperCase()];
        const basis = suppliedLots
          ? fifoCostBasisFromLots(suppliedLots, sourceHolding.shares, sharesToSell)
          : TaxLotLedgerService.fifoCostBasis(sourceHolding.ticker, sourceHolding.shares, sharesToSell);
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
      settings: input.privateContext?.taxSettings ?? SpanishTaxSettingsService.load(),
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
