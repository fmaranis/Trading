import type { AssetUniverseScanResult } from './assetUniverseScanner';
import type { InvestmentInstrumentType } from './assetUniverse';
import type { PortfolioDecisionResult } from './portfolioDecisionEngine';
import type { UserPortfolioState } from './userPortfolio';
import { brokerCommission } from './costAwareExecutionPolicy';
import { executionPolicyForCapital } from './adaptiveExecutionPolicy';
import { assessAgainstCashBenchmark, CashBenchmarkService, DEFAULT_CASH_BENCHMARK_ANNUAL_PCT } from './cashBenchmark';

const STORAGE_KEY = 'custodia_pending_execution_plan_v1';
export type PortfolioExecutionAction = 'BUY_ETF' | 'SELL_ETF' | 'SUBSCRIBE_FUND' | 'TRANSFER_FUND' | 'REDEEM_FUND' | 'REVIEW';
export type PortfolioExecutionStatus = 'PENDING' | 'DONE' | 'DISMISSED';

export interface PortfolioExecutionLine {
  id: string; action: PortfolioExecutionAction; status: PortfolioExecutionStatus; instrumentType: InvestmentInstrumentType;
  sourceId?: string; sourceLabel?: string; sourceIsin?: string; targetAssetId?: string; targetTicker?: string; targetName?: string; targetIsin?: string;
  category: string; amountEur: number | null; shares: number | null; estimatedPriceEur: number | null; estimatedFeeEur?: number | null;
  estimatedAnnualReturnProxyPct?: number | null; cashBenchmarkAnnualPct?: number; excessReturnVsCashPctPoints?: number | null;
  instruction: string; rationale: string; taxNote?: string;
}
export interface PortfolioExecutionPlan { id: string; createdAt: string; decisionAsOf: string; cashBenchmarkAnnualPct: number; lines: PortfolioExecutionLine[]; warnings: string[]; }

function uid(prefix: string, index: number): string { return `${prefix}_${Date.now()}_${index}`; }
function findCandidate(scan: AssetUniverseScanResult, key: string | undefined) {
  if (!key) return undefined; const normalized = key.toUpperCase();
  return scan.candidates.find(c => c.asset.assetId === key || c.asset.ticker.toUpperCase() === normalized || c.asset.isin?.toUpperCase() === normalized);
}
function findAsset(scan: AssetUniverseScanResult, key: string | undefined) { return findCandidate(scan, key)?.asset; }
function candidatePrice(scan: AssetUniverseScanResult, ticker: string | undefined): number | null {
  const row = findCandidate(scan, ticker);
  return row?.lastClose && row.lastClose > 0 ? row.lastClose : null;
}
function etfCostGate(notional: number, portfolioCapitalEur: number): { ok: boolean; fee: number; reason?: string; band: string } {
  const policy = executionPolicyForCapital(portfolioCapitalEur);
  const fee = brokerCommission(notional);
  if (notional < policy.minimumOrderNotionalEur - 1e-9) return { ok: false, fee, band: policy.capitalBand, reason: `Importe inferior al mínimo operativo adaptativo de ${policy.minimumOrderNotionalEur.toFixed(0)} € para banda ${policy.capitalBand}.` };
  const drag = fee / notional * 100;
  if (drag > policy.maximumOrderFeeDragPct + 1e-9) return { ok: false, fee, band: policy.capitalBand, reason: `La comisión supondría ${drag.toFixed(2)}% del nominal, por encima del ${policy.maximumOrderFeeDragPct.toFixed(2)}% permitido para banda ${policy.capitalBand}.` };
  return { ok: true, fee, band: policy.capitalBand };
}

