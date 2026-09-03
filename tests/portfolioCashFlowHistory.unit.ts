import assert from 'node:assert/strict';
import { PortfolioCashFlowHistoryService } from '../src/investment/decision/portfolioExecutionHistory';

class MemoryStorage {
  private rows = new Map<string, string>();
  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string): void { this.rows.set(key, value); }
  removeItem(key: string): void { this.rows.delete(key); }
}

const originalWindow = (globalThis as any).window;
(globalThis as any).window = { localStorage: new MemoryStorage() };

try {
  PortfolioCashFlowHistoryService.clear();
  const baseline = PortfolioCashFlowHistoryService.ensureBaseline(27_000, '2026-08-11');
  assert.ok(baseline);
  assert.equal(baseline.amountEur, 27_000);
  assert.equal(baseline.kind, 'BASELINE');

  const duplicate = PortfolioCashFlowHistoryService.ensureBaseline(99_999, '2026-08-12');
  assert.equal(duplicate?.amountEur, 27_000, 'La aportación inicial no debe duplicarse ni sobrescribirse');

  const contribution = PortfolioCashFlowHistoryService.record(2_000, '2026-10-15', 'Aportación adicional');
  const withdrawal = PortfolioCashFlowHistoryService.record(-500, '2026-11-03', 'Retirada');
  assert.equal(contribution?.kind, 'CONTRIBUTION');
  assert.equal(withdrawal?.kind, 'WITHDRAWAL');

  const rows = PortfolioCashFlowHistoryService.load();
  assert.deepEqual(rows.map(row => [row.date, row.amountEur, row.kind]), [
    ['2026-08-11', 27_000, 'BASELINE'],
    ['2026-10-15', 2_000, 'CONTRIBUTION'],
    ['2026-11-03', -500, 'WITHDRAWAL']
  ]);

  console.log('portfolioCashFlowHistory.unit: PASS');
} finally {
  if (originalWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = originalWindow;
}
