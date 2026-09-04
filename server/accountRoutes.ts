import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { firebaseAdminServices, firebasePublicConfig } from './firebaseAdmin';
import { isBootstrapAdmin, requireActiveAccount, requireAdmin, verifyAccount, type VerifiedAccount } from './authSecurity';

export const accountRouter = express.Router();

const CLOUD_STATE_KEYS = new Set([
  'custodia_user_portfolio_v1',
  'custodia_portfolio_execution_history_v1',
  'custodia_portfolio_cash_flow_history_v1',
  'custodia_myinvestor_manual_availability_v1',
  'custodia_v1_pilot_decision_history_v1',
  'custodia_spanish_tax_settings_v1',
  'custodia_spanish_tax_lots_v1',
  'custodia_cash_benchmark_annual_pct_v1',
  'custodia_investment_decision_history_v1'
]);
const MAX_STATE_BYTES = 1_500_000;

function profileStatus(claims: Record<string, unknown> | undefined, disabled = false): 'ACTIVE' | 'PENDING' | 'DISABLED' {
  if (disabled) return 'DISABLED';
  return claims?.accessGranted === true || claims?.isAdmin === true ? 'ACTIVE' : 'PENDING';
}

async function writeProfile(account: { uid: string; email?: string | null; displayName?: string | null; disabled?: boolean; customClaims?: Record<string, unknown> }) {
  const { db } = firebaseAdminServices();
  const ref = db.doc(`users/${account.uid}`);
  const existing = await ref.get();
  const now = new Date().toISOString();
  await ref.set({
    uid: account.uid,
    email: account.email ?? null,
    displayName: account.displayName ?? null,
    status: profileStatus(account.customClaims, account.disabled === true),
    isAdminDisplay: account.customClaims?.isAdmin === true,
    updatedAt: now,
    ...(existing.exists ? {} : { createdAt: now })
  }, { merge: true });
}

async function currentUserRecord(account: VerifiedAccount) {
  const { auth } = firebaseAdminServices();
  const user = await auth.getUser(account.uid);
  await writeProfile({ uid: user.uid, email: user.email, displayName: user.displayName, disabled: user.disabled, customClaims: user.customClaims });
  return user;
}

function sanitizeCloudState(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_CLOUD_STATE');
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!CLOUD_STATE_KEYS.has(key)) continue;
    if (typeof value !== 'string') throw new Error(`INVALID_CLOUD_STATE_VALUE:${key}`);
    values[key] = value;
  }
  if (Buffer.byteLength(JSON.stringify(values), 'utf8') > MAX_STATE_BYTES) throw new Error('CLOUD_STATE_TOO_LARGE');
  return values;
}

async function enabledAdminCount(excludingUid?: string): Promise<number> {
  const { auth } = firebaseAdminServices();
  let count = 0;
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    count += page.users.filter(user => user.uid !== excludingUid && !user.disabled && user.customClaims?.isAdmin === true).length;
    pageToken = page.pageToken;
  } while (pageToken);
  return count;
}

accountRouter.get('/public-config', (_req: Request, res: Response) => {
  res.json(firebasePublicConfig());
});

accountRouter.post('/bootstrap', async (req: Request, res: Response): Promise<void> => {
  const account = await verifyAccount(req, res);
  if (!account) return;
  if (!isBootstrapAdmin(account)) {
    res.json({ ok: true, bootstrapped: false });
    return;
  }
  const { auth } = firebaseAdminServices();
  const user = await auth.getUser(account.uid);
  const claims = { ...(user.customClaims ?? {}), accessGranted: true, isAdmin: true };
  if (user.customClaims?.accessGranted !== true || user.customClaims?.isAdmin !== true) {
    await auth.setCustomUserClaims(account.uid, claims);
  }
  await writeProfile({ uid: user.uid, email: user.email, displayName: user.displayName, disabled: user.disabled, customClaims: claims });
  res.json({ ok: true, bootstrapped: true, tokenRefreshRequired: true });
});

accountRouter.get('/me', async (req: Request, res: Response): Promise<void> => {
  const account = await verifyAccount(req, res);
  if (!account) return;
  const user = await currentUserRecord(account);
  const { db } = firebaseAdminServices();
  const state = await db.doc(`users/${account.uid}/private/state`).get();
  res.json({
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    disabled: user.disabled,
    isAdmin: user.customClaims?.isAdmin === true,
    accessGranted: user.customClaims?.accessGranted === true || user.customClaims?.isAdmin === true,
    stateExists: state.exists
  });
});

accountRouter.get('/state', async (req: Request, res: Response): Promise<void> => {
  const account = await requireActiveAccount(req, res);
  if (!account) return;
  const { db } = firebaseAdminServices();
  const snapshot = await db.doc(`users/${account.uid}/private/state`).get();
  res.json({ exists: snapshot.exists, values: snapshot.exists ? (snapshot.data()?.values ?? {}) : {}, updatedAt: snapshot.data()?.updatedAt ?? null });
});

accountRouter.put('/state', async (req: Request, res: Response): Promise<void> => {
  const account = await requireActiveAccount(req, res);
  if (!account) return;
  try {
    const values = sanitizeCloudState(req.body?.values);
    const { db } = firebaseAdminServices();
    const updatedAt = new Date().toISOString();
    await db.doc(`users/${account.uid}/private/state`).set({ values, updatedAt, schemaVersion: 1 });
    res.json({ ok: true, updatedAt, keys: Object.keys(values).length });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || String(error) });
  }
});

