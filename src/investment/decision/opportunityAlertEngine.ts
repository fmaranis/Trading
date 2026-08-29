import type { AssetUniverseScanResult } from './assetUniverseScanner';
import type { DecisionHistoryEntry, InvestmentDecisionResult } from './types';
import type { CrossProviderEvidenceQuality } from './evidenceQuality';
import { DEFAULT_CASH_BENCHMARK_ANNUAL_PCT } from './cashBenchmark';
import { PortfolioCandidateGate } from './portfolioCandidateGate';

export type OpportunityAlertType = 'OPPORTUNITY' | 'REGIME_CHANGE' | 'REBALANCE' | 'RISK' | 'DATA_WARNING';
export type OpportunityAlertSeverity = 'INFO' | 'REVIEW' | 'MATERIAL';

export interface OpportunityAlert {
  id: string;
  asOfDate: string;
  type: OpportunityAlertType;
  severity: OpportunityAlertSeverity;
  ticker?: string;
  title: string;
  message: string;
  reasons: string[];
  action: 'REVIEW' | 'NO_ACTION';
}

export interface PreviousOpportunitySnapshot {
  asOfDate: string;
  shortlist: Array<{
    ticker: string;
    score: number | null;
    momentum120Pct: number | null;
    annualizedVolatilityPct: number | null;
    eligibleForNewMoney?: boolean;
    gateReason?: string;
    consensusScore?: number | null;
    excessVsCashPctPoints?: number | null;
    rankingScore?: number | null;
  }>;
}

export interface OpportunityAlertContext {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  previousDecision?: DecisionHistoryEntry | null;
  previousSnapshot?: PreviousOpportunitySnapshot | null;
  evidence?: CrossProviderEvidenceQuality | null;
  cashBenchmarkAnnualPct?: number;
}

function id(type: OpportunityAlertType, asOf: string, ticker?: string): string {
  return `${asOf}_${type}_${ticker ?? 'PORTFOLIO'}`;
}

