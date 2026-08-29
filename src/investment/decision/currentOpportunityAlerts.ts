import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { PortfolioCandidateGate } from './portfolioCandidateGate';
import { CashBenchmarkService } from './cashBenchmark';
import { StrategyConsensusEngine } from './strategyConsensusEngine';

export type CurrentOpportunityLevel = 'HIGH_CONVICTION' | 'GOOD_ENTRY' | 'VALID_ENTRY';

export interface CurrentOpportunityAlert {
  assetId: string;
  ticker: string;
  name: string;
  level: CurrentOpportunityLevel;
  asOfDate: string | null;
  rankingScore: number;
  scannerScore: number | null;
  momentum20Pct: number | null;
  momentum60Pct: number | null;
  momentum120Pct: number | null;
  annualizedVolatilityPct: number | null;
  currentDrawdownPct: number | null;
  consensusScore: number;
  favorableVotes: number;
  unfavorableVotes: number;
  annualizedProxyPct: number | null;
  excessVsCashPctPoints: number | null;
  reasons: string[];
}

function levelRank(level: CurrentOpportunityLevel): number {
  return level === 'HIGH_CONVICTION' ? 3 : level === 'GOOD_ENTRY' ? 2 : 1;
}

/**
 * Current-only opportunity surface. Every emitted alert has already passed the
 * canonical new-money gate: REAL data, cash hurdle, BUY consensus and no
 * structural downtrend. HIGH_CONVICTION deliberately requires agreement across
 * several independent signals; a large standalone ratio is never sufficient.
 */
export class CurrentOpportunityAlertEngine {
  static evaluate(scan: AssetUniverseScanResult, cashBenchmarkAnnualPct = CashBenchmarkService.load()): CurrentOpportunityAlert[] {
    const gate = PortfolioCandidateGate.apply(scan, cashBenchmarkAnnualPct, 1000);
    const alerts: CurrentOpportunityAlert[] = [];

    for (const entry of gate.entries) {
      if (entry.status !== 'ELIGIBLE') continue;
      const candidate = scan.candidates.find(c => c.asset.assetId === entry.assetId);
      const consensus = StrategyConsensusEngine.assess(scan, entry.assetId, cashBenchmarkAnnualPct);
      if (!candidate || candidate.status !== 'ACCEPTED' || !consensus || consensus.structuralDowntrend) continue;

      const excess = entry.excessVsCashPctPoints ?? -Infinity;
      const m20 = candidate.momentum20Pct;
      const m60 = candidate.momentum60Pct;
      const m120 = candidate.momentum120Pct;
      const vol = candidate.annualizedVolatilityPct;
      const dd = consensus.currentDrawdownPct;
      const longTrendHealthy = (consensus.longReturnPct ?? -Infinity) > 5 && (consensus.distanceToSma200Pct ?? -Infinity) > 0;
      const momentumAligned = (m120 ?? -Infinity) >= 8 && (m60 ?? -Infinity) >= 2 && (m20 ?? -Infinity) >= -2;
      const riskAcceptable = (vol ?? Infinity) <= 30 && (dd ?? -Infinity) >= -20;

      let level: CurrentOpportunityLevel = 'VALID_ENTRY';
      if (
        consensus.favorableVotes >= 4 &&
        consensus.consensusScore >= 3 &&
        excess >= 5 &&
        longTrendHealthy &&
        momentumAligned &&
        riskAcceptable
      ) level = 'HIGH_CONVICTION';
      else if (
        consensus.favorableVotes >= 3 &&
        consensus.consensusScore >= 2 &&
        excess >= 2 &&
        (m120 ?? -Infinity) > 4 &&
        (vol ?? Infinity) <= 35
      ) level = 'GOOD_ENTRY';

      const reasons = [
        `Consenso ${consensus.consensusScore >= 0 ? '+' : ''}${consensus.consensusScore}: ${consensus.favorableVotes}/5 señales favorables`,
        entry.annualizedProxyPct == null || entry.excessVsCashPctPoints == null
          ? `Supera el filtro de efectivo de ${cashBenchmarkAnnualPct.toFixed(2)}%`
          : `Proxy anual ${entry.annualizedProxyPct.toFixed(1)}% · +${entry.excessVsCashPctPoints.toFixed(1)} pp frente al efectivo`,
        `Momentum 20/60/120: ${m20?.toFixed(1) ?? 'N/D'}% / ${m60?.toFixed(1) ?? 'N/D'}% / ${m120?.toFixed(1) ?? 'N/D'}%`,
        `Volatilidad ${vol?.toFixed(1) ?? 'N/D'}% · drawdown actual ${dd?.toFixed(1) ?? 'N/D'}%`
      ];
      if (longTrendHealthy) reasons.push('Tendencia larga positiva y precio por encima de SMA200');

      alerts.push({
        assetId: entry.assetId,
        ticker: candidate.asset.ticker,
        name: candidate.asset.name,
        level,
        asOfDate: candidate.asOfDate,
        rankingScore: entry.rankingScore ?? candidate.score ?? -999,
        scannerScore: candidate.score,
        momentum20Pct: m20,
        momentum60Pct: m60,
        momentum120Pct: m120,
        annualizedVolatilityPct: vol,
        currentDrawdownPct: dd,
        consensusScore: consensus.consensusScore,
        favorableVotes: consensus.favorableVotes,
        unfavorableVotes: consensus.unfavorableVotes,
        annualizedProxyPct: entry.annualizedProxyPct,
        excessVsCashPctPoints: entry.excessVsCashPctPoints,
        reasons
      });
    }

    return alerts.sort((a, b) => levelRank(b.level) - levelRank(a.level) || b.rankingScore - a.rankingScore);
  }
}