accountRouter.get('/admin/users', async (req: Request, res: Response): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const { auth } = firebaseAdminServices();
  const users: any[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users.map(user => ({
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      disabled: user.disabled,
      accessGranted: user.customClaims?.accessGranted === true || user.customClaims?.isAdmin === true,
      isAdmin: user.customClaims?.isAdmin === true,
      createdAt: user.metadata.creationTime,
      lastSignInAt: user.metadata.lastSignInTime ?? null
    })));
    pageToken = page.pageToken;
  } while (pageToken);
  users.sort((a, b) => String(a.email ?? a.uid).localeCompare(String(b.email ?? b.uid)));
  res.json({ users, callerUid: admin.uid });
});

accountRouter.post('/admin/users', async (req: Request, res: Response): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const displayName = String(req.body?.displayName ?? '').trim() || undefined;
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: 'VALID_EMAIL_REQUIRED' });
    return;
  }
  try {
    const { auth } = firebaseAdminServices();
    const temporaryPassword = crypto.randomBytes(24).toString('base64url');
    const user = await auth.createUser({ email, displayName, password: temporaryPassword, disabled: false });
    const claims = { accessGranted: req.body?.accessGranted !== false, isAdmin: false };
    await auth.setCustomUserClaims(user.uid, claims);
    await writeProfile({ uid: user.uid, email: user.email, displayName: user.displayName, disabled: false, customClaims: claims });
    const passwordSetupLink = await auth.generatePasswordResetLink(email);
    res.status(201).json({ ok: true, uid: user.uid, email, passwordSetupLink, accessGranted: claims.accessGranted });
  } catch (error: any) {
    res.status(400).json({ error: error?.code || error?.message || String(error) });
  }
});

accountRouter.patch('/admin/users/:uid', async (req: Request, res: Response): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const uid = String(req.params.uid ?? '').trim();
  if (!uid) { res.status(400).json({ error: 'UID_REQUIRED' }); return; }
  try {
    const { auth } = firebaseAdminServices();
    const target = await auth.getUser(uid);
    const currentClaims = { ...(target.customClaims ?? {}) };
    const wantsAdmin = typeof req.body?.isAdmin === 'boolean' ? req.body.isAdmin : currentClaims.isAdmin === true;
    const wantsAccess = typeof req.body?.accessGranted === 'boolean' ? req.body.accessGranted : currentClaims.accessGranted === true || currentClaims.isAdmin === true;
    const wantsDisabled = typeof req.body?.disabled === 'boolean' ? req.body.disabled : target.disabled;

    if (uid === admin.uid && (wantsAdmin === false || wantsAccess === false || wantsDisabled === true)) {
      res.status(400).json({ error: 'ADMIN_CANNOT_REVOKE_OR_DISABLE_SELF' });
      return;
    }
    if (target.customClaims?.isAdmin === true && wantsAdmin === false && await enabledAdminCount(uid) < 1) {
      res.status(400).json({ error: 'CANNOT_REMOVE_LAST_ADMIN' });
      return;
    }

    const nextClaims = { ...currentClaims, accessGranted: wantsAdmin ? true : wantsAccess, isAdmin: wantsAdmin };
    await auth.setCustomUserClaims(uid, nextClaims);
    if (target.disabled !== wantsDisabled) await auth.updateUser(uid, { disabled: wantsDisabled });
    if (wantsDisabled || (!nextClaims.accessGranted && !nextClaims.isAdmin) || (target.customClaims?.isAdmin === true && nextClaims.isAdmin !== true)) {
      await auth.revokeRefreshTokens(uid);
    }
    const updated = await auth.getUser(uid);
    await writeProfile({ uid: updated.uid, email: updated.email, displayName: updated.displayName, disabled: updated.disabled, customClaims: nextClaims });
    res.json({ ok: true, uid, disabled: updated.disabled, accessGranted: nextClaims.accessGranted === true || nextClaims.isAdmin === true, isAdmin: nextClaims.isAdmin === true, tokenRefreshRequired: true });
  } catch (error: any) {
    res.status(400).json({ error: error?.code || error?.message || String(error) });
  }
});

accountRouter.post('/admin/users/:uid/password-reset-link', async (req: Request, res: Response): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const { auth } = firebaseAdminServices();
    const user = await auth.getUser(String(req.params.uid));
    if (!user.email) { res.status(400).json({ error: 'USER_HAS_NO_EMAIL' }); return; }
    const passwordResetLink = await auth.generatePasswordResetLink(user.email);
    res.json({ ok: true, email: user.email, passwordResetLink });
  } catch (error: any) {
    res.status(400).json({ error: error?.code || error?.message || String(error) });
  }
});

accountRouter.delete('/admin/users/:uid', async (req: Request, res: Response): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const uid = String(req.params.uid ?? '').trim();
  if (uid === admin.uid) { res.status(400).json({ error: 'ADMIN_CANNOT_DELETE_SELF' }); return; }
  try {
    const { auth, db } = firebaseAdminServices();
    const target = await auth.getUser(uid);
    if (target.customClaims?.isAdmin === true && await enabledAdminCount(uid) < 1) {
      res.status(400).json({ error: 'CANNOT_DELETE_LAST_ADMIN' });
      return;
    }
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await auth.deleteUser(uid);
    res.json({ ok: true, uid, deleted: true });
  } catch (error: any) {
    res.status(400).json({ error: error?.code || error?.message || String(error) });
  }
});
