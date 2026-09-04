import type { User } from 'firebase/auth';
import { accountFetch } from './accountApi';

const ACCOUNT_API_BASE = '/api/alerts/account';
const OWNER_KEY = 'custodia_cloud_owner_uid_v1';
export const PRIVATE_LOCAL_STORAGE_KEYS = [
  'custodia_user_portfolio_v1',
  'custodia_fund_positions_v1',
  'custodia_staged_capital_plan_v1',
  'custodia_pending_execution_plan_v1',
  'custodia_portfolio_execution_history_v1',
  'custodia_portfolio_cash_flow_history_v1',
  'custodia_myinvestor_manual_availability_v1',
  'custodia_v1_pilot_decision_history_v1',
  'custodia_spanish_tax_settings_v1',
  'custodia_spanish_tax_lots_v1',
  'custodia_cash_benchmark_annual_pct_v1',
  'custodia_investment_decision_history_v1'
] as const;

export interface CloudStatePayload {
  exists: boolean;
  values: Record<string, string>;
  updatedAt: string | null;
}

function currentSnapshot(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const values: Record<string, string> = {};
  for (const key of PRIVATE_LOCAL_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value != null) values[key] = value;
  }
  return values;
}

function stableSnapshot(values: Record<string, string>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b))));
}

export function clearPrivateLocalState(): void {
  if (typeof window === 'undefined') return;
  for (const key of PRIVATE_LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
  window.localStorage.removeItem(OWNER_KEY);
}

function applyCloudValues(uid: string, values: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  for (const key of PRIVATE_LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
  for (const [key, value] of Object.entries(values)) {
    if ((PRIVATE_LOCAL_STORAGE_KEYS as readonly string[]).includes(key) && typeof value === 'string') {
      window.localStorage.setItem(key, value);
    }
  }
  window.localStorage.setItem(OWNER_KEY, uid);
  window.dispatchEvent(new Event('custodia:cloud-state-hydrated'));
  window.dispatchEvent(new Event('custodia:user-portfolio-updated'));
  window.dispatchEvent(new Event('custodia:spanish-tax-settings-updated'));
  window.dispatchEvent(new Event('custodia:cash-benchmark-updated'));
}

export class UserCloudStateService {
  static async hydrate(user: User): Promise<{ migratedLegacy: boolean; cloudStateExists: boolean }> {
    const cloud = await accountFetch<CloudStatePayload>(user, `${ACCOUNT_API_BASE}/state`);
    const localOwner = typeof window === 'undefined' ? null : window.localStorage.getItem(OWNER_KEY);

    if (cloud.exists) {
      applyCloudValues(user.uid, cloud.values ?? {});
      return { migratedLegacy: false, cloudStateExists: true };
    }

    if (localOwner && localOwner !== user.uid) {
      clearPrivateLocalState();
      if (typeof window !== 'undefined') window.localStorage.setItem(OWNER_KEY, user.uid);
      await this.push(user, {});
      return { migratedLegacy: false, cloudStateExists: false };
    }

    const legacy = currentSnapshot();
    if (typeof window !== 'undefined') window.localStorage.setItem(OWNER_KEY, user.uid);
    await this.push(user, legacy);
    return { migratedLegacy: Object.keys(legacy).length > 0 && !localOwner, cloudStateExists: false };
  }

  static async push(user: User, values = currentSnapshot()): Promise<void> {
    await accountFetch(user, `${ACCOUNT_API_BASE}/state`, { method: 'PUT', body: JSON.stringify({ values }) });
  }

  static startAutoSync(user: User): () => void {
    let stopped = false;
    let writing = false;
    let last = stableSnapshot(currentSnapshot());

    const sync = async () => {
      if (stopped || writing) return;
      const snapshot = currentSnapshot();
      const serialized = stableSnapshot(snapshot);
      if (serialized === last) return;
      writing = true;
      try {
        await this.push(user, snapshot);
        last = serialized;
      } catch (error) {
        console.warn('[Custodia] private cloud-state sync failed:', error);
      } finally {
        writing = false;
      }
    };

    const interval = window.setInterval(() => void sync(), 15_000);
    const onPortfolio = () => void sync();
    const onVisibility = () => { if (document.visibilityState === 'hidden') void sync(); };
    window.addEventListener('custodia:user-portfolio-updated', onPortfolio);
    window.addEventListener('custodia:spanish-tax-settings-updated', onPortfolio);
    window.addEventListener('custodia:cash-benchmark-updated', onPortfolio);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener('custodia:user-portfolio-updated', onPortfolio);
      window.removeEventListener('custodia:spanish-tax-settings-updated', onPortfolio);
      window.removeEventListener('custodia:cash-benchmark-updated', onPortfolio);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }
}
