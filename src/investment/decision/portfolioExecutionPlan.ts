import type { AssetUniverseScanResult } from './assetUniverseScanner';
import type { InvestmentInstrumentType } from './assetUniverse';
import type { PortfolioDecisionResult } from './portfolioDecisionEngine';
import type { UserPortfolioState } from './userPortfolio';

const STORAGE_KEY = 'custodia_pending_execution_plan_v1';

export type PortfolioExecutionAction =
  | 'BUY_ETF'
  | 'SELL_ETF'
  | 'SUBSCRIBE_FUND'
  | 'TRANSFER_FUND'
  | 'REDEEM_FUND'
  | 'REVIEW';

export type PortfolioExecutionStatus = 'PENDING' | 'DONE' | 'DISMISSED';

export interface PortfolioExecutionLine {
  id: string;
  action: PortfolioExecutionAction;
  status: PortfolioExecutionStatus;
  instrumentType: InvestmentInstrumentType;
  sourceId?: string;
  sourceLabel?: string;
  sourceIsin?: string;
  targetAssetId?: string;
  targetTicker?: string;
  targetName?: string;
  targetIsin?: string;
  category: string;
  amountEur: number | null;
  shares: number | null;
  estimatedPriceEur: number | null;
  instruction: string;
  rationale: string;
  taxNote?: string;
}

export interface PortfolioExecutionPlan {
  id: string;
  createdAt: string;
  decisionAsOf: string;
  lines: PortfolioExecutionLine[];
  warnings: string[];
}

function uid(prefix: string, index: number): string {
  return `${prefix}_${Date.now()}_${index}`;
}

function findAsset(scan: AssetUniverseScanResult, key: string | undefined) {
  if (!key) return undefined;
  const normalized = key.toUpperCase();
  return scan.candidates.find(c =>
    c.asset.assetId === key ||
    c.asset.ticker.toUpperCase() === normalized ||
    c.asset.isin?.toUpperCase() === normalized
  )?.asset;
}

function candidatePrice(scan: AssetUniverseScanResult, ticker: string | undefined): number | null {
  if (!ticker) return null;
  const row = scan.candidates.find(c => c.asset.ticker.toUpperCase() === ticker.toUpperCase());
  return row?.lastClose && row.lastClose > 0 ? row.lastClose : null;
}

