import { getIdToken, type User } from 'firebase/auth';

const ACCOUNT_API_BASE = '/api/alerts/account';

export interface AccountMe {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  isAdmin: boolean;
  accessGranted: boolean;
  stateExists: boolean;
}

export interface AdminUserRow {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  accessGranted: boolean;
  isAdmin: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

async function authHeaders(user: User): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await getIdToken(user)}` };
}

export async function accountFetch<T>(user: User, url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${await getIdToken(user)}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error ?? body?.detail ?? `HTTP_${response.status}`));
  return body as T;
}

export async function bootstrapAccount(user: User): Promise<{ bootstrapped: boolean; tokenRefreshRequired?: boolean }> {
  const headers = await authHeaders(user);
  const response = await fetch(`${ACCOUNT_API_BASE}/bootstrap`, { method: 'POST', headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error ?? `BOOTSTRAP_HTTP_${response.status}`));
  return body;
}

export function loadAccountMe(user: User): Promise<AccountMe> {
  return accountFetch<AccountMe>(user, `${ACCOUNT_API_BASE}/me`);
}

export function loadAdminUsers(user: User): Promise<{ users: AdminUserRow[]; callerUid: string }> {
  return accountFetch(user, `${ACCOUNT_API_BASE}/admin/users`);
}

export function createManagedUser(user: User, input: { email: string; displayName?: string; accessGranted?: boolean }): Promise<{ uid: string; email: string; passwordSetupLink: string; accessGranted: boolean }> {
  return accountFetch(user, `${ACCOUNT_API_BASE}/admin/users`, { method: 'POST', body: JSON.stringify(input) });
}

export function updateManagedUser(user: User, uid: string, patch: { accessGranted?: boolean; disabled?: boolean; isAdmin?: boolean }) {
  return accountFetch(user, `${ACCOUNT_API_BASE}/admin/users/${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteManagedUser(user: User, uid: string) {
  return accountFetch(user, `${ACCOUNT_API_BASE}/admin/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
}

export function createPasswordResetLink(user: User, uid: string): Promise<{ email: string; passwordResetLink: string }> {
  return accountFetch(user, `${ACCOUNT_API_BASE}/admin/users/${encodeURIComponent(uid)}/password-reset-link`, { method: 'POST' });
}
