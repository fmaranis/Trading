export type FundPositionAction = 'HOLD' | 'REVIEW_TRANSFER' | 'REVIEW_REDEEM' | 'DATA_MISSING';

export interface FundPosition {
  id: string;
  isin: string;
  name: string;
  category: 'GLOBAL_EQUITY' | 'EMERGING_EQUITY' | 'OTHER';
  investedEur: number;
  acquisitionDate: string;
  currentValueEur?: number | null;
  units?: number | null;
  transferable: boolean;
  broker?: string;
}

export interface StagedCapitalPlan {
  availableEur: number;
  horizonMonths: number;
  preferredMode: 'MONTHLY';
}

export interface FundTaxReview {
  unrealizedGainEur: number | null;
  redemptionCreatesTaxEvent: boolean;
  transferDefersTax: boolean;
  preferredExitRoute: 'TRANSFER_IF_ELIGIBLE' | 'REDEMPTION' | 'NO_EXIT_RECOMMENDATION';
  note: string;
}

export interface FundNavValuation {
  currentValueEur: number | null;
  gainEur: number | null;
  gainPct: number | null;
  entryNav: number | null;
  latestNav: number | null;
  inferredUnits: number | null;
  unitsUsed: number | null;
  precision: 'EXACT_WITH_UNITS' | 'ESTIMATED_FROM_ENTRY_NAV' | 'UNAVAILABLE';
}

export const EXAMPLE_FUND_POSITIONS: FundPosition[] = [
  {
    id: 'example_vanguard_global', isin: 'IE00B03HD191', name: 'Vanguard Global Stock Index Fund EUR Acc',
    category: 'GLOBAL_EQUITY', investedEur: 12600, acquisitionDate: '2026-08-11', currentValueEur: null, units: null,
    transferable: true, broker: 'MyInvestor'
  },
  {
    id: 'example_vanguard_emerging', isin: 'IE0031786696', name: 'Vanguard Emerging Markets Stock Index Fund EUR Acc',
    category: 'EMERGING_EQUITY', investedEur: 1400, acquisitionDate: '2026-08-12', currentValueEur: null, units: null,
    transferable: true, broker: 'MyInvestor'
  }
];

export const EXAMPLE_STAGED_CAPITAL_PLAN: StagedCapitalPlan = { availableEur: 13000, horizonMonths: 12, preferredMode: 'MONTHLY' };

export function valueFundFromNav(
  position: FundPosition,
  points: Array<{ date: string; nav: number }>,
  latestNav?: number | null
): FundNavValuation {
  const valid = points
    .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.nav) && p.nav > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = latestNav != null && Number.isFinite(latestNav) && latestNav > 0 ? latestNav : valid.at(-1)?.nav ?? null;
  const entryPoint = valid.find(p => p.date >= position.acquisitionDate) ?? valid.filter(p => p.date <= position.acquisitionDate).at(-1) ?? null;
  const entryNav = entryPoint?.nav ?? null;
  const explicitUnits = position.units != null && Number.isFinite(position.units) && position.units > 0 ? position.units : null;
  const inferredUnits = !explicitUnits && entryNav && position.investedEur > 0 ? position.investedEur / entryNav : null;
  const unitsUsed = explicitUnits ?? inferredUnits;
  if (!latest || !unitsUsed) {
    return { currentValueEur: null, gainEur: null, gainPct: null, entryNav, latestNav: latest, inferredUnits, unitsUsed: null, precision: 'UNAVAILABLE' };
  }
  const currentValueEur = unitsUsed * latest;
  const gainEur = currentValueEur - position.investedEur;
  return {
    currentValueEur,
    gainEur,
    gainPct: position.investedEur > 0 ? gainEur / position.investedEur * 100 : null,
    entryNav,
    latestNav: latest,
    inferredUnits,
    unitsUsed,
    precision: explicitUnits ? 'EXACT_WITH_UNITS' : 'ESTIMATED_FROM_ENTRY_NAV'
  };
}

export function assessFundTaxReview(position: FundPosition): FundTaxReview {
  const current = position.currentValueEur;
  const gain = current != null && Number.isFinite(current) ? current - position.investedEur : null;
  return {
    unrealizedGainEur: gain,
    redemptionCreatesTaxEvent: gain != null && Math.abs(gain) > 1e-9,
    transferDefersTax: position.transferable,
    preferredExitRoute: position.transferable ? 'TRANSFER_IF_ELIGIBLE' : 'NO_EXIT_RECOMMENDATION',
    note: position.transferable
      ? 'Antes de reembolsar, comparar un traspaso elegible: difiere la tributación y conserva valor/fecha fiscal de adquisición. La fiscalidad no convierte por sí sola una mala inversión en MANTENER.'
      : 'No se ha confirmado diferimiento fiscal por traspaso para esta posición.'
  };
}

export function monthlyStagedAmount(plan: StagedCapitalPlan): number {
  return plan.horizonMonths > 0 ? plan.availableEur / plan.horizonMonths : 0;
}
