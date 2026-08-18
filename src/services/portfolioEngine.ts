import { Portfolio, Asset, SimulatedOrder, Position } from '../types';
import { INITIAL_PORTFOLIO_STATE, CONSERVATIVE_ASSETS, ALL_AVAILABLE_ASSETS } from '../data/marketData';

export class PortfolioEngine {
  /**
   * Returns a fresh initial 100€ portfolio
   */
  public static getInitialPortfolio(): Portfolio {
    const raw = INITIAL_PORTFOLIO_STATE;
    const history = [
      { date: '2026-02', totalValue: 98.20, cash: 40.0, invested: 58.20 },
      { date: '2026-04', totalValue: 99.10, cash: 40.0, invested: 59.10 },
      { date: '2026-06', totalValue: 99.85, cash: 40.0, invested: 59.85 },
      { date: '2026-08', totalValue: 100.00, cash: 40.0, invested: 60.00 }
    ];

    const initialPortfolio: Portfolio = {
      initialCapital: raw.initialCapital,
      cashBalance: raw.cashBalance,
      vaultWithdrawnAmount: 0.0,
      positions: raw.positions,
      totalValuation: 100.0,
      totalPnlAmount: 0.0,
      totalPnlPercentage: 0.0,
      maxDrawdown: 1.8,
      portfolioRiskScore: 2.1,
      weightedTer: 0.10,
      cashReservePercentage: 40.0,
      history
    };

    return this.recalculate(initialPortfolio, ALL_AVAILABLE_ASSETS);
  }

  /**
   * Recalculates metrics with current prices
   */
  public static recalculate(portfolio: Portfolio, assets: Asset[] = ALL_AVAILABLE_ASSETS): Portfolio {
    let currentPositionsVal = 0;
    let weightedTerSum = 0;
    let totalRiskSum = 0;

    const updatedPositions: Position[] = portfolio.positions.map(pos => {
      const asset = assets.find(a => a.id === pos.assetId);
      const price = asset ? asset.currentPrice : pos.currentPrice;
      const currentVal = pos.shares * price;
      const pnlAmt = currentVal - pos.investedAmount;
      const pnlPct = pos.investedAmount > 0 ? (pnlAmt / pos.investedAmount) * 100 : 0;
      const highestPriceSeen = pos.highestPriceSeen ? Math.max(pos.highestPriceSeen, price) : price;

      currentPositionsVal += currentVal;
      if (asset) {
        weightedTerSum += (asset.ter * currentVal);
        totalRiskSum += (asset.riskLevel * currentVal);
      }

      return {
        ...pos,
        currentPrice: price,
        highestPriceSeen,
        currentValuation: currentVal,
        pnlAmount: pnlAmt,
        pnlPercentage: pnlPct,
        weightPercentage: 0
      };
    });

    const activeAssetsValuation = portfolio.cashBalance + currentPositionsVal;
    const totalValuation = activeAssetsValuation;
    const effectiveTotalWealth = totalValuation + (portfolio.vaultWithdrawnAmount || 0);
    const totalPnlAmount = effectiveTotalWealth - portfolio.initialCapital;
    const totalPnlPercentage = portfolio.initialCapital > 0 ? (totalPnlAmount / portfolio.initialCapital) * 100 : 0;
    const weightedTer = currentPositionsVal > 0 ? (weightedTerSum / currentPositionsVal) : 0;
    const cashReservePercentage = totalValuation > 0 ? (portfolio.cashBalance / totalValuation) * 100 : 100;
    const portfolioRiskScore = currentPositionsVal > 0 ? Number((totalRiskSum / currentPositionsVal).toFixed(1)) : 1.0;

    const finalPositions = updatedPositions.map(p => ({
      ...p,
      weightPercentage: totalValuation > 0 ? Number(((p.currentValuation / totalValuation) * 100).toFixed(2)) : 0
    }));

    return {
      ...portfolio,
      positions: finalPositions,
      vaultWithdrawnAmount: portfolio.vaultWithdrawnAmount || 0,
      totalValuation: Number(totalValuation.toFixed(2)),
      totalPnlAmount: Number(totalPnlAmount.toFixed(2)),
      totalPnlPercentage: Number(totalPnlPercentage.toFixed(2)),
      weightedTer: Number(weightedTer.toFixed(3)),
      cashReservePercentage: Number(cashReservePercentage.toFixed(1)),
      portfolioRiskScore
    };
  }

