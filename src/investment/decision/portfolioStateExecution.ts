import type { FundPosition } from './fundPortfolio';
import { PortfolioExecutionHistoryService } from './portfolioExecutionHistory';
import type { PortfolioExecutionLine } from './portfolioExecutionPlan';
import { TaxLotLedgerService } from './spanishTaxModel';
import { UserPortfolioService, type UserHolding, type UserPortfolioState } from './userPortfolio';

export interface PortfolioStateExecutionReceipt {
  lineId: string;
  action: PortfolioExecutionLine['action'];
  appliedAt: string;
  description: string;
  liquidityBeforeEur: number;
  liquidityAfterEur: number;
  portfolio: UserPortfolioState;
}

function liquidity(state: UserPortfolioState): number {
  return Math.max(0, state.cashEur) + Math.max(0, state.stagedCapitalPlan?.availableEur ?? 0);
}

function consumeLiquidity(state: UserPortfolioState, amountEur: number): UserPortfolioState {
  const amount = Math.max(0, amountEur);
  const available = liquidity(state);
  if (amount > available + 1e-6) throw new Error(`Liquidez insuficiente: se necesitan ${amount.toFixed(2)} € y hay ${available.toFixed(2)} € disponibles.`);

  const pendingBefore = Math.max(0, state.stagedCapitalPlan?.availableEur ?? 0);
  const fromPending = Math.min(pendingBefore, amount);
  const fromCash = amount - fromPending;
  return {
    ...state,
    cashEur: Math.max(0, state.cashEur - fromCash),
    stagedCapitalPlan: {
      availableEur: Math.max(0, pendingBefore - fromPending),
      horizonMonths: Math.max(1, state.stagedCapitalPlan?.horizonMonths ?? 12),
      preferredMode: 'MONTHLY'
    }
  };
}

function addHolding(holdings: UserHolding[], ticker: string, shares: number): UserHolding[] {
  const key = ticker.trim().toUpperCase();
  const existing = holdings.find(item => item.ticker.toUpperCase() === key);
  if (!existing) return [...holdings, { ticker: key, shares }];
  return holdings.map(item => item.ticker.toUpperCase() === key ? { ...item, shares: item.shares + shares } : item);
}

function reduceHolding(holdings: UserHolding[], ticker: string, shares: number): UserHolding[] {
  const key = ticker.trim().toUpperCase();
  const existing = holdings.find(item => item.ticker.toUpperCase() === key);
  if (!existing || existing.shares + 1e-9 < shares) throw new Error(`No hay ${shares} títulos de ${key} disponibles para vender.`);
  return holdings
    .map(item => item.ticker.toUpperCase() === key ? { ...item, shares: Math.max(0, item.shares - shares) } : item)
    .filter(item => item.shares > 1e-9);
}

function fundCategory(category: string): FundPosition['category'] {
  if (category === 'GLOBAL_EQUITY') return 'GLOBAL_EQUITY';
  if (category === 'EMERGING_EQUITY') return 'EMERGING_EQUITY';
  return 'OTHER';
}

function addFundPosition(funds: FundPosition[], line: PortfolioExecutionLine, amountEur: number): FundPosition[] {
  const isin = String(line.targetIsin ?? line.targetTicker ?? '').trim().toUpperCase();
  const id = line.targetAssetId ?? (isin ? `fund_${isin}` : `fund_exec_${Date.now()}`);
  const addedUnitsRaw = line.shares == null ? null : Number(line.shares);
  const addedUnits = addedUnitsRaw != null && Number.isFinite(addedUnitsRaw) && addedUnitsRaw > 0 ? addedUnitsRaw : null;
  const existing = funds.find(fund => fund.id === id || (!!isin && fund.isin.toUpperCase() === isin));
  if (existing) {
    return funds.map(fund => fund.id === existing.id ? {
      ...fund,
      investedEur: fund.investedEur + amountEur,
      currentValueEur: (fund.currentValueEur ?? fund.investedEur) + amountEur,
      units: fund.units != null && addedUnits != null ? fund.units + addedUnits : null
    } : fund);
  }
  return [...funds, {
    id,
    isin,
    name: line.targetName ?? line.targetTicker ?? 'Fondo ejecutado',
    category: fundCategory(line.category),
    investedEur: amountEur,
    acquisitionDate: new Date().toISOString().slice(0, 10),
    currentValueEur: amountEur,
    units: addedUnits,
    transferable: true,
    broker: 'MyInvestor'
  }];
}