export function buildPortfolioExecutionPlan(input: {
  portfolio: UserPortfolioState;
  scan: AssetUniverseScanResult;
  decisionAsOf: string;
  portfolioDecision: PortfolioDecisionResult;
}): PortfolioExecutionPlan {
  const { portfolio, scan, decisionAsOf, portfolioDecision } = input;
  const lines: PortfolioExecutionLine[] = [];
  const warnings: string[] = [];
  const exposureByCategory = new Map(portfolioDecision.exposures.map(x => [x.category, x]));

  for (const contribution of portfolioDecision.contributions) {
    const asset = findAsset(scan, contribution.assetId) ?? findAsset(scan, contribution.ticker);
    const price = candidatePrice(scan, contribution.ticker);
    const isFund = contribution.instrumentType === 'MUTUAL_FUND';
    let shares: number | null = null;
    let amount = contribution.amountEur;
    if (!isFund && price) {
      shares = Math.floor(amount / price + 1e-9);
      if (shares < 1) {
        warnings.push(`ETF_AMOUNT_BELOW_ONE_SHARE:${contribution.ticker}`);
        lines.push({
          id: uid('review_buy', lines.length), action: 'REVIEW', status: 'PENDING', instrumentType: 'ETF_ETC',
          targetAssetId: contribution.assetId, targetTicker: contribution.ticker, targetName: contribution.name,
          targetIsin: asset?.isin, category: contribution.category, amountEur: amount, shares: null, estimatedPriceEur: price,
          instruction: `No comprar todavía: ${amount.toFixed(2)} € no alcanzan una participación completa de ${contribution.ticker} al último cierre disponible.`,
          rationale: contribution.reason
        });
        continue;
      }
      amount = shares * price;
    }
    lines.push({
      id: uid(isFund ? 'subscribe' : 'buy', lines.length),
      action: isFund ? 'SUBSCRIBE_FUND' : 'BUY_ETF',
      status: 'PENDING', instrumentType: contribution.instrumentType,
      targetAssetId: contribution.assetId, targetTicker: contribution.ticker, targetName: contribution.name,
      targetIsin: asset?.isin, category: contribution.category, amountEur: amount, shares,
      estimatedPriceEur: price,
      instruction: isFund
        ? `Suscribir aproximadamente ${amount.toFixed(2)} € del fondo ${contribution.name}${asset?.isin ? ` (ISIN ${asset.isin})` : ''}.`
        : `Comprar ${shares} participación${shares === 1 ? '' : 'es'} de ${contribution.ticker}${asset?.isin ? ` (ISIN ${asset.isin})` : ''}.`,
      rationale: contribution.reason,
      taxNote: isFund ? 'Si este dinero procede de otro fondo elegible, revisar primero si conviene un traspaso en lugar de reembolso + suscripción.' : undefined
    });
  }

  for (const position of portfolioDecision.existingPositions) {
    if (position.action !== 'REDUCE' && position.action !== 'REVIEW_TRANSFER') continue;
    const exposure = position.category === 'UNKNOWN' ? undefined : exposureByCategory.get(position.category);
    const excess = exposure ? Math.max(0, -exposure.gapEur) : 0;
    const amount = position.currentValueEur == null ? null : Math.min(position.currentValueEur, excess || position.currentValueEur);

    if (position.instrumentType === 'MUTUAL_FUND') {
      const fund = (portfolio.funds ?? []).find(f => f.id === position.id);
      const possibleFundTarget = portfolioDecision.contributions
        .filter(c => c.instrumentType === 'MUTUAL_FUND')
        .sort((a, b) => b.amountEur - a.amountEur)[0];
      const targetAsset = possibleFundTarget ? findAsset(scan, possibleFundTarget.assetId) : undefined;

      if (position.action === 'REVIEW_TRANSFER' && fund?.transferable && possibleFundTarget) {
        lines.push({
          id: uid('transfer', lines.length), action: 'TRANSFER_FUND', status: 'PENDING', instrumentType: 'MUTUAL_FUND',
          sourceId: fund.id, sourceLabel: fund.name, sourceIsin: fund.isin,
          targetAssetId: possibleFundTarget.assetId, targetTicker: possibleFundTarget.ticker,
          targetName: possibleFundTarget.name, targetIsin: targetAsset?.isin,
          category: position.category, amountEur: amount, shares: null, estimatedPriceEur: null,
          instruction: `Revisar un traspaso${amount != null ? ` por aproximadamente ${amount.toFixed(2)} €` : ''} desde ${fund.name}${fund.isin ? ` (${fund.isin})` : ''} hacia ${possibleFundTarget.name}${targetAsset?.isin ? ` (${targetAsset.isin})` : ''}.`,
          rationale: position.reason,
          taxNote: 'El plan trata el traspaso como opción preferente solo entre fondos marcados como transferibles. Debe confirmarse elegibilidad fiscal y operativa en la entidad antes de cursarlo.'
        });
      } else {
        lines.push({
          id: uid('redeem', lines.length), action: position.action === 'REVIEW_TRANSFER' ? 'REVIEW' : 'REDEEM_FUND',
          status: 'PENDING', instrumentType: 'MUTUAL_FUND', sourceId: fund?.id ?? position.id,
          sourceLabel: fund?.name ?? position.label, sourceIsin: fund?.isin, category: position.category,
          amountEur: amount, shares: null, estimatedPriceEur: null,
          instruction: position.action === 'REVIEW_TRANSFER'
            ? `Revisar cómo reducir ${position.label}; no se ha encontrado automáticamente un fondo destino elegible para traspaso.`
            : `Revisar un reembolso parcial${amount != null ? ` de aproximadamente ${amount.toFixed(2)} €` : ''} de ${position.label}.`,
          rationale: position.reason,
          taxNote: 'Antes de reembolsar un fondo, comprobar si un traspaso entre fondos elegibles evita materializar fiscalmente la ganancia en ese momento.'
        });
      }
      continue;
    }

    const holding = portfolio.holdings.find(h => h.ticker.toUpperCase() === position.id.toUpperCase());
    const price = candidatePrice(scan, holding?.ticker ?? position.id);
    let shares: number | null = null;
    let notional = amount;
    if (holding && price && amount != null) {
      shares = Math.min(holding.shares, Math.max(1, Math.floor(amount / price + 1e-9)));
      notional = shares * price;
    }
    lines.push({
      id: uid('sell', lines.length), action: 'SELL_ETF', status: 'PENDING', instrumentType: 'ETF_ETC',
      sourceId: position.id, sourceLabel: position.label, targetTicker: holding?.ticker ?? position.id,
      targetIsin: findAsset(scan, holding?.ticker ?? position.id)?.isin, category: position.category,
      amountEur: notional, shares, estimatedPriceEur: price,
      instruction: shares != null
        ? `Vender ${shares} participación${shares === 1 ? '' : 'es'} de ${holding?.ticker ?? position.id}.`
        : `Revisar una venta parcial de ${position.label}; falta precio o cantidad suficiente para concretar títulos.`,
      rationale: position.reason
    });
  }

  if (!lines.length) warnings.push('NO_ACTIONABLE_OPERATIONS');
  warnings.push('PLAN_IS_MANUAL_EXECUTION_GUIDANCE_NOT_A_BROKER_ORDER');

  return { id: `execution_${Date.now()}`, createdAt: new Date().toISOString(), decisionAsOf, lines, warnings };
}

export class PortfolioExecutionPlanService {
  static load(): PortfolioExecutionPlan | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as PortfolioExecutionPlan : null;
    } catch { return null; }
  }

  static save(plan: PortfolioExecutionPlan): PortfolioExecutionPlan {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    return plan;
  }

  static updateStatus(lineId: string, status: PortfolioExecutionStatus): PortfolioExecutionPlan | null {
    const plan = this.load();
    if (!plan) return null;
    const next = { ...plan, lines: plan.lines.map(line => line.id === lineId ? { ...line, status } : line) };
    return this.save(next);
  }

  static clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  }
}
