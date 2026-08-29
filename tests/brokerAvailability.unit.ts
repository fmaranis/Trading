import { strict as assert } from 'node:assert';
import { EUR_ASSET_UNIVERSE } from '../src/investment/decision/assetUniverse';
import {
  getMyInvestorAvailability,
  getPublicMyInvestorAvailability,
  ManualMyInvestorAvailabilityService
} from '../src/investment/decision/brokerAvailability';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

const originalWindow = (globalThis as any).window;
(globalThis as any).window = { localStorage: new MemoryStorage() };

let passed = 0;
function test(name: string, fn: () => void) {
  fn(); passed += 1; console.log(`✓ ${name}`);
}

try {
  const xeon = EUR_ASSET_UNIVERSE.find(a => a.assetId === 'XEON')!;
  const usFund = EUR_ASSET_UNIVERSE.find(a => a.assetId === 'FUND_VANGUARD_US500')!;

  test('public evidence remains objective and unverified ETF still requires lookup', () => {
    assert.equal(getPublicMyInvestorAvailability(xeon).status, 'REQUIRES_INVERSIS_LOOKUP');
  });

  test('effective policy assumes an unverified instrument is available', () => {
    const result = getMyInvestorAvailability(xeon);
    assert.equal(result.status, 'ASSUMED_MYINVESTOR_AVAILABLE');
    assert.equal(result.evidence, 'USER_POLICY_DEFAULT');
  });

  test('manual available confirmation persists and becomes effective', () => {
    ManualMyInvestorAvailabilityService.set(xeon.ticker, 'AVAILABLE');
    const result = getMyInvestorAvailability(xeon);
    assert.equal(result.status, 'CONFIRMED_MYINVESTOR');
    assert.equal(result.evidence, 'USER_CONFIRMED_MYINVESTOR');
    assert.equal(ManualMyInvestorAvailabilityService.get(xeon.ticker)?.value, 'AVAILABLE');
  });

  test('manual unavailable confirmation persists and overrides permissive default', () => {
    ManualMyInvestorAvailabilityService.set(xeon.ticker, 'UNAVAILABLE');
    const result = getMyInvestorAvailability(xeon);
    assert.equal(result.status, 'USER_CONFIRMED_UNAVAILABLE');
    assert.equal(result.evidence, 'USER_CONFIRMED_MYINVESTOR');
  });

  test('removing manual unavailable restores assumed-available effective policy', () => {
    ManualMyInvestorAvailabilityService.remove(xeon.ticker);
    assert.equal(getMyInvestorAvailability(xeon).status, 'ASSUMED_MYINVESTOR_AVAILABLE');
  });

  test('manual unavailable can override official current evidence without mutating it', () => {
    assert.equal(getPublicMyInvestorAvailability(usFund).status, 'CONFIRMED_MYINVESTOR');
    ManualMyInvestorAvailabilityService.set(usFund.isin!, 'UNAVAILABLE');
    assert.equal(getMyInvestorAvailability(usFund).status, 'USER_CONFIRMED_UNAVAILABLE');
    assert.equal(getPublicMyInvestorAvailability(usFund).status, 'CONFIRMED_MYINVESTOR');
  });

  test('clear removes all manual confirmations', () => {
    ManualMyInvestorAvailabilityService.clear();
    assert.equal(ManualMyInvestorAvailabilityService.get(usFund.isin!), null);
  });

  console.log(`Broker availability: ${passed}/7 persistence/evidence-separation invariants passed.`);
} finally {
  if (originalWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = originalWindow;
}
