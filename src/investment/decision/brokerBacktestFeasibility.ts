import { BrokerExecutionProfile, MYINVESTOR_BROKER_PROFILE } from './brokerExecution';

export interface BrokerBacktestCostInput {
  initialCapitalEur: number;
  totalTrades: number;
  modeledCommissionEur: number;
  modeledSlippageEur?: number;
}

export interface BrokerBacktestCostFeasibility {
  broker: string;
  initialCapitalEur: number;
  totalTrades: number;
  modeledCommissionEur: number;
  modeledSlippageEur: number;
  minimumCommissionLowerBoundEur: number;
  minimumTradingCostLowerBoundEur: number;
  minimumCommissionDragPct: number;
  modeledCommissionUnderstatementEur: number;
  modeledCommissionUnderstatementFactor: number | null;
  brokerCommissionModelCompatible: boolean;
  minimumCapitalForCommissionDragTargetEur: number;
  commissionDragTargetPct: number;
  warnings: string[];
}

/**
 * Diagnoses whether a percentage-only backtest commission result can be interpreted
 * as executable under a broker that charges a fixed minimum per order.
 *
 * This deliberately computes a LOWER BOUND rather than pretending to replay exact
 * broker fills: every executed trade/order must pay at least the broker minimum.
 */
export function assessBrokerBacktestCostFeasibility(
  input: BrokerBacktestCostInput,
  profile: BrokerExecutionProfile = MYINVESTOR_BROKER_PROFILE,
  commissionDragTargetPct = 2
): BrokerBacktestCostFeasibility {
  if (!(input.initialCapitalEur > 0) || !Number.isFinite(input.initialCapitalEur)) throw new Error('initialCapitalEur debe ser finito y > 0.');
  if (!Number.isInteger(input.totalTrades) || input.totalTrades < 0) throw new Error('totalTrades debe ser un entero >= 0.');
  if (!(input.modeledCommissionEur >= 0) || !Number.isFinite(input.modeledCommissionEur)) throw new Error('modeledCommissionEur debe ser finita y >= 0.');
  if (!(commissionDragTargetPct > 0) || !Number.isFinite(commissionDragTargetPct)) throw new Error('commissionDragTargetPct debe ser > 0.');

  const modeledSlippageEur = Number(input.modeledSlippageEur ?? 0);
  if (!(modeledSlippageEur >= 0) || !Number.isFinite(modeledSlippageEur)) throw new Error('modeledSlippageEur debe ser finita y >= 0.');

  const minimumCommissionLowerBoundEur = input.totalTrades * profile.etfMinCommissionEur;
  const minimumTradingCostLowerBoundEur = minimumCommissionLowerBoundEur + modeledSlippageEur;
  const minimumCommissionDragPct = minimumCommissionLowerBoundEur / input.initialCapitalEur * 100;
  const modeledCommissionUnderstatementEur = Math.max(0, minimumCommissionLowerBoundEur - input.modeledCommissionEur);
  const modeledCommissionUnderstatementFactor = input.modeledCommissionEur > 0
    ? minimumCommissionLowerBoundEur / input.modeledCommissionEur
    : minimumCommissionLowerBoundEur > 0 ? null : 1;
  const brokerCommissionModelCompatible = input.modeledCommissionEur + 1e-9 >= minimumCommissionLowerBoundEur;
  const minimumCapitalForCommissionDragTargetEur = minimumCommissionLowerBoundEur > 0
    ? minimumCommissionLowerBoundEur / (commissionDragTargetPct / 100)
    : 0;

  const warnings: string[] = [];
  if (!brokerCommissionModelCompatible) {
    warnings.push('PERCENTAGE_ONLY_COMMISSION_MODEL_UNDERESTIMATES_BROKER_MINIMUM_FEES');
  }
  if (minimumCommissionLowerBoundEur > input.initialCapitalEur + 1e-9) {
    warnings.push('BROKER_MINIMUM_COMMISSIONS_EXCEED_INITIAL_CAPITAL');
  }
  if (minimumCommissionDragPct > commissionDragTargetPct + 1e-9) {
    warnings.push(`MINIMUM_COMMISSION_DRAG_ABOVE_TARGET:${minimumCommissionDragPct.toFixed(2)}%>${commissionDragTargetPct.toFixed(2)}%`);
  }

  return {
    broker: profile.name,
    initialCapitalEur: input.initialCapitalEur,
    totalTrades: input.totalTrades,
    modeledCommissionEur: input.modeledCommissionEur,
    modeledSlippageEur,
    minimumCommissionLowerBoundEur,
    minimumTradingCostLowerBoundEur,
    minimumCommissionDragPct,
    modeledCommissionUnderstatementEur,
    modeledCommissionUnderstatementFactor,
    brokerCommissionModelCompatible,
    minimumCapitalForCommissionDragTargetEur,
    commissionDragTargetPct,
    warnings
  };
}
