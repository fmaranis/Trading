import { PriceBar, Signal } from '../backtesting/types';

export interface StrategyContext {
  initialCapital: number;
  parameters: Record<string, any>;
}

export interface IStrategy {
  id: string;
  name: string;
  description: string;
  category: 'TREND' | 'MOMENTUM' | 'MEAN_REVERSION' | 'BENCHMARK';
  defaultParameters: Record<string, any>;

  /**
   * Generates signals given an array of historical price bars.
   * STRICT ANTI-LOOK-AHEAD: At index `i`, strategy can only access bars `0` to `i`.
   */
  generateSignals(bars: PriceBar[], parameters?: Record<string, any>): Signal[];
}
