import type { BrokerExecutionProfile } from './brokerExecution';
import { MYINVESTOR_BROKER_PROFILE } from './brokerExecution';
import {
  EXAMPLE_FUND_POSITIONS,
  EXAMPLE_STAGED_CAPITAL_PLAN,
  type FundPosition,
  type StagedCapitalPlan
} from './fundPortfolio';

const STORAGE_KEY = 'custodia_user_portfolio_v1';
const LEGACY_FUNDS_KEY = 'custodia_fund_positions_v1';
const LEGACY_PLAN_KEY = 'custodia_staged_capital_plan_v1';

export interface UserHolding {
  ticker: string;
  shares: number;
}

export interface UserPortfolioState {
  cashEur: number;
  holdings: UserHolding[];
  funds?: FundPosition[];
  stagedCapitalPlan?: StagedCapitalPlan;
  exampleInitialized?: boolean;
  updatedAt: string;
}

export type RebalanceAction = 'BUY' | 'SELL' | 'HOLD' | 'DATA_MISSING';

export interface RebalanceLine {
  assetId: string | null;
  ticker: string;
  priceEur: number | null;
  currentShares: number;
  currentValueEur: number;
  currentWeightPct: number;
  targetWeightPct: number;
  targetValueEur: number;
  driftPctPoints: number;
  action: RebalanceAction;
  proposedShares: number;
  estimatedNotionalEur: number;
  estimatedFeeEur: number;
  reason: string;
}

export interface PortfolioRebalanceAnalysis {
  totalPortfolioValueEur: number;
  startingCashEur: number;
  projectedCashEur: number;
  knownHoldingsValueEur: number;
  targetCashWeightPct: number;
  currentCashWeightPct: number;
  theoreticalTurnoverPct: number;
  maxAbsoluteDriftPctPoints: number;
  estimatedFeesEur: number;
  executableOrders: number;
  rebalanceRecommended: boolean;
  lines: RebalanceLine[];
  warnings: string[];
}

function commission(notional: number, profile: BrokerExecutionProfile): number {
  if (notional <= 0) return 0;
  return Math.min(profile.etfMaxCommissionEur, Math.max(profile.etfMinCommissionEur, notional * profile.etfCommissionPct / 100));
}

function normalizeHolding(h: any): UserHolding | null {
  if (!h || !String(h.ticker || '').trim()) return null;
  const shares = Math.max(0, Number(h.shares) || 0);
  return shares > 0 ? { ticker: String(h.ticker).trim().toUpperCase(), shares } : null;
}

