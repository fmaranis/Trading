import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { assessAgainstCashBenchmark } from './cashBenchmark';
import type { PortfolioDecisionResult } from './portfolioDecisionEngine';
import type { PortfolioExecutionPlan } from './portfolioExecutionPlan';
import {
  assessTaxAwareRotation,
  estimateFundRealizedGain,
  SpanishTaxSettingsService,
  TaxLotLedgerService,
  type SpanishTaxSettings
} from './spanishTaxModel';
import type { UserPortfolioState } from './userPortfolio';

function findCandidate(scan: AssetUniverseScanResult, key: string | undefined) {
  if (!key) return undefined;
  const normalized = key.toUpperCase();
  return scan.candidates.find(c => c.asset.assetId === key || c.asset.ticker.toUpperCase() === normalized || c.asset.isin?.toUpperCase() === normalized);
}

function sourceProxy(scan: AssetUniverseScanResult, key: string | undefined, cashBenchmarkAnnualPct: number): number | null {
  const candidate = findCandidate(scan, key);
  if (!candidate) return null;
  return assessAgainstCashBenchmark({ momentum120Pct: candidate.momentum120Pct, benchmarkAnnualPct: cashBenchmarkAnnualPct, notionalEur: 0, estimatedFeeEur: 0 }).netAnnualizedProxyPct;
}

export function applyTaxAwareExecutionOverlay(input: {
  plan: PortfolioExecutionPlan;
  portfolio: UserPortfolioState;
  portfolioDecision: PortfolioDecisionResult;
  scan: AssetUniverseScanResult;
  horizonYears: number;
  taxSettings?: SpanishTaxSettings;
  currentValueByKey?: Record<string, number | null | undefined>;
}): PortfolioExecutionPlan {
  const { plan, portfolio, portfolioDecision, scan } = input;
  const settings = input.taxSettings ?? SpanishTaxSettingsService.load();
  const cash = plan.cashBenchmarkAnnualPct;
  const destinationProxy = Math.max(
    cash,
    ...plan.lines
      .filter(line => ['BUY_ETF', 'SUBSCRIBE_FUND', 'TRANSFER_FUND'].includes(line.action))
      .map(line => line.estimatedAnnualReturnProxyPct)
      .filter((value): value is number => value != null && Number.isFinite(value))
  );
  const positionById = new Map(portfolioDecision.existingPositions.map(position => [position.id.toUpperCase(), position]));
  const warnings = [...plan.warnings];

  const lines = plan.lines.map(line => {
    if (line.action === 'TRANSFER_FUND') {
      return {
        ...line,
        taxNote: 'Fiscalidad España: traspaso tratado como diferido si se cumplen los requisitos legales/operativos; coste fiscal inmediato estimado 0 €. Mantiene valor y fecha fiscal de adquisición.'
      };
    }
    if (!['SELL_ETF', 'REDEEM_FUND'].includes(line.action)) return line;

    const sourceKey = String(line.sourceId ?? line.sourceIsin ?? line.targetTicker ?? '').toUpperCase();
    const position = positionById.get(sourceKey) ?? portfolioDecision.existingPositions.find(p => p.id.toUpperCase() === sourceKey);
    const action = position?.action ?? 'REDUCE';
    const notional = Math.max(0, Number(line.amountEur ?? 0));
    const fee = Math.max(0, Number(line.estimatedFeeEur ?? 0));
    let realizedGain: number | null = null;
    let precision = '';

    if (line.action === 'SELL_ETF') {
      const ticker = line.targetTicker ?? line.sourceId ?? '';
      const holding = portfolio.holdings.find(h => h.ticker.toUpperCase() === ticker.toUpperCase());
      const shares = Math.max(0, Number(line.shares ?? 0));
      if (holding && shares > 0) {
        const basis = TaxLotLedgerService.fifoCostBasis(ticker, holding.shares, shares);
        if (basis.costBasisEur != null) {
          realizedGain = Math.max(0, notional - fee - basis.costBasisEur);
          precision = 'FIFO de lotes registrados';
        } else precision = 'base de adquisición/FIFO incompleta';
      }
    } else {
      const fund = (portfolio.funds ?? []).find(f => f.id === line.sourceId || (!!line.sourceIsin && f.isin.toUpperCase() === line.sourceIsin.toUpperCase()));
      const healthValue = fund ? input.currentValueByKey?.[fund.id] ?? input.currentValueByKey?.[fund.isin.toUpperCase()] : null;
      const currentValue = healthValue ?? fund?.currentValueEur ?? null;
      if (fund) {
        const gain = estimateFundRealizedGain(currentValue, fund.investedEur, notional);
        realizedGain = gain == null ? null : Math.max(0, gain);
        precision = gain == null ? 'valor actual insuficiente para estimar plusvalía' : 'coste registrado prorrateado sobre el reembolso';
      }
    }

    const srcProxy = sourceProxy(scan, line.targetTicker ?? line.sourceIsin ?? line.sourceId, cash);
    const assessment = assessTaxAwareRotation({
      realizedGainEur: realizedGain,
      notionalEur: notional,
      feeEur: fee,
      sourceAnnualProxyPct: srcProxy,
      destinationAnnualProxyPct: destinationProxy,
      horizonYears: input.horizonYears,
      settings
    });
    const taxSummary = `Fiscalidad España: plusvalía realizada estimada ${realizedGain == null ? 'N/D' : `${realizedGain.toFixed(2)} €`} · reserva IRPF ${assessment.tax.estimatedTaxEur.toFixed(2)} € (${assessment.tax.method})${precision ? ` · ${precision}` : ''}. ${assessment.reason}`;

    // A structural EXIT is a risk action and taxes must not trap the portfolio in a broken position.
    // A partial REDUCE/rotation, however, must demonstrate that its expected advantage pays for tax + costs.
    if (action !== 'EXIT' && assessment.tax.method !== 'NO_GAIN' && assessment.passesEconomicGate !== true) {
      warnings.push(`TAX_AWARE_ROTATION_VETO:${line.targetTicker ?? line.sourceIsin ?? line.sourceId ?? 'POSITION'}`);
      return {
        ...line,
        action: 'REVIEW' as const,
        instruction: `No rotar todavía ${line.targetTicker ?? line.sourceLabel ?? line.sourceIsin ?? 'esta posición'}: la mejora esperada no demuestra que compense impuestos y costes.`,
        rationale: `${line.rationale} Gate fiscal: ${assessment.reason}`,
        taxNote: taxSummary
      };
    }

    return {
      ...line,
      rationale: `${line.rationale} ${action === 'EXIT' ? 'La señal es de salida estructural: el coste fiscal se informa pero no bloquea una salida por deterioro severo.' : 'La rotación supera el gate fiscal/económico actual.'}`,
      taxNote: taxSummary
    };
  });

  return { ...plan, lines, warnings };
}
