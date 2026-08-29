import type { PortfolioExecutionLine } from './portfolioExecutionPlan';
import { resolveSecurityIsin } from './securityIdentifiers';

export interface ExecutedPurchaseOverride {
  amountEur: number;
  shares?: number | null;
  feeEur?: number | null;
}

export function buildExecutedPurchaseLine(line: PortfolioExecutionLine, override: ExecutedPurchaseOverride): PortfolioExecutionLine {
  if (!['BUY_ETF', 'SUBSCRIBE_FUND'].includes(line.action)) throw new Error('Solo se puede registrar directamente una compra o suscripción.');
  const amountEur = Number(override.amountEur);
  if (!Number.isFinite(amountEur) || amountEur <= 0) throw new Error('Introduce un importe real ejecutado mayor que cero.');

  const targetIsin = resolveSecurityIsin(line.targetTicker, line.targetIsin) ?? line.targetIsin;
  const feeEur = Math.max(0, Number(override.feeEur ?? line.estimatedFeeEur ?? 0));

  if (line.action === 'SUBSCRIBE_FUND') {
    return {
      ...line,
      id: `${line.id}_actual_${Date.now()}`,
      status: 'PENDING',
      targetIsin,
      amountEur,
      shares: null,
      estimatedFeeEur: 0,
      instruction: `Registrar suscripción realmente ejecutada por ${amountEur.toFixed(2)} € en ${line.targetName ?? line.targetIsin ?? line.targetTicker ?? 'fondo'}.`,
      rationale: `${line.rationale} El importe ha sido sustituido por el valor real confirmado por el usuario.`
    };
  }

  const shares = Math.floor(Number(override.shares ?? line.shares ?? 0));
  if (!Number.isFinite(shares) || shares <= 0) throw new Error('Introduce el número real de títulos ejecutados.');
  return {
    ...line,
    id: `${line.id}_actual_${Date.now()}`,
    status: 'PENDING',
    targetIsin,
    amountEur,
    shares,
    estimatedFeeEur: feeEur,
    instruction: `Registrar compra realmente ejecutada: ${shares} título${shares === 1 ? '' : 's'} de ${line.targetTicker ?? line.targetName ?? 'activo'} por ${amountEur.toFixed(2)} €${feeEur > 0 ? ` + ${feeEur.toFixed(2)} € de comisión` : ''}.`,
    rationale: `${line.rationale} Importe, títulos y comisión sustituidos por los valores reales confirmados por el usuario.`
  };
}