export function buildPortfolioExecutionPlan(input: { portfolio: UserPortfolioState; scan: AssetUniverseScanResult; decisionAsOf: string; portfolioDecision: PortfolioDecisionResult; cashBenchmarkAnnualPct?: number }): PortfolioExecutionPlan {
  const { portfolio, scan, decisionAsOf, portfolioDecision } = input;
  const cashBenchmarkAnnualPct = Number.isFinite(input.cashBenchmarkAnnualPct) ? Math.max(0, Number(input.cashBenchmarkAnnualPct)) : DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
  const lines: PortfolioExecutionLine[] = [], warnings: string[] = [];
  const exposureByCategory = new Map(portfolioDecision.exposures.map(x => [x.category, x]));
  const portfolioCapital = Math.max(0, portfolioDecision.totalPlannedCapitalEur || (portfolioDecision.currentInvestedValueEur + portfolioDecision.currentCashEur + portfolioDecision.pendingCapitalEur));
  const adaptivePolicy = executionPolicyForCapital(portfolioCapital);

  for (const contribution of portfolioDecision.contributions) {
    const candidate = findCandidate(scan, contribution.assetId) ?? findCandidate(scan, contribution.ticker);
    const asset = candidate?.asset;
    const price = candidatePrice(scan, contribution.ticker), isFund = contribution.instrumentType === 'MUTUAL_FUND';
    let shares: number | null = null, amount = contribution.amountEur, estimatedFee: number | null = null;
    if (!isFund && price) {
      shares = Math.floor(amount / price + 1e-9);
      if (shares < 1) {
        warnings.push(`ETF_AMOUNT_BELOW_ONE_SHARE:${contribution.ticker}`);
        lines.push({ id: uid('review_buy', lines.length), action: 'REVIEW', status: 'PENDING', instrumentType: 'ETF_ETC', targetAssetId: contribution.assetId, targetTicker: contribution.ticker, targetName: contribution.name, targetIsin: asset?.isin, category: contribution.category, amountEur: amount, shares: null, estimatedPriceEur: price, estimatedFeeEur: null, cashBenchmarkAnnualPct, instruction: `No comprar todavía: ${amount.toFixed(2)} € no alcanzan una participación completa de ${contribution.ticker}.`, rationale: contribution.reason });
        continue;
      }
      amount = shares * price;
      const gate = etfCostGate(amount, portfolioCapital); estimatedFee = gate.fee;
      if (!gate.ok) {
        warnings.push(`ETF_ORDER_SUPPRESSED_BY_ADAPTIVE_COST_POLICY:${contribution.ticker}`);
        lines.push({ id: uid('review_cost_buy', lines.length), action: 'REVIEW', status: 'PENDING', instrumentType: 'ETF_ETC', targetAssetId: contribution.assetId, targetTicker: contribution.ticker, targetName: contribution.name, targetIsin: asset?.isin, category: contribution.category, amountEur: amount, shares, estimatedPriceEur: price, estimatedFeeEur: estimatedFee, cashBenchmarkAnnualPct, instruction: `No comprar todavía ${contribution.ticker}: ${gate.reason}`, rationale: `${contribution.reason} La señal teórica se conserva; la ejecución se aplaza por coste.` });
        continue;
      }
    }

    const hurdle = assessAgainstCashBenchmark({ momentum120Pct: candidate?.momentum120Pct, benchmarkAnnualPct: cashBenchmarkAnnualPct, notionalEur: amount, estimatedFeeEur: estimatedFee });
    const hurdleFields = { estimatedAnnualReturnProxyPct: hurdle.netAnnualizedProxyPct, cashBenchmarkAnnualPct, excessReturnVsCashPctPoints: hurdle.excessVsCashPctPoints };
    if (hurdle.passes !== true) {
      const reason = hurdle.passes === false
        ? `La estimación histórica anualizada neta (${hurdle.netAnnualizedProxyPct?.toFixed(2)}%) no supera el ${cashBenchmarkAnnualPct.toFixed(2)}% anual de mantener el dinero en la cuenta.`
        : `No hay evidencia suficiente para estimar una rentabilidad anualizada comparable con el ${cashBenchmarkAnnualPct.toFixed(2)}% de la cuenta.`;
      warnings.push(`CASH_BENCHMARK_HURDLE_NOT_PASSED:${contribution.ticker}`);
      lines.push({ id: uid('review_cash_hurdle', lines.length), action: 'REVIEW', status: 'PENDING', instrumentType: contribution.instrumentType, targetAssetId: contribution.assetId, targetTicker: contribution.ticker, targetName: contribution.name, targetIsin: asset?.isin, category: contribution.category, amountEur: amount, shares, estimatedPriceEur: price, estimatedFeeEur: estimatedFee, ...hurdleFields, instruction: `Mantener en cuenta / no invertir todavía en ${contribution.ticker}: ${reason}`, rationale: `${contribution.reason} La comparación usa momentum REAL de 120 sesiones anualizado como proxy histórico, no una previsión garantizada.` });
      continue;
    }

    lines.push({ id: uid(isFund ? 'subscribe' : 'buy', lines.length), action: isFund ? 'SUBSCRIBE_FUND' : 'BUY_ETF', status: 'PENDING', instrumentType: contribution.instrumentType, targetAssetId: contribution.assetId, targetTicker: contribution.ticker, targetName: contribution.name, targetIsin: asset?.isin, category: contribution.category, amountEur: amount, shares, estimatedPriceEur: price, estimatedFeeEur: estimatedFee, ...hurdleFields, instruction: isFund ? `Suscribir aproximadamente ${amount.toFixed(2)} € del fondo ${contribution.name}${asset?.isin ? ` (ISIN ${asset.isin})` : ''}.` : `Comprar ${shares} participación${shares === 1 ? '' : 'es'} de ${contribution.ticker}${asset?.isin ? ` (ISIN ${asset.isin})` : ''}. Comisión estimada: ${estimatedFee?.toFixed(2) ?? 'N/D'} €.`, rationale: `${contribution.reason} Proxy histórico neto ${hurdle.netAnnualizedProxyPct?.toFixed(2)}% vs cuenta ${cashBenchmarkAnnualPct.toFixed(2)}%.`, taxNote: isFund ? 'Si el dinero procede de otro fondo elegible, revisar primero si conviene traspaso en vez de reembolso + suscripción.' : undefined });
  }

  for (const position of portfolioDecision.existingPositions) {
    if (!['REDUCE', 'EXIT', 'REVIEW_TRANSFER'].includes(position.action)) continue;
    const exposure = position.category === 'UNKNOWN' ? undefined : exposureByCategory.get(position.category);
    const excess = exposure ? Math.max(0, -exposure.gapEur) : 0;
    const healthFraction = position.suggestedReductionPct != null ? Math.max(0, Math.min(100, position.suggestedReductionPct)) / 100 : null;
    const amount = position.currentValueEur == null
      ? null
      : position.action === 'EXIT'
        ? position.currentValueEur
        : healthFraction != null
          ? position.currentValueEur * healthFraction
          : Math.min(position.currentValueEur, excess || position.currentValueEur);

    if (position.instrumentType === 'MUTUAL_FUND') {
      const fund = (portfolio.funds ?? []).find(f => f.id === position.id);
      const possibleFundTarget = portfolioDecision.contributions.filter(c => c.instrumentType === 'MUTUAL_FUND').sort((a, b) => b.amountEur - a.amountEur)[0];
      const targetCandidate = possibleFundTarget ? findCandidate(scan, possibleFundTarget.assetId) : undefined;
      const targetAsset = targetCandidate?.asset;
      const canPreferTransfer = Boolean(fund?.transferable && possibleFundTarget && position.action !== 'REVIEW_TRANSFER' ? true : position.action === 'REVIEW_TRANSFER' && possibleFundTarget);

      if (canPreferTransfer && fund && possibleFundTarget) {
        const hurdle = assessAgainstCashBenchmark({ momentum120Pct: targetCandidate?.momentum120Pct, benchmarkAnnualPct: cashBenchmarkAnnualPct, notionalEur: amount ?? possibleFundTarget.amountEur, estimatedFeeEur: 0 });
        if (hurdle.passes === true) {
          lines.push({ id: uid('transfer', lines.length), action: 'TRANSFER_FUND', status: 'PENDING', instrumentType: 'MUTUAL_FUND', sourceId: fund.id, sourceLabel: fund.name, sourceIsin: fund.isin, targetAssetId: possibleFundTarget.assetId, targetTicker: possibleFundTarget.ticker, targetName: possibleFundTarget.name, targetIsin: targetAsset?.isin, category: position.category, amountEur: amount, shares: null, estimatedPriceEur: null, estimatedFeeEur: null, estimatedAnnualReturnProxyPct: hurdle.netAnnualizedProxyPct, cashBenchmarkAnnualPct, excessReturnVsCashPctPoints: hurdle.excessVsCashPctPoints, instruction: `Revisar un traspaso${amount != null ? ` por aproximadamente ${amount.toFixed(2)} €` : ''} desde ${fund.name}${fund.isin ? ` (${fund.isin})` : ''} hacia ${possibleFundTarget.name}${targetAsset?.isin ? ` (${targetAsset.isin})` : ''}.`, rationale: `${position.reason} El destino supera el benchmark de efectivo según el proxy histórico actual.`, taxNote: 'Debe confirmarse elegibilidad fiscal y operativa en la entidad antes de cursarlo.' });
          continue;
        }
      }

      const fullExit = position.action === 'EXIT';
      lines.push({ id: uid('redeem', lines.length), action: position.action === 'REVIEW_TRANSFER' ? 'REVIEW' : 'REDEEM_FUND', status: 'PENDING', instrumentType: 'MUTUAL_FUND', sourceId: fund?.id ?? position.id, sourceLabel: fund?.name ?? position.label, sourceIsin: fund?.isin, category: position.category, amountEur: amount, shares: null, estimatedPriceEur: null, estimatedFeeEur: null, cashBenchmarkAnnualPct, instruction: position.action === 'REVIEW_TRANSFER' ? `Revisar cómo reducir ${position.label}; no se ha encontrado automáticamente un fondo destino elegible para traspaso.` : fullExit ? `Revisar la salida completa de ${position.label}${amount != null ? ` (aprox. ${amount.toFixed(2)} €)` : ''}.` : `Revisar un reembolso parcial${amount != null ? ` de aproximadamente ${amount.toFixed(2)} €` : ''} de ${position.label}.`, rationale: position.reason, taxNote: 'Antes de reembolsar, comprobar si un traspaso entre fondos elegibles es fiscal y operativamente preferible.' });
      continue;
    }

    const holding = portfolio.holdings.find(h => h.ticker.toUpperCase() === position.id.toUpperCase());
    const derivedPrice = holding && position.currentValueEur != null && holding.shares > 0 ? position.currentValueEur / holding.shares : null;
    const price = candidatePrice(scan, holding?.ticker ?? position.id) ?? derivedPrice;
    let shares: number | null = null, notional = amount;
    if (holding && price && amount != null) {
      shares = position.action === 'EXIT'
        ? holding.shares
        : Math.min(holding.shares, Math.max(1, Math.floor(amount / price + 1e-9)));
      notional = shares * price;
    }
    if (shares != null && notional != null) {
      const gate = etfCostGate(notional, portfolioCapital);
      if (!gate.ok) {
        warnings.push(`ETF_SELL_SUPPRESSED_BY_ADAPTIVE_COST_POLICY:${holding?.ticker ?? position.id}`);
        lines.push({ id: uid('review_cost_sell', lines.length), action: 'REVIEW', status: 'PENDING', instrumentType: 'ETF_ETC', sourceId: position.id, sourceLabel: position.label, targetTicker: holding?.ticker ?? position.id, targetIsin: findAsset(scan, holding?.ticker ?? position.id)?.isin, category: position.category, amountEur: notional, shares, estimatedPriceEur: price, estimatedFeeEur: gate.fee, cashBenchmarkAnnualPct, instruction: `No vender todavía ${holding?.ticker ?? position.id}: ${gate.reason}`, rationale: `${position.reason} La señal de reducción/salida queda pendiente por coste.` });
        continue;
      }
      const fullExit = position.action === 'EXIT' && holding && shares === holding.shares;
      lines.push({ id: uid('sell', lines.length), action: 'SELL_ETF', status: 'PENDING', instrumentType: 'ETF_ETC', sourceId: position.id, sourceLabel: position.label, targetTicker: holding?.ticker ?? position.id, targetIsin: findAsset(scan, holding?.ticker ?? position.id)?.isin, category: position.category, amountEur: notional, shares, estimatedPriceEur: price, estimatedFeeEur: gate.fee, cashBenchmarkAnnualPct, instruction: `${fullExit ? 'Vender toda la posición' : `Vender ${shares} participación${shares === 1 ? '' : 'es'}`} de ${holding?.ticker ?? position.id}. Comisión estimada: ${gate.fee.toFixed(2)} €.`, rationale: position.reason });
    } else {
      lines.push({ id: uid('sell_review', lines.length), action: 'REVIEW', status: 'PENDING', instrumentType: 'ETF_ETC', sourceId: position.id, sourceLabel: position.label, targetTicker: holding?.ticker ?? position.id, targetIsin: findAsset(scan, holding?.ticker ?? position.id)?.isin, category: position.category, amountEur: notional, shares, estimatedPriceEur: price, estimatedFeeEur: null, cashBenchmarkAnnualPct, instruction: `Revisar ${position.action === 'EXIT' ? 'la salida' : 'una venta parcial'} de ${position.label}; falta precio o cantidad para concretar títulos.`, rationale: position.reason });
    }
  }

  if (!lines.length) warnings.push('NO_ACTIONABLE_OPERATIONS');
  warnings.push('PLAN_IS_MANUAL_EXECUTION_GUIDANCE_NOT_A_BROKER_ORDER');
  warnings.push(`CASH_BENCHMARK_ANNUAL_PCT:${cashBenchmarkAnnualPct.toFixed(2)}`);
  warnings.push(`ADAPTIVE_EXECUTION_POLICY:${adaptivePolicy.capitalBand}:${adaptivePolicy.minimumDriftPctPoints}PP_DRIFT:${adaptivePolicy.minimumOrderNotionalEur}EUR_MIN_NOTIONAL:${adaptivePolicy.maximumOrderFeeDragPct}%_MAX_ORDER_FEE_DRAG`);
  return { id: `execution_${Date.now()}`, createdAt: new Date().toISOString(), decisionAsOf, cashBenchmarkAnnualPct, lines, warnings };
}

