import type { BrokerExecutionProfile } from './brokerExecution';
import { MYINVESTOR_BROKER_PROFILE } from './brokerExecution';

export interface CostAwareExecutionPolicyConfig {
  minimumDriftPctPoints: number;
  maximumOrderFeeDragPct: number;
  maximumRebalanceFeeDragPct: number;
  minimumOrderNotionalEur: number;
}

export interface CostAwarePosition {
  assetId: string;
  ticker: string;
  shares: number;
}

export type CostAwareSuppressionReason =
  | 'DRIFT_BELOW_THRESHOLD'
  | 'BELOW_ONE_WHOLE_SHARE'
  | 'ORDER_NOTIONAL_TOO_SMALL'
  | 'ORDER_FEE_DRAG_TOO_HIGH'
  | 'REBALANCE_FEE_BUDGET_EXCEEDED'
  | 'INSUFFICIENT_CASH';

export interface CostAwareOrder {
  assetId: string;
  ticker: string;
  side: 'BUY' | 'SELL';
  shares: number;
  marketPriceEur: number;
  notionalEur: number;
  commissionEur: number;
  feeDragPct: number;
  driftPctPointsBefore: number;
}

export interface SuppressedCostAwareOrder {
  assetId: string;
  ticker: string;
  side: 'BUY' | 'SELL';
  reason: CostAwareSuppressionReason;
  driftPctPoints: number;
  candidateNotionalEur: number;
  candidateFeeEur: number;
}

export interface CostAwareRebalanceResult {
  cashEur: number;
  equityBeforeEur: number;
  orders: CostAwareOrder[];
  suppressed: SuppressedCostAwareOrder[];
  totalCommissionEur: number;
  turnoverEur: number;
  rebalanceFeeDragPct: number;
}

export const DEFAULT_COST_AWARE_EXECUTION_POLICY: CostAwareExecutionPolicyConfig = {
  minimumDriftPctPoints: 5,
  maximumOrderFeeDragPct: 2,
  maximumRebalanceFeeDragPct: 1,
  minimumOrderNotionalEur: 50
};

export function brokerCommission(notionalEur: number, profile: BrokerExecutionProfile = MYINVESTOR_BROKER_PROFILE): number {
  if (!(notionalEur > 0)) return 0;
  const raw = notionalEur * profile.etfCommissionPct / 100;
  return Math.min(profile.etfMaxCommissionEur, Math.max(profile.etfMinCommissionEur, raw));
}

function feeDragPct(fee: number, notional: number): number {
  return notional > 0 ? fee / notional * 100 : Infinity;
}

function suppress(
  suppressed: SuppressedCostAwareOrder[],
  position: CostAwarePosition,
  side: 'BUY' | 'SELL',
  reason: CostAwareSuppressionReason,
  driftPctPoints: number,
  notional: number,
  fee: number
): void {
  suppressed.push({ assetId: position.assetId, ticker: position.ticker, side, reason, driftPctPoints, candidateNotionalEur: notional, candidateFeeEur: fee });
}

