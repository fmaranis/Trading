import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { assessAgainstCashBenchmark, CashBenchmarkService } from './cashBenchmark';

export type SignalDirection = 'FAVORABLE' | 'NEUTRAL' | 'UNFAVORABLE';
export type NewMoneyAction = 'BUY' | 'WATCH' | 'AVOID';
export type ExistingPositionAction = 'HOLD' | 'ADD' | 'REDUCE_REVIEW';

export interface StrategySignalVote {
  id: 'LONG_TREND' | 'MOMENTUM_120' | 'MEAN_REVERSION' | 'RISK' | 'CASH_HURDLE';
  label: string;
  direction: SignalDirection;
  score: -1 | 0 | 1;
  detail: string;
}

export interface StrategyConsensusAssessment {
  assetId: string;
  ticker: string;
  name: string;
  asOfDate: string | null;
  longReturnPct: number | null;
  momentum120Pct: number | null;
  momentum60Pct: number | null;
  momentum20Pct: number | null;
  rsi14: number | null;
  distanceToSma200Pct: number | null;
  currentDrawdownPct: number | null;
  annualizedVolatilityPct: number | null;
  favorableVotes: number;
  unfavorableVotes: number;
  neutralVotes: number;
  consensusScore: number;
  votes: StrategySignalVote[];
  newMoneyAction: NewMoneyAction;
  existingPositionAction: ExistingPositionAction;
  structuralDowntrend: boolean;
  buyTheDipCandidate: boolean;
  explanation: string;
}

function pct(a: number, b: number): number | null { return a > 0 ? (b / a - 1) * 100 : null; }
function mean(values: number[]): number | null { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function rsi14(prices: number[]): number | null {
  if (prices.length < 15) return null;
  const last15 = prices.slice(-15);
  const changes = last15.slice(1).map((p, i) => p - last15[i]);
  const gains = changes.map(x => Math.max(0, x));
  const losses = changes.map(x => Math.max(0, -x));
  const avgGain = mean(gains) ?? 0;
  const avgLoss = mean(losses) ?? 0;
  if (avgLoss <= 1e-12) return avgGain > 0 ? 100 : 50;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
function currentDrawdown(prices: number[], lookback = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback));
  if (!slice.length) return null;
  const peak = Math.max(...slice);
  const last = slice.at(-1)!;
  return peak > 0 ? (last / peak - 1) * 100 : null;
}
function direction(score: number): SignalDirection { return score > 0 ? 'FAVORABLE' : score < 0 ? 'UNFAVORABLE' : 'NEUTRAL'; }
function vote(id: StrategySignalVote['id'], label: string, score: -1 | 0 | 1, detail: string): StrategySignalVote { return { id, label, score, direction: direction(score), detail }; }

