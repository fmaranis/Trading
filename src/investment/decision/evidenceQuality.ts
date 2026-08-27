export type CrossProviderEvidenceState =
  | 'PRIMARY_ONLY'
  | 'CROSS_PROVIDER_PARTIAL'
  | 'CROSS_PROVIDER_CONFIRMED'
  | 'CROSS_PROVIDER_DIVERGENCE'
  | 'CROSS_PROVIDER_UNAVAILABLE';

export interface CrossProviderEvidenceInput {
  primaryProvider: string;
  secondaryProvider: string;
  requested: number;
  checked: number;
  matched: number;
  divergent: number;
  summaryState: string;
  checkedAt: string;
}

export interface CrossProviderEvidenceQuality {
  state: CrossProviderEvidenceState;
  primaryProvider: string;
  secondaryProvider: string;
  requested: number;
  checked: number;
  matched: number;
  divergent: number;
  coveragePct: number;
  matchPct: number;
  checkedAt: string;
  isDecisionBlocking: false;
  meaning: 'EVIDENCE_QUALITY_NOT_PROFITABILITY_PROBABILITY';
  summary: string;
}

export function assessCrossProviderEvidence(input: CrossProviderEvidenceInput): CrossProviderEvidenceQuality {
  const requested = Math.max(0, input.requested);
  const checked = Math.max(0, Math.min(requested, input.checked));
  const matched = Math.max(0, Math.min(checked, input.matched));
  const divergent = Math.max(0, Math.min(checked, input.divergent));
  const coveragePct = requested > 0 ? checked / requested * 100 : 0;
  const matchPct = checked > 0 ? matched / checked * 100 : 0;

  let state: CrossProviderEvidenceState;
  if (divergent > 0) state = 'CROSS_PROVIDER_DIVERGENCE';
  else if (requested > 0 && checked === requested && matched === checked && input.summaryState === 'AVAILABLE') state = 'CROSS_PROVIDER_CONFIRMED';
  else if (checked > 0) state = 'CROSS_PROVIDER_PARTIAL';
  else if (input.summaryState === 'UNAVAILABLE' || input.summaryState === 'QUOTA_EXHAUSTED') state = 'CROSS_PROVIDER_UNAVAILABLE';
  else state = 'PRIMARY_ONLY';

  const summary = state === 'CROSS_PROVIDER_CONFIRMED'
    ? `${matched}/${requested} activos confirmados por ${input.primaryProvider} + ${input.secondaryProvider}; cobertura ${coveragePct.toFixed(0)}%, 0 divergencias.`
    : state === 'CROSS_PROVIDER_DIVERGENCE'
      ? `${divergent} divergencia(s) entre ${input.primaryProvider} y ${input.secondaryProvider}; revisar antes de interpretar la evidencia como confirmada.`
      : state === 'CROSS_PROVIDER_PARTIAL'
        ? `Validación parcial: ${checked}/${requested} activos comparables, ${matched} coincidentes.`
        : `La recomendación sigue usando ${input.primaryProvider}; la segunda fuente no aporta confirmación completa en esta ejecución.`;

  return {
    state,
    primaryProvider: input.primaryProvider,
    secondaryProvider: input.secondaryProvider,
    requested,
    checked,
    matched,
    divergent,
    coveragePct,
    matchPct,
    checkedAt: input.checkedAt,
    isDecisionBlocking: false,
    meaning: 'EVIDENCE_QUALITY_NOT_PROFITABILITY_PROBABILITY',
    summary
  };
}
