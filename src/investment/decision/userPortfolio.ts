import type { BrokerExecutionProfile } from './brokerExecution';
import { MYINVESTOR_BROKER_PROFILE } from './brokerExecution';

const STORAGE_KEY = 'custodia_user_portfolio_v1';

export interface UserHolding {
  ticker: string;
  shares: number;
}

export interface UserPortfolioState {
  cashEur: number;
  holdings: UserHolding[];
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

export class UserPortfolioService {
  static load(): UserPortfolioState {
    if (typeof window === 'undefined') return { cashEur: 0, holdings: [], updatedAt: new Date(0).toISOString() };
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
      return {
        cashEur: Math.max(0, Number(raw.cashEur) || 0),
        holdings: Array.isArray(raw.holdings)
          ? raw.holdings.filter((h: any) => h && String(h.ticker || '').trim()).map((h: any) => ({ ticker: String(h.ticker).trim().toUpperCase(), shares: Math.max(0, Number(h.shares) || 0) }))
          : [],
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString()
      };
    } catch {
      return { cashEur: 0, holdings: [], updatedAt: new Date(0).toISOString() };
    }
  }

  static save(input: { cashEur: number; holdings: UserHolding[] }): UserPortfolioState {
    const state: UserPortfolioState = {
      cashEur: Math.max(0, Number(input.cashEur) || 0),
      holdings: input.holdings
        .map(h => ({ ticker: h.ticker.trim().toUpperCase(), shares: Math.max(0, Number(h.shares) || 0) }))
        .filter(h => h.ticker && h.shares > 0),
      updatedAt: new Date().toISOString()
    };
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  static clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
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