function reduceFundPosition(funds: FundPosition[], line: PortfolioExecutionLine, requestedAmountEur: number): { funds: FundPosition[]; amountEur: number } {
  const source = funds.find(fund => fund.id === line.sourceId || (!!line.sourceIsin && fund.isin.toUpperCase() === line.sourceIsin.toUpperCase()));
  if (!source) throw new Error('No se encuentra el fondo origen en la cartera actual.');
  const currentValue = Math.max(0, source.currentValueEur ?? source.investedEur);
  const amount = Math.min(currentValue, Math.max(0, requestedAmountEur));
  if (amount <= 0) throw new Error('El importe a reducir del fondo no es válido.');
  const remainingValue = Math.max(0, currentValue - amount);
  const ratio = currentValue > 0 ? remainingValue / currentValue : 0;
  const nextFunds = funds
    .map(fund => fund.id === source.id ? {
      ...fund,
      investedEur: Math.max(0, fund.investedEur * ratio),
      currentValueEur: remainingValue,
      units: fund.units == null ? null : Math.max(0, fund.units * ratio)
    } : fund)
    .filter(fund => fund.id !== source.id || (fund.currentValueEur ?? fund.investedEur) > 0.01);
  return { funds: nextFunds, amountEur: amount };
}

export function applyPortfolioExecutionLine(portfolio: UserPortfolioState, line: PortfolioExecutionLine): PortfolioStateExecutionReceipt {
  if (line.status !== 'PENDING') throw new Error('La operación ya no está pendiente.');
  if (line.action === 'REVIEW') throw new Error('Una línea de revisión no puede aplicarse como operación ejecutada.');

  const liquidityBeforeEur = liquidity(portfolio);
  let next: UserPortfolioState = {
    ...portfolio,
    holdings: [...portfolio.holdings],
    funds: [...(portfolio.funds ?? [])],
    stagedCapitalPlan: {
      availableEur: Math.max(0, portfolio.stagedCapitalPlan?.availableEur ?? 0),
      horizonMonths: Math.max(1, portfolio.stagedCapitalPlan?.horizonMonths ?? 12),
      preferredMode: 'MONTHLY'
    }
  };
  let description = '';

  if (line.action === 'BUY_ETF') {
    const ticker = line.targetTicker;
    const shares = Number(line.shares ?? 0);
    const notional = Number(line.amountEur ?? 0);
    const fee = Math.max(0, Number(line.estimatedFeeEur ?? 0));
    if (!ticker || shares <= 0 || notional <= 0) throw new Error('La compra ETF no tiene ticker, títulos o importe válidos.');
    next = consumeLiquidity(next, notional + fee);
    next.holdings = addHolding(next.holdings, ticker, shares);
    description = `Compra aplicada: +${shares} ${ticker}; liquidez -${(notional + fee).toFixed(2)} €.`;
  } else if (line.action === 'SELL_ETF') {
    const ticker = line.targetTicker ?? line.sourceId;
    const shares = Number(line.shares ?? 0);
    const notional = Number(line.amountEur ?? 0);
    const fee = Math.max(0, Number(line.estimatedFeeEur ?? 0));
    if (!ticker || shares <= 0 || notional <= 0) throw new Error('La venta ETF no tiene ticker, títulos o importe válidos.');
    next.holdings = reduceHolding(next.holdings, ticker, shares);
    next.cashEur += Math.max(0, notional - fee);
    description = `Venta aplicada: -${shares} ${ticker}; efectivo +${Math.max(0, notional - fee).toFixed(2)} € netos de comisión. La reserva fiscal estimada se muestra en el plan y no se descuenta del saldo real del broker.`;
  } else if (line.action === 'SUBSCRIBE_FUND') {
    const amount = Number(line.amountEur ?? 0);
    if (amount <= 0) throw new Error('La suscripción no tiene un importe válido.');
    next = consumeLiquidity(next, amount);
    next.funds = addFundPosition(next.funds ?? [], line, amount);
    const units = line.shares != null && Number(line.shares) > 0 ? ` · +${Number(line.shares)} participaciones registradas` : ' · participaciones pendientes de confirmar';
    description = `Suscripción aplicada: ${line.targetName ?? line.targetIsin ?? 'fondo'} +${amount.toFixed(2)} €${units}.`;
  } else if (line.action === 'REDEEM_FUND') {
    const requested = Number(line.amountEur ?? 0);
    if (requested <= 0) throw new Error('El reembolso no tiene un importe válido.');
    const reduced = reduceFundPosition(next.funds ?? [], line, requested);
    next.funds = reduced.funds;
    next.cashEur += reduced.amountEur;
    description = `Reembolso aplicado: ${line.sourceLabel ?? line.sourceIsin ?? 'fondo'} -${reduced.amountEur.toFixed(2)} €; efectivo bruto actualizado. La estimación fiscal queda separada del saldo real.`;
  } else if (line.action === 'TRANSFER_FUND') {
    const requested = Number(line.amountEur ?? 0);
    if (requested <= 0) throw new Error('El traspaso no tiene un importe válido.');
    const reduced = reduceFundPosition(next.funds ?? [], line, requested);
    next.funds = addFundPosition(reduced.funds, line, reduced.amountEur);
    description = `Traspaso aplicado: ${reduced.amountEur.toFixed(2)} € de ${line.sourceLabel ?? 'fondo origen'} a ${line.targetName ?? 'fondo destino'}; la liquidez no cambia.`;
  }

  next.updatedAt = new Date().toISOString();
  return {
    lineId: line.id,
    action: line.action,
    appliedAt: next.updatedAt,
    description,
    liquidityBeforeEur,
    liquidityAfterEur: liquidity(next),
    portfolio: next
  };
}