export class OpportunityAlertEngine {
  static evaluate(context: OpportunityAlertContext): OpportunityAlert[] {
    const { scan, decision, previousDecision, evidence } = context;
    const cashBenchmarkAnnualPct = Number.isFinite(context.cashBenchmarkAnnualPct)
      ? Math.max(0, Number(context.cashBenchmarkAnnualPct))
      : DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
    const inferredPreviousSnapshot = context.previousSnapshot ?? (() => {
      const shortlist = (previousDecision as (DecisionHistoryEntry & { shortlist?: PreviousOpportunitySnapshot['shortlist'] }) | null | undefined)?.shortlist;
      return previousDecision && shortlist ? { asOfDate: previousDecision.asOfDate, shortlist } : null;
    })();
    const alerts: OpportunityAlert[] = [];
    const asOf = decision.asOfDate;

    if (evidence?.state === 'CROSS_PROVIDER_DIVERGENCE' || evidence?.state === 'CROSS_PROVIDER_UNAVAILABLE') {
      alerts.push({
        id: id('DATA_WARNING', asOf), asOfDate: asOf, type: 'DATA_WARNING', severity: 'MATERIAL',
        title: 'Revisar calidad de datos', message: evidence.summary,
        reasons: [evidence.state, `Cobertura ${evidence.coveragePct.toFixed(0)}%`, `Divergencias ${evidence.divergent}`], action: 'REVIEW'
      });
    }

    if (previousDecision && previousDecision.marketRegime !== decision.marketRegime) {
      alerts.push({
        id: id('REGIME_CHANGE', asOf), asOfDate: asOf, type: 'REGIME_CHANGE', severity: 'MATERIAL',
        title: 'Cambio de régimen', message: `${previousDecision.marketRegime} → ${decision.marketRegime}`,
        reasons: ['Cambio causal del régimen de mercado', 'Puede alterar efectivo y política de asignación'], action: 'REVIEW'
      });
    }

    if (decision.regimeVolatilityPct != null && decision.regimeVolatilityPct >= 25) {
      alerts.push({
        id: id('RISK', asOf), asOfDate: asOf, type: 'RISK', severity: 'MATERIAL',
        title: 'Volatilidad elevada', message: `Volatilidad de régimen ${decision.regimeVolatilityPct.toFixed(1)}%.`,
        reasons: ['Umbral de revisión: 25% anualizado'], action: 'REVIEW'
      });
    }

    if (previousDecision) {
      const oldWeights = Object.fromEntries(previousDecision.allocations.map(a => [a.assetId, a.weight]));
      const turnover = decision.assets.reduce((sum, a) => sum + Math.abs(a.weight - (oldWeights[a.assetId] ?? 0)), 0) / 2;
      if (turnover >= 0.15 || Math.abs(decision.cashWeight - previousDecision.cashWeight) >= 0.10) {
        alerts.push({
          id: id('REBALANCE', asOf), asOfDate: asOf, type: 'REBALANCE', severity: 'REVIEW',
          title: 'Revisar rebalanceo', message: `La cartera objetivo ha cambiado materialmente (${(turnover * 100).toFixed(0)}% de rotación teórica).`,
          reasons: ['Rotación objetivo ≥15% o cambio de efectivo ≥10 pp', 'Comprobar costes y títulos enteros antes de operar'], action: 'REVIEW'
        });
      }
    }

    // Historical opportunity alerts now use the exact new-money gate used by the
    // portfolio: cash hurdle + strategy consensus. Allocation diversification is
    // deliberately downstream and must not hide a strong eligible candidate.
    if (inferredPreviousSnapshot) {
      const gate = PortfolioCandidateGate.apply(scan, cashBenchmarkAnnualPct, 1000);
      const currentEligible = gate.entries
        .filter(entry => entry.status === 'ELIGIBLE')
        .sort((a, b) => (b.rankingScore ?? -Infinity) - (a.rankingScore ?? -Infinity));
      const previousHasGateEvidence = inferredPreviousSnapshot.shortlist.some(row => typeof row.eligibleForNewMoney === 'boolean');
      const previousEligible = inferredPreviousSnapshot.shortlist
        .filter(row => row.eligibleForNewMoney === true)
        .sort((a, b) => (b.rankingScore ?? b.score ?? -Infinity) - (a.rankingScore ?? a.score ?? -Infinity));
      const candidateById = new Map(scan.candidates.map(candidate => [candidate.asset.assetId, candidate]));
      const evidenceConfirmed = evidence?.state === 'CROSS_PROVIDER_CONFIRMED';

      // The first snapshot after migrating old history establishes a new gate-aware
      // baseline rather than manufacturing dozens of "new" opportunities.
      if (previousHasGateEvidence) {
        for (const entry of currentEligible.slice(0, 5)) {
          const candidate = candidateById.get(entry.assetId);
          if (!candidate) continue;
          const ticker = candidate.asset.ticker;
          const previous = inferredPreviousSnapshot.shortlist.find(row => row.ticker === ticker) ?? null;
          const previousRankIndex = previousEligible.findIndex(row => row.ticker === ticker);
          const previousRank = previousRankIndex >= 0 ? previousRankIndex + 1 : null;
          const currentRank = currentEligible.findIndex(row => row.assetId === entry.assetId) + 1;
          const becameEligible = previous != null && previous.eligibleForNewMoney === false;
          const newlyObserved = previous == null;
          const enteredTop5 = previousRank != null && previousRank > 5;
          const rankingJump = previous?.rankingScore != null && entry.rankingScore != null && entry.rankingScore - previous.rankingScore >= 5;

          if (!becameEligible && !newlyObserved && !enteredTop5 && !rankingJump) continue;

          const reasons: string[] = [];
          if (becameEligible) reasons.push(`Pasa a superar cash + consenso; antes: ${previous?.gateReason ?? 'no elegible'}`);
          if (newlyObserved) reasons.push('Nuevo instrumento válido dentro del radar productivo');
          if (enteredTop5) reasons.push(`Entra en Top 5 de oportunidades desde rango ${previousRank}`);
          if (rankingJump) reasons.push(`Mejora material de ranking (${previous!.rankingScore!.toFixed(1)} → ${entry.rankingScore!.toFixed(1)})`);

          alerts.push({
            id: id('OPPORTUNITY', asOf, ticker), asOfDate: asOf, type: 'OPPORTUNITY', severity: 'REVIEW', ticker,
            title: `${ticker} · oportunidad actual del motor`,
            message: `Top ${currentRank} entre candidatos que superan cash + consenso. Score ${candidate.score?.toFixed(2) ?? 'N/D'}, momentum 120d ${candidate.momentum120Pct?.toFixed(1) ?? 'N/D'}%.`,
            reasons: [
              ...reasons,
              `Consenso ${entry.consensusScore != null && entry.consensusScore >= 0 ? '+' : ''}${entry.consensusScore ?? 'N/D'}`,
              `Exceso proxy vs cash ${entry.excessVsCashPctPoints != null ? `${entry.excessVsCashPctPoints >= 0 ? '+' : ''}${entry.excessVsCashPctPoints.toFixed(1)} pp` : 'N/D'}`,
              evidenceConfirmed ? 'Precio confirmado por Yahoo + EODHD' : 'Validación cruzada no confirmada completamente',
              'Es una alerta de revisión; la asignación final todavía aplica diversificación, costes y cartera existente.'
            ],
            action: 'REVIEW'
          });
        }
      }
    }

    return alerts.sort((a, b) => {
      const rank = { MATERIAL: 2, REVIEW: 1, INFO: 0 };
      return rank[b.severity] - rank[a.severity];
    });
  }
}
