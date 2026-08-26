import { PortfolioBacktestConfig, PortfolioTrade, RebalanceFrequency } from './types';

export interface MutablePortfolioPosition {
  assetId: string;
  ticker: string;
  shares: number;
}

export interface RebalanceContext {
  timestamp: string;
  prices: Record<string, number>;
  positions: Record<string, MutablePortfolioPosition>;
  cash: number;
  config: PortfolioBacktestConfig;
  reason: PortfolioTrade['reason'];
}

export interface RebalanceResult {
  cash: number;
  trades: PortfolioTrade[];
}

function fillPrice(marketPrice: number, side: 'BUY' | 'SELL', slippagePct: number): number {
  const slip = slippagePct / 100;
  return side === 'BUY' ? marketPrice * (1 + slip) : marketPrice * (1 - slip);
}

function commission(notional: number, commissionPct: number): number {
  return notional * (commissionPct / 100);
}

export function isRebalanceDate(previousDate: string | null, currentDate: string, frequency: RebalanceFrequency): boolean {
  if (!previousDate || frequency === 'NONE') return false;
  const prev = new Date(`${previousDate}T00:00:00Z`);
  const curr = new Date(`${currentDate}T00:00:00Z`);
  if (frequency === 'MONTHLY') return prev.getUTCMonth() !== curr.getUTCMonth() || prev.getUTCFullYear() !== curr.getUTCFullYear();
  const prevQuarter = Math.floor(prev.getUTCMonth() / 3);
  const currQuarter = Math.floor(curr.getUTCMonth() / 3);
  return prevQuarter !== currQuarter || prev.getUTCFullYear() !== curr.getUTCFullYear();
}

export class RebalanceEngine {
  public static rebalance(ctx: RebalanceContext): RebalanceResult {
    const { config, prices, positions, timestamp, reason } = ctx;
    let cash = ctx.cash;
    const trades: PortfolioTrade[] = [];
    const tolerance = (config.rebalanceTolerancePct ?? 0.25) / 100;

    const positionValues = Object.fromEntries(Object.entries(positions).map(([id, p]) => [id, p.shares * prices[id]]));
    const equity = cash + Object.values(positionValues).reduce((a, b) => a + b, 0);
    if (!(equity > 0)) throw new Error('Equity inválida durante rebalanceo.');

    const targetValues: Record<string, number> = {};
    for (const assetId of Object.keys(config.targetWeights)) {
      targetValues[assetId] = equity * config.targetWeights[assetId];
    }

    const sortedIds = Object.keys(config.targetWeights).sort();

    // Sell first to release cash.
    for (const assetId of sortedIds) {
      const position = positions[assetId];
      const marketPrice = prices[assetId];
      const currentValue = position.shares * marketPrice;
      const targetValue = targetValues[assetId];
      const currentWeight = currentValue / equity;
      const targetWeight = config.targetWeights[assetId];
      if (currentWeight <= targetWeight + tolerance || currentValue <= targetValue) continue;

      const sharesToSell = Math.min(position.shares, (currentValue - targetValue) / marketPrice);
      if (sharesToSell <= 0) continue;
      const effectiveFill = fillPrice(marketPrice, 'SELL', config.slippagePct);
      const notional = sharesToSell * effectiveFill;
      const fee = commission(notional, config.commissionPct);
      const slipEur = sharesToSell * Math.max(0, marketPrice - effectiveFill);
      position.shares -= sharesToSell;
      cash += notional - fee;
      trades.push({
        id: `pf_${timestamp}_${assetId}_SELL_${trades.length + 1}`,
        timestamp, assetId, ticker: position.ticker, side: 'SELL', shares: sharesToSell,
        marketPrice, fillPrice: effectiveFill, notionalEur: notional, commissionEur: fee,
        slippageEur: slipEur, reason
      });
    }

    // Then buy deficits, bounded by available cash.
    for (const assetId of sortedIds) {
      const position = positions[assetId];
      const marketPrice = prices[assetId];
      const currentValue = position.shares * marketPrice;
      const targetValue = targetValues[assetId];
      const currentWeight = currentValue / equity;
      const targetWeight = config.targetWeights[assetId];
      if (currentWeight >= targetWeight - tolerance || currentValue >= targetValue || cash <= 0) continue;

      const desiredMarketDeficit = targetValue - currentValue;
      const effectiveFill = fillPrice(marketPrice, 'BUY', config.slippagePct);
      const feeRate = config.commissionPct / 100;
      const maxSharesByCash = cash / (effectiveFill * (1 + feeRate));
      const desiredShares = desiredMarketDeficit / marketPrice;
      const sharesToBuy = Math.min(desiredShares, maxSharesByCash);
      if (sharesToBuy <= 0) continue;
      const notional = sharesToBuy * effectiveFill;
      const fee = commission(notional, config.commissionPct);
      const slipEur = sharesToBuy * Math.max(0, effectiveFill - marketPrice);
      const totalCost = notional + fee;
      position.shares += sharesToBuy;
      cash -= totalCost;
      if (cash < 0 && cash > -1e-8) cash = 0;
      trades.push({
        id: `pf_${timestamp}_${assetId}_BUY_${trades.length + 1}`,
        timestamp, assetId, ticker: position.ticker, side: 'BUY', shares: sharesToBuy,
        marketPrice, fillPrice: effectiveFill, notionalEur: notional, commissionEur: fee,
        slippageEur: slipEur, reason
      });
    }

    return { cash, trades };
  }
}
