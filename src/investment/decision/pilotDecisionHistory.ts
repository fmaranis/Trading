export type PilotDecisionAction = 'BUY' | 'REDUCE_EXIT' | 'MIXED' | 'HOLD_CASH';

export interface PilotDecisionBuy {
  assetId: string;
  ticker: string;
  amountEur: number;
  availability: string;
}

export interface PilotDecisionPositionAction {
  key: string;
  tickerOrIsin: string;
  action: 'WATCH' | 'REDUCE' | 'EXIT';
  currentValueEur: number | null;
  reason: string;
}

export interface PilotDecisionSnapshot {
  id: string;
  asOfDate: string;
  recordedAt: string;
  action: PilotDecisionAction;
  headline: string;
  recommendedInvestmentEur: number;
  residualCashEur: number;
  buys: PilotDecisionBuy[];
  positionActions: PilotDecisionPositionAction[];
  portfolioFingerprint: string;
}

const STORAGE_KEY = 'custodia_v1_pilot_decision_history_v1';
const MAX_ENTRIES = 180;

function normalize(value: any): PilotDecisionSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value.asOfDate ?? ''))) return null;
  const action: PilotDecisionAction = ['BUY','REDUCE_EXIT','MIXED','HOLD_CASH'].includes(value.action) ? value.action : 'HOLD_CASH';
  return {
    id: String(value.id ?? `pilot_${value.asOfDate}`),
    asOfDate: String(value.asOfDate),
    recordedAt: String(value.recordedAt ?? new Date().toISOString()),
    action,
    headline: String(value.headline ?? ''),
    recommendedInvestmentEur: Math.max(0, Number(value.recommendedInvestmentEur) || 0),
    residualCashEur: Math.max(0, Number(value.residualCashEur) || 0),
    buys: Array.isArray(value.buys) ? value.buys : [],
    positionActions: Array.isArray(value.positionActions) ? value.positionActions : [],
    portfolioFingerprint: String(value.portfolioFingerprint ?? '')
  };
}

export class PilotDecisionHistoryService {
  static load(): PilotDecisionSnapshot[] {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalize).filter(Boolean).sort((a, b) => b!.asOfDate.localeCompare(a!.asOfDate)) as PilotDecisionSnapshot[];
    } catch { return []; }
  }

  static saveDaily(input: Omit<PilotDecisionSnapshot, 'id' | 'recordedAt'>): PilotDecisionSnapshot[] {
    if (typeof window === 'undefined') return [];
    const snapshot: PilotDecisionSnapshot = {
      ...input,
      id: `pilot_${input.asOfDate}`,
      recordedAt: new Date().toISOString()
    };
    const current = this.load().filter(row => row.asOfDate !== snapshot.asOfDate);
    const next = [snapshot, ...current].sort((a, b) => b.asOfDate.localeCompare(a.asOfDate)).slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  static clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  }
}
