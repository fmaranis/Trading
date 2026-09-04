import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, ShieldCheck, Trash2, UserPlus, UserX, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  createManagedUser,
  createPasswordResetLink,
  deleteManagedUser,
  loadAdminUsers,
  updateManagedUser,
  type AdminUserRow
} from '../auth/accountApi';

interface Props { user: User; onClose: () => void; }

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export const AdminUsersPanel: React.FC<Props> = ({ user, onClose }) => {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [callerUid, setCallerUid] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState<string | null>('load');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    setBusy('load');
    try {
      const result = await loadAdminUsers(user);
      setRows(result.users);
      setCallerUid(result.callerUid);
    } catch (cause: any) { setError(cause?.message || String(cause)); }
    finally { setBusy(null); }
  };
  useEffect(() => { void refresh(); }, [user.uid]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null); setNotice(null);
    try { await fn(); await refresh(); }
    catch (cause: any) { setError(cause?.message || String(cause)); setBusy(null); }
  };

  const create = () => run('create', async () => {
    const result = await createManagedUser(user, { email, displayName, accessGranted: true });
    setEmail(''); setDisplayName('');
    setNotice(`Cuenta creada: ${result.email}. Copia y envía el enlace de configuración de contraseña.`);
    await copyText(result.passwordSetupLink).catch(() => undefined);
  });

  const resetLink = async (row: AdminUserRow) => {
    setBusy(`reset:${row.uid}`); setError(null);
    try {
      const result = await createPasswordResetLink(user, row.uid);
      await copyText(result.passwordResetLink);
      setNotice(`Enlace de contraseña de ${result.email} copiado al portapapeles.`);
    } catch (cause: any) { setError(cause?.message || String(cause)); }
    finally { setBusy(null); }
  };

  const remove = (row: AdminUserRow) => {
    if (!window.confirm(`Borrar definitivamente la cuenta ${row.email ?? row.uid} y sus datos privados?`)) return;
    void run(`delete:${row.uid}`, () => deleteManagedUser(user, row.uid));
  };

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/75 p-3 backdrop-blur-sm">
    <div className="mx-auto max-w-5xl rounded-2xl border border-violet-500/30 bg-slate-950 p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-300"/><h2 className="font-bold text-white">Administración de cuentas</h2></div><p className="mt-1 text-[11px] text-slate-400">El rol ADMIN se valida mediante Firebase Custom Claims. Los usuarios no pueden darse acceso ni privilegios desde Firestore.</p></div>
        <button onClick={onClose} className="rounded-lg border border-slate-700 p-2 text-slate-400"><X className="h-4 w-4"/></button>
      </div>

      {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
      {notice && <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</div>}

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"/>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nombre (opcional)" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"/>
        <button disabled={!email.trim() || busy != null} onClick={create} className="flex items-center justify-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><UserPlus className="h-4 w-4"/>Crear con acceso</button>
      </div>
      <div className="mt-2 text-[10px] text-slate-500">La contraseña inicial es aleatoria y no se muestra. Al crear la cuenta se genera un enlace de configuración/restablecimiento que se copia al portapapeles.</div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs"><thead className="text-slate-500"><tr><th className="p-2 text-left">Cuenta</th><th className="p-2">Acceso</th><th className="p-2">Admin</th><th className="p-2">Estado</th><th className="p-2 text-left">Último acceso</th><th className="p-2 text-right">Acciones</th></tr></thead>
          <tbody>{rows.map(row => {
            const self = row.uid === callerUid;
            return <tr key={row.uid} className="border-t border-slate-800">
              <td className="p-2"><b className="text-white">{row.email ?? row.uid}</b><div className="text-[10px] text-slate-500">{row.displayName ?? '—'} · {row.uid.slice(0, 10)}…</div></td>
              <td className="p-2 text-center"><span className={row.accessGranted ? 'text-emerald-300' : 'text-amber-300'}>{row.accessGranted ? 'CONCEDIDO' : 'PENDIENTE'}</span></td>
              <td className="p-2 text-center"><span className={row.isAdmin ? 'font-bold text-violet-300' : 'text-slate-600'}>{row.isAdmin ? 'ADMIN' : '—'}</span></td>
              <td className="p-2 text-center"><span className={row.disabled ? 'text-rose-300' : 'text-emerald-300'}>{row.disabled ? 'BLOQUEADA' : 'ACTIVA'}</span></td>
              <td className="p-2 text-slate-500">{row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString('es-ES') : 'Nunca'}</td>
              <td className="p-2"><div className="flex justify-end gap-1">
                {!self && <button title={row.accessGranted ? 'Revocar acceso' : 'Dar acceso'} disabled={busy != null} onClick={() => void run(`access:${row.uid}`, () => updateManagedUser(user, row.uid, { accessGranted: !row.accessGranted }))} className="rounded border border-slate-700 p-2 text-slate-300">{row.accessGranted ? <UserX className="h-3.5 w-3.5"/> : <CheckCircle2 className="h-3.5 w-3.5"/>}</button>}
                {!self && <button title={row.isAdmin ? 'Quitar ADMIN' : 'Hacer ADMIN'} disabled={busy != null} onClick={() => void run(`admin:${row.uid}`, () => updateManagedUser(user, row.uid, { isAdmin: !row.isAdmin }))} className="rounded border border-violet-500/30 p-2 text-violet-300"><ShieldCheck className="h-3.5 w-3.5"/></button>}
                {!self && <button title={row.disabled ? 'Reactivar cuenta' : 'Bloquear cuenta'} disabled={busy != null} onClick={() => void run(`disable:${row.uid}`, () => updateManagedUser(user, row.uid, { disabled: !row.disabled }))} className="rounded border border-amber-500/30 p-2 text-amber-300"><UserX className="h-3.5 w-3.5"/></button>}
                <button title="Copiar enlace de contraseña" disabled={busy != null || !row.email} onClick={() => void resetLink(row)} className="rounded border border-cyan-500/30 p-2 text-cyan-300"><KeyRound className="h-3.5 w-3.5"/></button>
                {!self && <button title="Borrar cuenta" disabled={busy != null} onClick={() => remove(row)} className="rounded border border-rose-500/30 p-2 text-rose-300"><Trash2 className="h-3.5 w-3.5"/></button>}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
        {busy === 'load' && <div className="p-4 text-center text-slate-500">Cargando cuentas…</div>}
      </div>
      <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500"><Copy className="h-3.5 w-3.5"/>Los enlaces de contraseña se copian para que el administrador los entregue por un canal privado.</div>
    </div>
  </div>;
};
