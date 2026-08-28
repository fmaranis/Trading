import type { CostAwareExecutionPolicyConfig } from './costAwareExecutionPolicy';

export type ExecutionCapitalBand = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'INSTITUTIONAL';

export interface AdaptiveExecutionPolicy extends CostAwareExecutionPolicyConfig {
  capitalBand: ExecutionCapitalBand;
  capitalEur: number;
  rationale: string[];
}

/**
 * Execution thresholds intentionally become stricter for very small accounts,
 * where a fixed EUR 1 minimum commission dominates economics, and gradually
 * relax as capital grows. This changes execution only; it never changes the
 * research signal or target weights.
 */
export function executionPolicyForCapital(capitalEur: number): AdaptiveExecutionPolicy {
  const capital = Math.max(0, capitalEur);

  if (capital < 300) {
    return {
      capitalBand: 'MICRO', capitalEur: capital,
      minimumDriftPctPoints: 12,
      maximumOrderFeeDragPct: 1.25,
      maximumRebalanceFeeDragPct: 0.50,
      minimumOrderNotionalEur: 100,
      rationale: [
        'Capital micro: priorizar acumulación de efectivo sobre rotación.',
        'Una comisión mínima de 1 EUR exige órdenes de al menos 100 EUR para mantener drag cercano o inferior al 1%.'
      ]
    };
  }
  if (capital < 1000) {
    return {
      capitalBand: 'SMALL', capitalEur: capital,
      minimumDriftPctPoints: 8,
      maximumOrderFeeDragPct: 1.50,
      maximumRebalanceFeeDragPct: 0.75,
      minimumOrderNotionalEur: 80,
      rationale: [
        'Capital pequeño: evitar rebalanceos marginales y agrupar órdenes.',
        'Se exige una desviación material antes de pagar una comisión mínima.'
      ]
    };
  }
  if (capital < 5000) {
    return {
      capitalBand: 'MEDIUM', capitalEur: capital,
      minimumDriftPctPoints: 6,
      maximumOrderFeeDragPct: 1.50,
      maximumRebalanceFeeDragPct: 0.75,
      minimumOrderNotionalEur: 75,
      rationale: ['Capital medio: equilibrio entre fidelidad al objetivo y control de costes.']
    };
  }
  if (capital < 25000) {
    return {
      capitalBand: 'LARGE', capitalEur: capital,
      minimumDriftPctPoints: 4,
      maximumOrderFeeDragPct: 1.25,
      maximumRebalanceFeeDragPct: 0.60,
      minimumOrderNotionalEur: 100,
      rationale: ['Capital alto: permite mayor fidelidad sin aceptar microórdenes ineficientes.']
    };
  }
  return {
    capitalBand: 'INSTITUTIONAL', capitalEur: capital,
    minimumDriftPctPoints: 3,
    maximumOrderFeeDragPct: 1.00,
    maximumRebalanceFeeDragPct: 0.50,
    minimumOrderNotionalEur: 150,
    rationale: ['Capital muy alto: mayor fidelidad al objetivo, manteniendo límites estrictos de coste agregado.']
  };
}
