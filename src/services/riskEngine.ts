import { Portfolio, Asset, RiskRule } from '../types';

export interface ValidationOutcome {
  isValid: boolean;
  blockers: string[];
  warnings: string[];
  projectedCashAfter: number;
  projectedAssetExposurePct: number;
  projectedRiskScore: number;
  preTradeSafetyChecklist: {
    rule: string;
    status: 'pass' | 'fail' | 'warn';
    detail: string;
  }[];
}

export class RiskEngine {
  public static readonly MAX_EXPOSURE_PCT = 35.0; // Max 35% in any single asset for 100€ portfolio
  public static readonly MIN_CASH_BUFFER_PCT = 20.0; // Min 20% cash reserve (20€)
  public static readonly MAX_TOLERABLE_DRAWDOWN_PCT = 5.0; // Max drawdown guard

  /**
   * Evaluates if a trade intent complies with conservative rules
   */
  public static validateTrade(
    portfolio: Portfolio,
    asset: Asset,
    amountEur: number,
    type: 'BUY' | 'SELL'
  ): ValidationOutcome {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const checklist: ValidationOutcome['preTradeSafetyChecklist'] = [];

    const totalValuation = portfolio.totalValuation || portfolio.initialCapital;

    if (type === 'BUY') {
      // 1. Check Cash Availability
      if (amountEur <= 0) {
        blockers.push('El importe a invertir debe ser superior a 0,00 €.');
        checklist.push({ rule: 'Importe Válido', status: 'fail', detail: 'Importe no puede ser cero o negativo' });
      } else if (amountEur > portfolio.cashBalance) {
        blockers.push(`Saldo de liquidez insuficiente. Tienes ${portfolio.cashBalance.toFixed(2)} € disponibles e intentas comprar ${amountEur.toFixed(2)} €.`);
        checklist.push({ rule: 'Saldo Disponible', status: 'fail', detail: `Faltan ${(amountEur - portfolio.cashBalance).toFixed(2)} €` });
      } else {
        checklist.push({ rule: 'Saldo Disponible', status: 'pass', detail: `Disponibles ${portfolio.cashBalance.toFixed(2)} €` });
      }

      // 2. Check Minimum Cash Buffer Rule (Min 20%)
      const projectedCash = portfolio.cashBalance - amountEur;
      const projectedCashPct = totalValuation > 0 ? (projectedCash / totalValuation) * 100 : 0;

      if (projectedCashPct < this.MIN_CASH_BUFFER_PCT) {
        blockers.push(
          `Violación de Reserva de Seguridad: Tu liquidez quedaría en ${projectedCash.toFixed(2)} € (${projectedCashPct.toFixed(1)}%), por debajo del mínimo de seguridad obligatorio del ${this.MIN_CASH_BUFFER_PCT}% (${(totalValuation * (this.MIN_CASH_BUFFER_PCT / 100)).toFixed(2)} €).`
        );
        checklist.push({
          rule: 'Colchón de Liquidez (Mín 20%)',
          status: 'fail',
          detail: `Quedaría en ${projectedCashPct.toFixed(1)}% (Límite: ${this.MIN_CASH_BUFFER_PCT}%)`
        });
      } else {
        checklist.push({
          rule: 'Colchón de Liquidez (Mín 20%)',
          status: 'pass',
          detail: `Quedaría en un seguro ${projectedCashPct.toFixed(1)}%`
        });
      }

      // 3. Check Single Asset Exposure Concentration
      const currentPos = portfolio.positions.find(p => p.assetId === asset.id);
      const currentVal = currentPos ? currentPos.currentValuation : 0;
      const projectedAssetVal = currentVal + amountEur;
      const projectedExposurePct = totalValuation > 0 ? (projectedAssetVal / totalValuation) * 100 : 0;

      if (projectedExposurePct > this.MAX_EXPOSURE_PCT) {
        blockers.push(
          `Límite de Concentración Superado: La posición en "${asset.name}" alcanzaría el ${projectedExposurePct.toFixed(1)}% (${projectedAssetVal.toFixed(2)} €). El límite máximo prudencial es del ${this.MAX_EXPOSURE_PCT}% (${(totalValuation * (this.MAX_EXPOSURE_PCT / 100)).toFixed(2)} €).`
        );
        checklist.push({
          rule: 'Diversificación (Máx 35% por activo)',
          status: 'fail',
          detail: `Alcanzaría el ${projectedExposurePct.toFixed(1)}%`
        });
      } else if (projectedExposurePct > 28.0) {
        warnings.push(`Aviso de concentración: La posición alcanzará el ${projectedExposurePct.toFixed(1)}%, acercándose al límite prudencial.`);
        checklist.push({
          rule: 'Diversificación (Máx 35% por activo)',
          status: 'warn',
          detail: `En rango de atención: ${projectedExposurePct.toFixed(1)}%`
        });
      } else {
        checklist.push({
          rule: 'Diversificación (Máx 35% por activo)',
          status: 'pass',
          detail: `Adecuado: ${projectedExposurePct.toFixed(1)}%`
        });
      }

      // 4. Check CNMV Risk Level
      if (asset.riskLevel >= 5) {
        warnings.push(`Activo con nivel de riesgo CNMV ${asset.riskLevel}/7. Asegúrate de entender que la renta variable tiene oscilaciones de precio.`);
        checklist.push({
          rule: 'Nivel de Riesgo del Activo',
          status: 'warn',
          detail: `CNMV ${asset.riskLevel}/7 - Renta Variable`
        });
      } else {
        checklist.push({
          rule: 'Nivel de Riesgo del Activo',
          status: 'pass',
          detail: `CNMV ${asset.riskLevel}/7 - Conservador / Defensivo`
        });
      }

      // 5. Check Drawdown State
      const currentDrawdown = Math.abs(Math.min(0, portfolio.totalPnlPercentage));
      if (currentDrawdown >= this.MAX_TOLERABLE_DRAWDOWN_PCT && asset.riskLevel >= 4) {
        warnings.push(`La cartera tiene una caída acumulada del ${currentDrawdown.toFixed(1)}%. Comprar activos de riesgo 4+ puede aumentar la volatilidad temporal.`);
      }

      return {
        isValid: blockers.length === 0,
        blockers,
        warnings,
        projectedCashAfter: projectedCash,
        projectedAssetExposurePct: projectedExposurePct,
        projectedRiskScore: asset.riskLevel <= 2 ? 1.8 : 2.5,
        preTradeSafetyChecklist: checklist
      };
    } else {
      // SELL ORDER
      const currentPos = portfolio.positions.find(p => p.assetId === asset.id);
      if (!currentPos || currentPos.currentValuation < amountEur) {
        blockers.push(`No dispones de suficientes participaciones en "${asset.name}" para vender ${amountEur.toFixed(2)} €.`);
      }
      return {
        isValid: blockers.length === 0,
        blockers,
        warnings,
        projectedCashAfter: portfolio.cashBalance + amountEur,
        projectedAssetExposurePct: 0,
        projectedRiskScore: 1.5,
        preTradeSafetyChecklist: [
          { rule: 'Posición Existente', status: currentPos ? 'pass' : 'fail', detail: currentPos ? `Valor actual: ${currentPos.currentValuation.toFixed(2)} €` : 'Sin posición' },
          { rule: 'Traspaso vs Venta', status: 'warn', detail: 'Recuerda que en España puedes traspasar fondos sin tributar en vez de vender' }
        ]
      };
    }
  }