export function rebalanceCostAware(input: {
  positions: Record<string, CostAwarePosition>;
  cashEur: number;
  pricesEur: Record<string, number>;
  targetWeights: Record<string, number>;
  broker?: BrokerExecutionProfile;
  policy?: Partial<CostAwareExecutionPolicyConfig>;
}): CostAwareRebalanceResult {
  const broker = input.broker ?? MYINVESTOR_BROKER_PROFILE;
  const policy = { ...DEFAULT_COST_AWARE_EXECUTION_POLICY, ...(input.policy ?? {}) };
  let cash = Math.max(0, input.cashEur);
  const orders: CostAwareOrder[] = [];
  const suppressed: SuppressedCostAwareOrder[] = [];

  const ids = Array.from(new Set([...Object.keys(input.positions), ...Object.keys(input.targetWeights)])).sort();
  const values = Object.fromEntries(ids.map(id => {
    const p = input.positions[id];
    const price = input.pricesEur[id];
    return [id, p && price > 0 ? p.shares * price : 0];
  }));
  const equity = cash + Object.values(values).reduce((a, b) => a + b, 0);
  if (!(equity > 0)) throw new Error('Equity inválida para ejecución cost-aware.');
  const maxRebalanceFees = equity * policy.maximumRebalanceFeeDragPct / 100;
  let usedFees = 0;

  const process = (side: 'SELL' | 'BUY') => {
    const candidates = ids.map(id => {
      const position = input.positions[id] ?? { assetId: id, ticker: id, shares: 0 };
      if (!input.positions[id]) input.positions[id] = position;
      const price = input.pricesEur[id];
      const currentValue = price > 0 ? position.shares * price : 0;
      const currentWeight = currentValue / equity;
      const targetWeight = Math.max(0, input.targetWeights[id] ?? 0);
      const driftPp = (currentWeight - targetWeight) * 100;
      return { id, position, price, currentValue, currentWeight, targetWeight, driftPp };
    }).filter(x => x.price > 0 && (side === 'SELL' ? x.driftPp > 0 : x.driftPp < 0))
      .sort((a, b) => Math.abs(b.driftPp) - Math.abs(a.driftPp));

    for (const c of candidates) {
      const absoluteDrift = Math.abs(c.driftPp);
      if (absoluteDrift < policy.minimumDriftPctPoints - 1e-9) {
        suppress(suppressed, c.position, side, 'DRIFT_BELOW_THRESHOLD', c.driftPp, 0, 0);
        continue;
      }

      const targetValue = equity * c.targetWeight;
      const deltaValue = side === 'SELL' ? Math.max(0, c.currentValue - targetValue) : Math.max(0, targetValue - c.currentValue);
      let shares = Math.floor(deltaValue / c.price + 1e-9);
      if (side === 'SELL') shares = Math.min(c.position.shares, shares);
      if (shares < 1) {
        suppress(suppressed, c.position, side, 'BELOW_ONE_WHOLE_SHARE', c.driftPp, deltaValue, 0);
        continue;
      }

      let notional = shares * c.price;
      let fee = brokerCommission(notional, broker);
      if (notional + 1e-9 < policy.minimumOrderNotionalEur) {
        suppress(suppressed, c.position, side, 'ORDER_NOTIONAL_TOO_SMALL', c.driftPp, notional, fee);
        continue;
      }
      if (feeDragPct(fee, notional) > policy.maximumOrderFeeDragPct + 1e-9) {
        suppress(suppressed, c.position, side, 'ORDER_FEE_DRAG_TOO_HIGH', c.driftPp, notional, fee);
        continue;
      }
      if (usedFees + fee > maxRebalanceFees + 1e-9) {
        suppress(suppressed, c.position, side, 'REBALANCE_FEE_BUDGET_EXCEEDED', c.driftPp, notional, fee);
        continue;
      }

      if (side === 'BUY') {
        while (shares > 0 && shares * c.price + brokerCommission(shares * c.price, broker) > cash + 1e-9) shares--;
        if (shares < 1) {
          suppress(suppressed, c.position, side, 'INSUFFICIENT_CASH', c.driftPp, notional, fee);
          continue;
        }
        notional = shares * c.price;
        fee = brokerCommission(notional, broker);
        if (notional + 1e-9 < policy.minimumOrderNotionalEur || feeDragPct(fee, notional) > policy.maximumOrderFeeDragPct + 1e-9) {
          suppress(suppressed, c.position, side, notional < policy.minimumOrderNotionalEur ? 'ORDER_NOTIONAL_TOO_SMALL' : 'ORDER_FEE_DRAG_TOO_HIGH', c.driftPp, notional, fee);
          continue;
        }
        if (usedFees + fee > maxRebalanceFees + 1e-9) {
          suppress(suppressed, c.position, side, 'REBALANCE_FEE_BUDGET_EXCEEDED', c.driftPp, notional, fee);
          continue;
        }
        c.position.shares += shares;
        cash -= notional + fee;
      } else {
        c.position.shares -= shares;
        cash += notional - fee;
      }
      usedFees += fee;
      orders.push({ assetId: c.position.assetId, ticker: c.position.ticker, side, shares, marketPriceEur: c.price, notionalEur: notional, commissionEur: fee, feeDragPct: feeDragPct(fee, notional), driftPctPointsBefore: c.driftPp });
    }
  };

  process('SELL');
  process('BUY');

  if (cash < 0 && cash > -1e-8) cash = 0;
  if (cash < -1e-8) throw new Error('La política cost-aware produjo cash negativo.');
  const turnover = orders.reduce((s, x) => s + x.notionalEur, 0);
  return {
    cashEur: cash,
    equityBeforeEur: equity,
    orders,
    suppressed,
    totalCommissionEur: usedFees,
    turnoverEur: turnover,
    rebalanceFeeDragPct: equity > 0 ? usedFees / equity * 100 : 0
  };
}