export class PortfolioExecutionPlanService {
  static load(): PortfolioExecutionPlan | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PortfolioExecutionPlan;
      if (!parsed || typeof parsed !== 'object') return null;
      const benchmark = typeof parsed.cashBenchmarkAnnualPct === 'number' && Number.isFinite(parsed.cashBenchmarkAnnualPct)
        ? parsed.cashBenchmarkAnnualPct
        : CashBenchmarkService.load();
      return {
        ...parsed,
        cashBenchmarkAnnualPct: benchmark,
        lines: Array.isArray(parsed.lines)
          ? parsed.lines.map(line => ({
              ...line,
              cashBenchmarkAnnualPct: typeof line.cashBenchmarkAnnualPct === 'number' && Number.isFinite(line.cashBenchmarkAnnualPct)
                ? line.cashBenchmarkAnnualPct
                : benchmark
            }))
          : []
      };
    } catch {
      return null;
    }
  }
  static save(plan: PortfolioExecutionPlan): PortfolioExecutionPlan { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); return plan; }
  static updateStatus(lineId: string, status: PortfolioExecutionStatus): PortfolioExecutionPlan | null { const plan = this.load(); if (!plan) return null; return this.save({ ...plan, lines: plan.lines.map(line => line.id === lineId ? { ...line, status } : line) }); }
  static clear(): void { if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY); }
}