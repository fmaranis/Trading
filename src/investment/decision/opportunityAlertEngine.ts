import type { AssetUniverseScanResult } from './assetUniverseScanner';
import type { DecisionHistoryEntry, InvestmentDecisionResult } from './types';
import type { CrossProviderEvidenceQuality } from './evidenceQuality';

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
  }>;
}

export interface OpportunityAlertContext {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  previousDecision?: DecisionHistoryEntry | null;
  previousSnapshot?: PreviousOpportunitySnapshot | null;
  evidence?: CrossProviderEvidenceQuality | null;
}

function id(type: OpportunityAlertType, asOf: string, ticker?: string): string {
  return `${asOf}_${type}_${ticker ?? 'PORTFOLIO'}`;
}

function isEligible(score: number | null | undefined, momentum: number | null | undefined, vol: number | null | undefined): boolean {
  return (score ?? -Infinity) >= 2 && (momentum ?? 0) > 0 && (vol ?? Infinity) <= 30;
}

export class OpportunityAlertEngine {
  static evaluate(context: OpportunityAlertContext): OpportunityAlert[] {
    const { scan, decision, previousDecision, evidence } = context;
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

    // A first snapshot establishes the baseline. It must not manufacture a "new opportunity".
    if (inferredPreviousSnapshot) {
      const selected = [...scan.selected].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
      const previousRanked = [...inferredPreviousSnapshot.shortlist].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
      const evidenceConfirmed = evidence?.state === 'CROSS_PROVIDER_CONFIRMED';

      for (const candidate of selected.slice(0, 3)) {
        const score = candidate.score ?? -Infinity;
        const momentum = candidate.momentum120Pct ?? 0;
        const vol = candidate.annualizedVolatilityPct ?? Infinity;
        if (!isEligible(score, momentum, vol)) continue;

        const previousIndex = previousRanked.findIndex(x => x.ticker === candidate.asset.ticker);
        const previous = previousIndex >= 0 ? previousRanked[previousIndex] : null;
        const previousRank = previousIndex >= 0 ? previousIndex + 1 : null;
        const currentRank = selected.indexOf(candidate) + 1;
        const enteredTop3 = previousRank == null || previousRank > 3;
        const scoreJump = previous?.score != null && score - previous.score >= 1.0;
        const eligibilityTransition = previous != null && !isEligible(previous.score, previous.momentum120Pct, previous.annualizedVolatilityPct);

        if (!enteredTop3 && !scoreJump && !eligibilityTransition) continue;

        const changeReasons: string[] = [];
        if (enteredTop3) changeReasons.push(previousRank == null ? 'Nuevo en el shortlist y entra en Top 3' : `Entrada en Top 3 desde rango ${previousRank}`);
        if (scoreJump) changeReasons.push(`Score mejora ≥1,0 (${previous!.score!.toFixed(2)} → ${score.toFixed(2)})`);
        if (eligibilityTransition) changeReasons.push('Pasa de no elegible a elegible por las reglas actuales');

        alerts.push({
          id: id('OPPORTUNITY', asOf, candidate.asset.ticker), asOfDate: asOf, type: 'OPPORTUNITY',
          severity: 'REVIEW', ticker: candidate.asset.ticker,
          title: `${candidate.asset.ticker} · cambio relevante en el scanner`,
          message: `Top ${currentRank}, score ${score.toFixed(2)}, momentum 120d ${momentum.toFixed(1)}%.`,
          reasons: [
            ...changeReasons,
            `Volatilidad anualizada ${vol.toFixed(1)}%`,
            evidenceConfirmed ? 'Precio confirmado por Yahoo + EODHD' : 'Validación cruzada no confirmada completamente',
            'La evidencia histórica actual no demuestra edge relativo; la señal permanece REVIEW_ONLY'
          ],
          action: 'REVIEW'
        });
      }
    }

    return alerts.sort((a, b) => {
      const rank = { MATERIAL: 2, REVIEW: 1, INFO: 0 };
      return rank[b.severity] - rank[a.severity];
    });
  }
}