  /**
   * Executes a paper trading order
   */
  public static executeOrder(portfolio: Portfolio, order: SimulatedOrder, asset: Asset): Portfolio {
    if (order.orderType === 'BUY') {
      const sharesToBuy = order.amountEur / order.executionPrice;
      const newCash = portfolio.cashBalance - order.amountEur;

      const existingIndex = portfolio.positions.findIndex(p => p.assetId === asset.id);
      const newPositions = [...portfolio.positions];

      if (existingIndex >= 0) {
        const existing = newPositions[existingIndex];
        const newShares = existing.shares + sharesToBuy;
        const newInvested = existing.investedAmount + order.amountEur;
        const newAvgPrice = newInvested / newShares;

        newPositions[existingIndex] = {
          ...existing,
          shares: newShares,
          investedAmount: newInvested,
          averageBuyPrice: newAvgPrice,
          currentPrice: order.executionPrice,
          highestPriceSeen: Math.max(existing.highestPriceSeen || order.executionPrice, order.executionPrice),
          currentValuation: newShares * order.executionPrice,
          pnlAmount: (newShares * order.executionPrice) - newInvested,
          pnlPercentage: ((newShares * order.executionPrice - newInvested) / newInvested) * 100,
          weightPercentage: 0
        };
      } else {
        newPositions.push({
          assetId: asset.id,
          shares: sharesToBuy,
          averageBuyPrice: order.executionPrice,
          currentPrice: order.executionPrice,
          highestPriceSeen: order.executionPrice,
          investedAmount: order.amountEur,
          currentValuation: order.amountEur,
          pnlAmount: 0,
          pnlPercentage: 0,
          weightPercentage: 0
        });
      }

      const updated = {
        ...portfolio,
        cashBalance: Number(newCash.toFixed(2)),
        positions: newPositions
      };

      return this.recalculate(updated, ALL_AVAILABLE_ASSETS);
    } else {
      // SELL ORDER
      const existingIndex = portfolio.positions.findIndex(p => p.assetId === asset.id);
      if (existingIndex < 0) return portfolio;

      const existing = portfolio.positions[existingIndex];
      const sharesToSell = order.amountEur / order.executionPrice;
      const newCash = portfolio.cashBalance + order.amountEur;

      let newPositions = [...portfolio.positions];
      if (existing.shares - sharesToSell <= 0.0001) {
        // Full liquidation
        newPositions.splice(existingIndex, 1);
      } else {
        const remainingShares = existing.shares - sharesToSell;
        const proportionSold = sharesToSell / existing.shares;
        const newInvested = existing.investedAmount * (1 - proportionSold);

        newPositions[existingIndex] = {
          ...existing,
          shares: remainingShares,
          investedAmount: newInvested,
          currentValuation: remainingShares * order.executionPrice,
          pnlAmount: (remainingShares * order.executionPrice) - newInvested,
          pnlPercentage: newInvested > 0 ? (((remainingShares * order.executionPrice) - newInvested) / newInvested) * 100 : 0,
          weightPercentage: 0
        };
      }

      const updated = {
        ...portfolio,
        cashBalance: Number(newCash.toFixed(2)),
        positions: newPositions
      };

      return this.recalculate(updated, ALL_AVAILABLE_ASSETS);
    }
  }

  /**
   * Simulates a historical stress test scenario for the current 100€ portfolio
   */
  public static runStressTest(scenario: 'covid_2020' | 'rate_hikes_2022' | 'lehman_2008', currentValuation: number) {
    switch (scenario) {
      case 'covid_2020':
        return {
          title: 'Caída Rápida Pandemia (Feb-Mar 2020)',
          description: 'Renta variable mundial cayó un -34% en 33 días. Los bonos soberanos y monetarios amortiguaron.',
          marketEquityShock: -34.0,
          conservativePortfolioImpactPct: -3.85,
          valueBefore: currentValuation,
          valueAfter: currentValuation * (1 - 0.0385),
          lossEur: currentValuation * 0.0385,
          recoveryTimeMonths: 4,
          keyLearning: 'El 40% en monetario y 35% en bonos evitó que la cartera de 100€ sufriera una pérdida mayor al 4%.'
        };
      case 'rate_hikes_2022':
        return {
          title: 'Subida Histórica de Tipos BCE (2022)',
          description: 'Inflación al 10% y caída simultánea de bonos de largo plazo (-16%) y acciones (-18%).',
          marketEquityShock: -18.0,
          conservativePortfolioImpactPct: -2.60,
          valueBefore: currentValuation,
          valueAfter: currentValuation * (1 - 0.026),
          lossEur: currentValuation * 0.026,
          recoveryTimeMonths: 8,
          keyLearning: 'Los fondos monetarios indexados al tipo €STR se beneficiaron rápidamente de las subidas de tipos.'
        };
      case 'lehman_2008':
        return {
          title: 'Crisis Financiera Global (2008)',
          description: 'Colapso bancario sistémico con caída del S&P500 del -50% a lo largo de 17 meses.',
          marketEquityShock: -50.0,
          conservativePortfolioImpactPct: -5.90,
          valueBefore: currentValuation,
          valueAfter: currentValuation * (1 - 0.059),
          lossEur: currentValuation * 0.059,
          recoveryTimeMonths: 14,
          keyLearning: 'Incluso en la peor crisis del siglo, una cartera con 15% en renta variable solo pierde ~6€ de cada 100€.'
        };
    }
  }

  /**
   * DCA Planner calculation: Compounding simulation
   */
  public static calculateDcaProjection(initialEur: number, monthlyEur: number, years: number, expectedReturnAnnualPct: number) {
    const totalMonths = years * 12;
    const monthlyRate = Math.pow(1 + expectedReturnAnnualPct / 100, 1 / 12) - 1;
    let balance = initialEur;
    let totalInvested = initialEur;
    const dataPoints: { year: number; balance: number; invested: number; totalGains: number }[] = [];

    dataPoints.push({
      year: 0,
      balance: initialEur,
      invested: initialEur,
      totalGains: 0
    });

    for (let m = 1; m <= totalMonths; m++) {
      balance = (balance + monthlyEur) * (1 + monthlyRate);
      totalInvested += monthlyEur;

      if (m % 12 === 0) {
        dataPoints.push({
          year: m / 12,
          balance: Number(balance.toFixed(2)),
          invested: Number(totalInvested.toFixed(2)),
          totalGains: Number((balance - totalInvested).toFixed(2))
        });
      }
    }

    return {
      finalBalance: Number(balance.toFixed(2)),
      totalInvested: Number(totalInvested.toFixed(2)),
      totalGains: Number((balance - totalInvested).toFixed(2)),
      dataPoints
    };
  }
}