function normalizeFund(f: any): FundPosition | null {
  if (!f || (!String(f.isin || '').trim() && !String(f.name || '').trim())) return null;
  return {
    id: String(f.id || `fund_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    isin: String(f.isin || '').trim().toUpperCase(),
    name: String(f.name || 'Fondo de inversión').trim(),
    category: ['GLOBAL_EQUITY', 'EMERGING_EQUITY', 'OTHER'].includes(f.category) ? f.category : 'OTHER',
    investedEur: Math.max(0, Number(f.investedEur) || 0),
    acquisitionDate: typeof f.acquisitionDate === 'string' ? f.acquisitionDate : new Date().toISOString().slice(0, 10),
    currentValueEur: f.currentValueEur == null || f.currentValueEur === '' ? null : Math.max(0, Number(f.currentValueEur) || 0),
    transferable: Boolean(f.transferable),
    broker: typeof f.broker === 'string' ? f.broker : undefined
  };
}

function normalizePlan(p: any): StagedCapitalPlan {
  return {
    availableEur: Math.max(0, Number(p?.availableEur) || 0),
    horizonMonths: Math.max(1, Number(p?.horizonMonths) || 12),
    preferredMode: 'MONTHLY'
  };
}

function exampleState(): UserPortfolioState {
  return {
    cashEur: 0,
    holdings: [],
    funds: EXAMPLE_FUND_POSITIONS.map(f => ({ ...f })),
    stagedCapitalPlan: { ...EXAMPLE_STAGED_CAPITAL_PLAN },
    exampleInitialized: true,
    updatedAt: new Date().toISOString()
  };
}

export class UserPortfolioService {
  static load(): UserPortfolioState {
    if (typeof window === 'undefined') return exampleState();
    try {
      const rawText = window.localStorage.getItem(STORAGE_KEY);
      const raw = rawText ? JSON.parse(rawText) : {};
      const legacyFundsText = window.localStorage.getItem(LEGACY_FUNDS_KEY);
      const legacyPlanText = window.localStorage.getItem(LEGACY_PLAN_KEY);
      const legacyFunds = legacyFundsText ? JSON.parse(legacyFundsText) : null;
      const legacyPlan = legacyPlanText ? JSON.parse(legacyPlanText) : null;

      const hasUnifiedFundFields = Array.isArray(raw.funds) || raw.stagedCapitalPlan != null || raw.exampleInitialized === true;
      const fundsSource = hasUnifiedFundFields
        ? (Array.isArray(raw.funds) ? raw.funds : [])
        : (Array.isArray(legacyFunds) ? legacyFunds : EXAMPLE_FUND_POSITIONS);
      const planSource = hasUnifiedFundFields
        ? (raw.stagedCapitalPlan ?? { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' })
        : (legacyPlan ?? EXAMPLE_STAGED_CAPITAL_PLAN);

      return {
        cashEur: Math.max(0, Number(raw.cashEur) || 0),
        holdings: Array.isArray(raw.holdings) ? raw.holdings.map(normalizeHolding).filter(Boolean) as UserHolding[] : [],
        funds: fundsSource.map(normalizeFund).filter(Boolean) as FundPosition[],
        stagedCapitalPlan: normalizePlan(planSource),
        exampleInitialized: true,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString()
      };
    } catch {
      return exampleState();
    }
  }

  static save(input: { cashEur: number; holdings: UserHolding[]; funds?: FundPosition[]; stagedCapitalPlan?: StagedCapitalPlan }): UserPortfolioState {
    const state: UserPortfolioState = {
      cashEur: Math.max(0, Number(input.cashEur) || 0),
      holdings: input.holdings.map(normalizeHolding).filter(Boolean) as UserHolding[],
      funds: (input.funds ?? []).map(normalizeFund).filter(Boolean) as FundPosition[],
      stagedCapitalPlan: normalizePlan(input.stagedCapitalPlan ?? { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' }),
      exampleInitialized: true,
      updatedAt: new Date().toISOString()
    };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.localStorage.removeItem(LEGACY_FUNDS_KEY);
      window.localStorage.removeItem(LEGACY_PLAN_KEY);
    }
    return state;
  }

  static restoreExample(): UserPortfolioState {
    const state = exampleState();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.localStorage.removeItem(LEGACY_FUNDS_KEY);
      window.localStorage.removeItem(LEGACY_PLAN_KEY);
    }
    return state;
  }

  static clear(): void {
    if (typeof window !== 'undefined') {
      const empty: UserPortfolioState = {
        cashEur: 0, holdings: [], funds: [],
        stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' },
        exampleInitialized: true, updatedAt: new Date().toISOString()
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
      window.localStorage.removeItem(LEGACY_FUNDS_KEY);
      window.localStorage.removeItem(LEGACY_PLAN_KEY);
    }
  }
}

export function analyzePortfolioRebalance(
  portfolio: UserPortfolioState,
  targets: Array<{ assetId: string; ticker: string; weight: number }>,
  pricesByTicker: Record<string, number>,
  targetCashWeight: number,
  profile: BrokerExecutionProfile = MYINVESTOR_BROKER_PROFILE,
  driftThresholdPctPoints = 5
): PortfolioRebalanceAnalysis {
  const normalizedPrices = Object.fromEntries(Object.entries(pricesByTicker).map(([k, v]) => [k.toUpperCase(), v]));
  const targetByTicker = new Map(targets.map(t => [t.ticker.toUpperCase(), t]));
  const holdingByTicker = new Map(portfolio.holdings.map(h => [h.ticker.toUpperCase(), h]));
  const allTickers = new Set([...targetByTicker.keys(), ...holdingByTicker.keys()]);
  const warnings: string[] = [];

  let knownHoldingsValueEur = 0;
  for (const [ticker, holding] of holdingByTicker) {
    const price = normalizedPrices[ticker];
    if (!Number.isFinite(price) || price <= 0) {
      warnings.push(`PRICE_MISSING:${ticker}`);
      continue;
    }
    knownHoldingsValueEur += holding.shares * price;
  }
  const totalPortfolioValueEur = Math.max(0, portfolio.cashEur + knownHoldingsValueEur);
  const currentCashWeightPct = totalPortfolioValueEur > 0 ? portfolio.cashEur / totalPortfolioValueEur * 100 : 100;
  const targetCashWeightPct = Math.max(0, Math.min(100, targetCashWeight * 100));

  const draft: RebalanceLine[] = [];
  for (const ticker of allTickers) {
    const target = targetByTicker.get(ticker);
    const holding = holdingByTicker.get(ticker);
    const price = normalizedPrices[ticker];
    const shares = holding?.shares ?? 0;
    const currentValue = Number.isFinite(price) && price > 0 ? shares * price : 0;
    const currentWeightPct = totalPortfolioValueEur > 0 ? currentValue / totalPortfolioValueEur * 100 : 0;
    const targetWeightPct = Math.max(0, (target?.weight ?? 0) * 100);
    const targetValue = totalPortfolioValueEur * targetWeightPct / 100;
    const drift = currentWeightPct - targetWeightPct;
    if (!Number.isFinite(price) || price <= 0) {
      draft.push({ assetId: target?.assetId ?? null, ticker, priceEur: null, currentShares: shares, currentValueEur: currentValue, currentWeightPct, targetWeightPct, targetValueEur: targetValue, driftPctPoints: drift, action: 'DATA_MISSING', proposedShares: 0, estimatedNotionalEur: 0, estimatedFeeEur: 0, reason: 'No hay precio REAL disponible para valorar o rebalancear esta posición.' });
      continue;
    }
    const deltaValue = targetValue - currentValue;
    const rawShares = Math.floor(Math.abs(deltaValue) / price + 1e-9);
    if (Math.abs(drift) < driftThresholdPctPoints || rawShares < 1) {
      draft.push({ assetId: target?.assetId ?? null, ticker, priceEur: price, currentShares: shares, currentValueEur: currentValue, currentWeightPct, targetWeightPct, targetValueEur: targetValue, driftPctPoints: drift, action: 'HOLD', proposedShares: 0, estimatedNotionalEur: 0, estimatedFeeEur: 0, reason: Math.abs(drift) < driftThresholdPctPoints ? `Desviación inferior a ${driftThresholdPctPoints} pp.` : 'La corrección teórica no alcanza un título entero.' });
      continue;
    }
    if (deltaValue < 0) {
      const sellShares = Math.min(shares, rawShares);
      const notional = sellShares * price;
      const fee = commission(notional, profile);
      draft.push({ assetId: target?.assetId ?? null, ticker, priceEur: price, currentShares: shares, currentValueEur: currentValue, currentWeightPct, targetWeightPct, targetValueEur: targetValue, driftPctPoints: drift, action: sellShares > 0 ? 'SELL' : 'HOLD', proposedShares: sellShares, estimatedNotionalEur: notional, estimatedFeeEur: sellShares > 0 ? fee : 0, reason: sellShares > 0 ? 'Reducir sobreponderación usando títulos enteros.' : 'No hay títulos disponibles para vender.' });
    } else {
      const notional = rawShares * price;
      const fee = commission(notional, profile);
      draft.push({ assetId: target?.assetId ?? null, ticker, priceEur: price, currentShares: shares, currentValueEur: currentValue, currentWeightPct, targetWeightPct, targetValueEur: targetValue, driftPctPoints: drift, action: 'BUY', proposedShares: rawShares, estimatedNotionalEur: notional, estimatedFeeEur: fee, reason: 'Reducir infraponderación usando títulos enteros.' });
    }
  }

  let availableCash = portfolio.cashEur;
  let estimatedFeesEur = 0;
  for (const line of draft.filter(x => x.action === 'SELL')) {
    availableCash += Math.max(0, line.estimatedNotionalEur - line.estimatedFeeEur);
    estimatedFeesEur += line.estimatedFeeEur;
  }
  for (const line of draft.filter(x => x.action === 'BUY').sort((a, b) => Math.abs(b.driftPctPoints) - Math.abs(a.driftPctPoints))) {
    const price = line.priceEur ?? 0;
    let shares = line.proposedShares;
    while (shares > 0) {
      const notional = shares * price;
      const fee = commission(notional, profile);
      if (notional + fee <= availableCash + 1e-9) {
        line.proposedShares = shares;
        line.estimatedNotionalEur = notional;
        line.estimatedFeeEur = fee;
        availableCash -= notional + fee;
        estimatedFeesEur += fee;
        break;
      }
      shares--;
    }
    if (shares === 0) {
      line.action = 'HOLD';
      line.proposedShares = 0;
      line.estimatedNotionalEur = 0;
      line.estimatedFeeEur = 0;
      line.reason = 'Efectivo insuficiente para comprar un título entero después de ventas y comisiones.';
    }
  }

  const assetDriftAbs = draft.reduce((s, line) => s + Math.abs(line.driftPctPoints), 0);
  const cashDriftAbs = Math.abs(currentCashWeightPct - targetCashWeightPct);
  const theoreticalTurnoverPct = Math.min(100, (assetDriftAbs + cashDriftAbs) / 2);
  const maxAbsoluteDriftPctPoints = Math.max(cashDriftAbs, ...draft.map(x => Math.abs(x.driftPctPoints)), 0);
  const executableOrders = draft.filter(x => x.action === 'BUY' || x.action === 'SELL').length;
  const rebalanceRecommended = executableOrders > 0 && (maxAbsoluteDriftPctPoints >= driftThresholdPctPoints || theoreticalTurnoverPct >= 10);

  return {
    totalPortfolioValueEur,
    startingCashEur: portfolio.cashEur,
    projectedCashEur: Math.max(0, availableCash),
    knownHoldingsValueEur,
    targetCashWeightPct,
    currentCashWeightPct,
    theoreticalTurnoverPct,
    maxAbsoluteDriftPctPoints,
    estimatedFeesEur,
    executableOrders,
    rebalanceRecommended,
    lines: draft.sort((a, b) => Math.abs(b.driftPctPoints) - Math.abs(a.driftPctPoints)),
    warnings
  };
}
