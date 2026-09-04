import type { Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { firebaseAdminServices } from './firebaseAdmin';

export interface VerifiedAccount {
  token: DecodedIdToken;
  uid: string;
  email: string | null;
  isAdmin: boolean;
  accessGranted: boolean;
}

function bearerToken(req: Request): string | null {
  const value = String(req.header('authorization') ?? '').trim();
  if (!value.toLowerCase().startsWith('bearer ')) return null;
  const token = value.slice(7).trim();
  return token || null;
}

export async function verifyAccount(req: Request, res: Response): Promise<VerifiedAccount | null> {
  const raw = bearerToken(req);
  if (!raw) {
    res.status(401).json({ error: 'AUTH_REQUIRED' });
    return null;
  }
  try {
    const { auth } = firebaseAdminServices();
    const token = await auth.verifyIdToken(raw, true);
    return {
      token,
      uid: token.uid,
      email: typeof token.email === 'string' ? token.email : null,
      isAdmin: token.isAdmin === true,
      accessGranted: token.accessGranted === true || token.isAdmin === true
    };
  } catch (error: any) {
    res.status(401).json({ error: 'INVALID_OR_REVOKED_AUTH_TOKEN', detail: error?.code || error?.message || String(error) });
    return null;
  }
}

export async function requireActiveAccount(req: Request, res: Response): Promise<VerifiedAccount | null> {
  const account = await verifyAccount(req, res);
  if (!account) return null;
  if (!account.accessGranted) {
    res.status(403).json({ error: 'ACCOUNT_ACCESS_PENDING_OR_REVOKED' });
    return null;
  }
  return account;
}

export async function requireAdmin(req: Request, res: Response): Promise<VerifiedAccount | null> {
  const account = await requireActiveAccount(req, res);
  if (!account) return null;
  if (!account.isAdmin) {
    res.status(403).json({ error: 'ADMIN_REQUIRED' });
    return null;
  }
  return account;
}

function csvSet(value: string | undefined): Set<string> {
  return new Set(String(value ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
}

export function isBootstrapAdmin(account: VerifiedAccount): boolean {
  const emails = csvSet(process.env.FIREBASE_BOOTSTRAP_ADMIN_EMAILS);
  const uids = csvSet(process.env.FIREBASE_BOOTSTRAP_ADMIN_UIDS);
  if (uids.has(account.uid.toLowerCase())) return true;
  const verifiedEmail = account.token.email_verified === true && account.email ? account.email.toLowerCase() : null;
  return Boolean(verifiedEmail && emails.has(verifiedEmail));
}