export class PortfolioStateExecutionService {
  static execute(line: PortfolioExecutionLine): PortfolioStateExecutionReceipt {
    const before = UserPortfolioService.load();
    const receipt = applyPortfolioExecutionLine(before, line);
    const saved = UserPortfolioService.save({
      cashEur: receipt.portfolio.cashEur,
      holdings: receipt.portfolio.holdings,
      funds: receipt.portfolio.funds,
      stagedCapitalPlan: receipt.portfolio.stagedCapitalPlan
    });

    if (line.action === 'BUY_ETF' && line.targetTicker && (line.shares ?? 0) > 0) {
      TaxLotLedgerService.recordBuy(
        line.targetTicker,
        Number(line.shares),
        Math.max(0, Number(line.amountEur ?? 0)) + Math.max(0, Number(line.estimatedFeeEur ?? 0)),
        receipt.appliedAt.slice(0, 10)
      );
    } else if (line.action === 'SELL_ETF') {
      const ticker = line.targetTicker ?? line.sourceId;
      const sold = Math.max(0, Number(line.shares ?? 0));
      const beforeShares = before.holdings.find(h => h.ticker.toUpperCase() === String(ticker ?? '').toUpperCase())?.shares ?? 0;
      if (ticker && sold > 0) TaxLotLedgerService.recordSell(ticker, beforeShares, sold);
    }

    PortfolioExecutionHistoryService.record(line, receipt.appliedAt);
    return { ...receipt, portfolio: saved, liquidityAfterEur: liquidity(saved) };
  }
}