import { DecisionAlert, DecisionHistoryEntry, InvestmentDecisionResult } from './types';

const STORAGE_KEY = 'custodia_investment_decision_history_v1';
const MAX_ENTRIES = 50;

function toEntry(result: InvestmentDecisionResult): DecisionHistoryEntry {
  return {
    id: `decision_${result.generatedAt}_${result.portfolioDatasetFingerprint}`,
    savedAt: new Date().toISOString(),
    asOfDate: result.asOfDate,
    capitalEur: result.capitalEur,
    riskProfile: result.riskProfile,
    horizonYears: result.horizonYears,
    marketRegime: result.marketRegime,
    confidence: result.confidence,
    confidenceScore: result.confidenceScore,
    cashWeight: result.cashWeight,
    portfolioDatasetFingerprint: result.portfolioDatasetFingerprint,
    recommendedMethod: result.recommendedMethod,
    allocations: result.assets.map(a => ({ assetId: a.assetId, ticker: a.ticker, weight: a.weight, amountEur: a.amountEur }))
  };
}

export class DecisionHistoryService {
  static load(): DecisionHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static save(result: InvestmentDecisionResult): DecisionHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    const entry = toEntry(result);
    const current = this.load().filter(x => x.id !== entry.id);
    const next = [entry, ...current].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  static clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  }

  static detectAlerts(previous: DecisionHistoryEntry | null, current: InvestmentDecisionResult): DecisionAlert[] {
    if (!previous) return [];
    const alerts: DecisionAlert[] = [];
    const now = new Date().toISOString();
    const add = (type: DecisionAlert['type'], severity: DecisionAlert['severity'], message: string) => {
      alerts.push({ id: `${type}_${now}_${alerts.length}`, createdAt: now, type, severity, message });
    };

    if (previous.marketRegime !== current.marketRegime) {
      add('REGIME_CHANGE', 'MATERIAL', `El régimen cambió de ${previous.marketRegime} a ${current.marketRegime}.`);
    }
    if (previous.recommendedMethod !== current.recommendedMethod) {
      add('METHOD_CHANGE', 'MATERIAL', `El método recomendado cambió de ${previous.recommendedMethod} a ${current.recommendedMethod}.`);
    }
    const cashDiff = Math.abs(current.cashWeight - previous.cashWeight);
    if (cashDiff >= 0.10) add('CASH_SHIFT', 'WARNING', `La reserva de efectivo cambió ${(cashDiff * 100).toFixed(0)} puntos porcentuales.`);

    const previousWeights = Object.fromEntries(previous.allocations.map(a => [a.assetId, a.weight]));
    const shifts = current.assets
      .map(a => ({ ticker: a.ticker, diff: a.weight - (previousWeights[a.assetId] ?? 0) }))
      .filter(x => Math.abs(x.diff) >= 0.10)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    if (shifts.length) {
      const top = shifts[0];
      add('WEIGHT_SHIFT', 'MATERIAL', `${top.ticker} cambia ${top.diff >= 0 ? '+' : ''}${(top.diff * 100).toFixed(0)} puntos porcentuales.`);
    }
    if (previous.confidenceScore - current.confidenceScore >= 20 || (previous.confidence !== 'LOW' && current.confidence === 'LOW')) {
      add('CONFIDENCE_DROP', 'WARNING', `La confianza bajó de ${previous.confidenceScore}/100 a ${current.confidenceScore}/100.`);
    }
    return alerts;
  }
}