export class StrategyConsensusEngine {
  static assess(scan: AssetUniverseScanResult, assetId: string, cashBenchmarkAnnualPct = CashBenchmarkService.load()): StrategyConsensusAssessment | null {
    const candidate = scan.candidates.find(c => c.asset.assetId === assetId);
    const series = scan.acceptedDataset.assets.find(a => a.assetId === assetId);
    if (!candidate || !series || candidate.status !== 'ACCEPTED') return null;
    const prices = series.bars.map(b => b.close).filter(p => Number.isFinite(p) && p > 0);
    if (prices.length < 60) return null;
    const last = prices.at(-1)!;
    const sma200Slice = prices.slice(-Math.min(200, prices.length));
    const sma200 = mean(sma200Slice);
    const distanceToSma200Pct = sma200 && sma200 > 0 ? (last / sma200 - 1) * 100 : null;
    const longReturnPct = prices.length > 252 ? pct(prices[prices.length - 253], last) : prices.length > 180 ? pct(prices[prices.length - 181], last) : null;
    const dd = currentDrawdown(prices, 252);
    const rsi = rsi14(prices);
    const m120 = candidate.momentum120Pct;
    const m60 = candidate.momentum60Pct;
    const m20 = candidate.momentum20Pct;
    const vol = candidate.annualizedVolatilityPct;

    const longTrendScore: -1 | 0 | 1 =
      (longReturnPct ?? 0) > 5 && (distanceToSma200Pct ?? 0) > 0 ? 1 :
      (longReturnPct ?? 0) < -10 && (distanceToSma200Pct ?? 0) < -5 ? -1 : 0;

    const momentumScore: -1 | 0 | 1 =
      (m120 ?? 0) > 4 ? 1 :
      (m120 ?? 0) < -6 ? -1 : 0;

    const structuralDowntrend = longTrendScore === -1 && (m120 ?? 0) < 0;
    const dipDepth = -(dd ?? 0);
    const buyTheDipCandidate = !structuralDowntrend && longTrendScore >= 0 && dipDepth >= 5 && dipDepth <= 25 && (rsi ?? 50) <= 42;
    const meanReversionScore: -1 | 0 | 1 = buyTheDipCandidate ? 1 : structuralDowntrend && dipDepth > 15 ? -1 : 0;

    const riskScore: -1 | 0 | 1 =
      (vol ?? 0) > 35 || dipDepth > 35 ? -1 :
      (vol ?? 99) < 18 && dipDepth < 20 ? 1 : 0;

    const cash = assessAgainstCashBenchmark({ momentum120Pct: m120, benchmarkAnnualPct: cashBenchmarkAnnualPct, notionalEur: 0, estimatedFeeEur: 0 });
    const cashScore: -1 | 0 | 1 = cash.passes === true ? 1 : cash.passes === false ? -1 : 0;

    const votes = [
      vote('LONG_TREND', 'Tendencia larga', longTrendScore, `12m ${longReturnPct == null ? 'N/D' : `${longReturnPct.toFixed(1)}%`} · distancia SMA200 ${distanceToSma200Pct == null ? 'N/D' : `${distanceToSma200Pct.toFixed(1)}%`}.`),
      vote('MOMENTUM_120', 'Momentum 120 sesiones', momentumScore, `${m120 == null ? 'N/D' : `${m120.toFixed(1)}%`} · 60d ${m60 == null ? 'N/D' : `${m60.toFixed(1)}%`} · 20d ${m20 == null ? 'N/D' : `${m20.toFixed(1)}%`}.`),
      vote('MEAN_REVERSION', 'Mean reversion / buy-the-dip', meanReversionScore, `RSI14 ${rsi == null ? 'N/D' : rsi.toFixed(1)} · drawdown actual ${dd == null ? 'N/D' : `${dd.toFixed(1)}%`}${buyTheDipCandidate ? ' · caída dentro de tendencia no estructural.' : ''}`),
      vote('RISK', 'Riesgo', riskScore, `Volatilidad anualizada ${vol == null ? 'N/D' : `${vol.toFixed(1)}%`} · drawdown ${dd == null ? 'N/D' : `${dd.toFixed(1)}%`}.`),
      vote('CASH_HURDLE', 'Frente a efectivo', cashScore, cash.netAnnualizedProxyPct == null ? `No hay proxy suficiente frente a ${cashBenchmarkAnnualPct.toFixed(2)}%.` : `Proxy anual ${cash.netAnnualizedProxyPct.toFixed(2)}% vs efectivo ${cashBenchmarkAnnualPct.toFixed(2)}%.`)
    ];
    const favorableVotes = votes.filter(v => v.score > 0).length;
    const unfavorableVotes = votes.filter(v => v.score < 0).length;
    const neutralVotes = votes.length - favorableVotes - unfavorableVotes;
    const consensusScore = votes.reduce((s, v) => s + v.score, 0);

    let newMoneyAction: NewMoneyAction = 'WATCH';
    if (!structuralDowntrend && consensusScore >= 2 && cashScore >= 0) newMoneyAction = 'BUY';
    else if (structuralDowntrend || consensusScore <= -2 || cashScore < 0) newMoneyAction = 'AVOID';

    let existingPositionAction: ExistingPositionAction = 'HOLD';
    if (structuralDowntrend && unfavorableVotes >= 3) existingPositionAction = 'REDUCE_REVIEW';
    else if (newMoneyAction === 'BUY' && favorableVotes >= 3) existingPositionAction = 'ADD';

    const explanation = existingPositionAction === 'REDUCE_REVIEW'
      ? 'Deterioro estructural confirmado por varias señales; revisar reducción, no vender por una única ventana débil.'
      : buyTheDipCandidate
        ? 'La caída reciente ocurre sin tendencia larga estructuralmente rota: posible compra escalonada, condicionada al resto de gates.'
        : structuralDowntrend
          ? 'La caída parece estructural, no una simple oportunidad de reversión; evitar nuevas compras hasta mejora de tendencia.'
          : 'No hay evidencia suficiente para vender una posición existente; mantener salvo que otros gates de cartera indiquen un riesgo material.';

    return {
      assetId,
      ticker: candidate.asset.ticker,
      name: candidate.asset.name,
      asOfDate: candidate.asOfDate,
      longReturnPct,
      momentum120Pct: m120,
      momentum60Pct: m60,
      momentum20Pct: m20,
      rsi14: rsi,
      distanceToSma200Pct,
      currentDrawdownPct: dd,
      annualizedVolatilityPct: vol,
      favorableVotes,
      unfavorableVotes,
      neutralVotes,
      consensusScore,
      votes,
      newMoneyAction,
      existingPositionAction,
      structuralDowntrend,
      buyTheDipCandidate,
      explanation
    };
  }

  static assessSelected(scan: AssetUniverseScanResult, cashBenchmarkAnnualPct = CashBenchmarkService.load()): StrategyConsensusAssessment[] {
    return scan.selected.map(c => this.assess(scan, c.asset.assetId, cashBenchmarkAnnualPct)).filter(Boolean) as StrategyConsensusAssessment[];
  }
}
