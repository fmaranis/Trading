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

export interface OpportunityAlertContext {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  previousDecision?: DecisionHistoryEntry | null;
  evidence?: CrossProviderEvidenceQuality | null;
}

function id(type: OpportunityAlertType, asOf: string, ticker?: string): string {
  return `${asOf}_${type}_${ticker ?? 'PORTFOLIO'}`;
}

export class OpportunityAlertEngine {
  static evaluate(context: OpportunityAlertContext): OpportunityAlert[] {
    const { scan, decision, previousDecision, evidence } = context;
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

    const selected = [...scan.selected].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
    const evidenceConfirmed = evidence?.state === 'CROSS_PROVIDER_CONFIRMED';
    for (const candidate of selected.slice(0, 3)) {
      const score = candidate.score ?? -Infinity;
      const momentum = candidate.momentum120Pct ?? 0;
      const vol = candidate.annualizedVolatilityPct ?? Infinity;
      if (score < 2 || momentum <= 0 || vol > 30) continue;
      alerts.push({
        id: id('OPPORTUNITY', asOf, candidate.asset.ticker), asOfDate: asOf, type: 'OPPORTUNITY',
        severity: 'REVIEW', ticker: candidate.asset.ticker,
        title: `${candidate.asset.ticker} · señal candidata a revisión`,
        message: `Top ${selected.indexOf(candidate) + 1} del scanner, score ${score.toFixed(2)}, momentum 120d ${momentum.toFixed(1)}%.`,
        reasons: [
          'Top 3 del ranking determinista',
          `Volatilidad anualizada ${vol.toFixed(1)}%`,
          evidenceConfirmed ? 'Precio confirmado por Yahoo + EODHD' : 'Validación cruzada no confirmada completamente',
          'La confirmación de proveedores valida el dato, no una ventaja de rentabilidad; la señal permanece REVIEW hasta validación walk-forward positiva'
        ],
        action: 'REVIEW'
      });
    }

    return alerts.sort((a, b) => {
      const rank = { MATERIAL: 2, REVIEW: 1, INFO: 0 };
      return rank[b.severity] - rank[a.severity];
    });
  }
}