  /**
   * Generates standard audit risk rules summary for UI
   */
  public static getPortfolioRiskRules(portfolio: Portfolio): RiskRule[] {
    const totalVal = portfolio.totalValuation || 100;
    const cashPct = (portfolio.cashBalance / totalVal) * 100;
    
    // Find max position
    let maxPosPct = 0;
    portfolio.positions.forEach(p => {
      if (p.weightPercentage > maxPosPct) maxPosPct = p.weightPercentage;
    });

    const drawdown = Math.abs(Math.min(0, portfolio.totalPnlPercentage));

    return [
      {
        id: 'cash-reserve',
        title: 'Buffer de Liquidez de Emergencia',
        description: 'Mínimo del 20% del patrimonio en efectivo para imprevistos y compras con descuento.',
        limitValue: 20.0,
        currentValue: cashPct,
        unit: '%',
        status: cashPct >= 20.0 ? 'safe' : cashPct >= 10.0 ? 'warning' : 'breached',
        category: 'cash_reserve'
      },
      {
        id: 'max-exposure',
        title: 'Límite de Concentración Máxima',
        description: 'Ningún fondo o activo individual puede exceder el 35% de la cartera total.',
        limitValue: 35.0,
        currentValue: maxPosPct,
        unit: '%',
        status: maxPosPct <= 35.0 ? 'safe' : 'breached',
        category: 'exposure'
      },
      {
        id: 'drawdown-guard',
        title: 'Límite de Drawdown Defensivo',
        description: 'Umbral máximo de tolerancia a caídas temporales de la cartera.',
        limitValue: 5.0,
        currentValue: drawdown,
        unit: '%',
        status: drawdown < 3.0 ? 'safe' : drawdown < 5.0 ? 'warning' : 'breached',
        category: 'drawdown'
      },
      {
        id: 'ter-cost-limit',
        title: 'Control de Comisiones (TER Ponderado)',
        description: 'Mantener comisiones anuales de gestión por debajo del 0.25%.',
        limitValue: 0.25,
        currentValue: portfolio.weightedTer,
        unit: '%/año',
        status: portfolio.weightedTer <= 0.25 ? 'safe' : 'warning',
        category: 'diversification'
      }
    ];
  }
}
