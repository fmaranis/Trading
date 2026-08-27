export interface BrokerExecutionProfile {
  id: string;
  name: string;
  supportsFractionalShares: boolean;
  etfCommissionPct: number;
  etfMinCommissionEur: number;
  etfMaxCommissionEur: number;
  fxCommissionPct: number;
}

export interface BrokerOrderProposal {
  assetId: string;
  ticker: string;
  targetAmountEur: number;
  lastPriceEur: number;
  shares: number;
  grossNotionalEur: number;
  commissionEur: number;
  totalCostEur: number;
  executable: boolean;
  reason?: string;
}

export interface BrokerExecutionPlan {
  broker: BrokerExecutionProfile;
  capitalEur: number;
  orders: BrokerOrderProposal[];
  investedEur: number;
  estimatedFeesEur: number;
  residualCashEur: number;
  executable: boolean;
  notes: string[];
}

export const MYINVESTOR_BROKER_PROFILE: BrokerExecutionProfile = {
  id: 'MYINVESTOR',
  name: 'MyInvestor',
  supportsFractionalShares: false,
  etfCommissionPct: 0.12,
  etfMinCommissionEur: 1,
  etfMaxCommissionEur: 25,
  fxCommissionPct: 0.30
};

function etfCommission(notional: number, profile: BrokerExecutionProfile): number {
  if (notional <= 0) return 0;
  const raw = notional * profile.etfCommissionPct / 100;
  return Math.min(profile.etfMaxCommissionEur, Math.max(profile.etfMinCommissionEur, raw));
}

export function buildWholeShareExecutionPlan(
  capitalEur: number,
  allocations: Array<{ assetId: string; ticker: string; amountEur: number; weight: number }>,
  lastPrices: Record<string, number>,
  profile: BrokerExecutionProfile = MYINVESTOR_BROKER_PROFILE
): BrokerExecutionPlan {
  let remaining = capitalEur;
  const orders: BrokerOrderProposal[] = [];

  const ranked = allocations
    .filter(a => a.amountEur > 0.01 && Number.isFinite(lastPrices[a.assetId]) && lastPrices[a.assetId] > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const allocation of ranked) {
    const price = lastPrices[allocation.assetId];
    let shares = Math.floor(allocation.amountEur / price);
    if (!profile.supportsFractionalShares && shares < 1) {
      orders.push({ assetId: allocation.assetId, ticker: allocation.ticker, targetAmountEur: allocation.amountEur, lastPriceEur: price, shares: 0, grossNotionalEur: 0, commissionEur: 0, totalCostEur: 0, executable: false, reason: 'TARGET_BELOW_ONE_WHOLE_SHARE' });
      continue;
    }

    while (shares > 0) {
      const gross = shares * price;
      const fee = etfCommission(gross, profile);
      if (gross + fee <= remaining + 1e-9) {
        orders.push({ assetId: allocation.assetId, ticker: allocation.ticker, targetAmountEur: allocation.amountEur, lastPriceEur: price, shares, grossNotionalEur: gross, commissionEur: fee, totalCostEur: gross + fee, executable: true });
        remaining -= gross + fee;
        break;
      }
      shares--;
    }

    if (shares === 0 && !orders.some(o => o.assetId === allocation.assetId)) {
      orders.push({ assetId: allocation.assetId, ticker: allocation.ticker, targetAmountEur: allocation.amountEur, lastPriceEur: price, shares: 0, grossNotionalEur: 0, commissionEur: 0, totalCostEur: 0, executable: false, reason: 'INSUFFICIENT_CAPITAL_AFTER_FEES' });
    }
  }

  // If the theoretical allocation cannot buy anything because all targets are below one share,
  // use residual capital on the highest-weight affordable ETF, preserving whole-share semantics.
  if (!orders.some(o => o.executable)) {
    for (const allocation of ranked) {
      const price = lastPrices[allocation.assetId];
      const maxShares = Math.floor(remaining / price);
      for (let shares = maxShares; shares >= 1; shares--) {
        const gross = shares * price;
        const fee = etfCommission(gross, profile);
        if (gross + fee <= remaining + 1e-9) {
          const existing = orders.find(o => o.assetId === allocation.assetId);
          const replacement: BrokerOrderProposal = { assetId: allocation.assetId, ticker: allocation.ticker, targetAmountEur: allocation.amountEur, lastPriceEur: price, shares, grossNotionalEur: gross, commissionEur: fee, totalCostEur: gross + fee, executable: true, reason: 'WHOLE_SHARE_FALLBACK_FROM_THEORETICAL_ALLOCATION' };
          if (existing) Object.assign(existing, replacement); else orders.push(replacement);
          remaining -= gross + fee;
          break;
        }
      }
      if (orders.some(o => o.executable)) break;
    }
  }

  const investedEur = orders.filter(o => o.executable).reduce((s, o) => s + o.grossNotionalEur, 0);
  const estimatedFeesEur = orders.filter(o => o.executable).reduce((s, o) => s + o.commissionEur, 0);
  const notes = [
    `${profile.name}: ETFs por títulos enteros; fracciones ${profile.supportsFractionalShares ? 'permitidas' : 'no permitidas'}.`,
    `Comisión ETF modelada: ${profile.etfCommissionPct.toFixed(2)}% con mínimo ${profile.etfMinCommissionEur.toFixed(2)} € y máximo ${profile.etfMaxCommissionEur.toFixed(2)} € por orden.`,
    'El plan es una aproximación con último cierre; el precio de ejecución real y cánones/spread pueden variar.'
  ];
  return { broker: profile, capitalEur, orders, investedEur, estimatedFeesEur, residualCashEur: Math.max(0, remaining), executable: orders.some(o => o.executable), notes };
}
