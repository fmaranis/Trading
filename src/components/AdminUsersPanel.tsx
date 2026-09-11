import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, History, KeyRound, Search, ShieldCheck, Trash2, UserPlus, UserX, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  createManagedUser,
  createPasswordResetLink,
  deleteManagedUser,
  loadAdminAudit,
  loadAdminUsers,
  updateManagedUser,
  type AdminAuditRow,
  type AdminUserRow
} from '../auth/accountApi';

interface Props { user: User; onClose: () => void; }
type ManagedUserPatch = { accessGranted?: boolean; disabled?: boolean; isAdmin?: boolean };
type PendingAdminAction =
  | { kind: 'update'; key: string; title: string; message: string; row: AdminUserRow; patch: ManagedUserPatch }
  | { kind: 'delete'; key: string; title: string; message: string; row: AdminUserRow };
interface GeneratedLink { label: string; url: string; }

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function auditActionLabel(action: string): string {
  switch (action) {
    case 'USER_CREATED': return 'Usuario creado';
    case 'USER_UPDATED': return 'Usuario actualizado';
    case 'PASSWORD_RESET_LINK_CREATED': return 'Enlace de contraseña generado';
    case 'USER_DELETED': return 'Usuario eliminado';
    default: return action;
  }
}

export const AdminUsersPanel: React.FC<Props> = ({ user, onClose }) => {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [auditRows, setAuditRows] = useState<AdminAuditRow[]>([]);
  const [callerUid, setCallerUid] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>('load');
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);

  const refresh = async () => {
    setError(null);
    setAuditError(null);
    setBusy('load');
    try {
      const [usersResult, auditResult] = await Promise.allSettled([
        loadAdminUsers(user),
        loadAdminAudit(user, 30)
      ]);
      if (usersResult.status === 'rejected') throw usersResult.reason;
      setRows(usersResult.value.users);
      setCallerUid(usersResult.value.callerUid);
      if (auditResult.status === 'fulfilled') {
        setAuditRows(auditResult.value.entries);
      } else {
        setAuditError(`Usuarios actualizados, pero no se pudo cargar la actividad administrativa: ${String((auditResult.reason as any)?.message || auditResult.reason)}`);
      }
    } catch (cause: any) { setError(cause?.message || String(cause)); }
    finally { setBusy(null); }
  };
  useEffect(() => { void refresh(); }, [user.uid]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null); setNotice(null);
    try {
      const result = await fn();
      if (result && typeof result === 'object' && 'profileSynced' in result && (result as { profileSynced?: boolean }).profileSynced === false) {
        setNotice('Cambio aplicado en Firebase Auth. El espejo de perfil no se pudo actualizar en ese intento y se reintentará al volver a cargar la cuenta.');
      }
      await refresh();
    }
    catch (cause: any) { setError(cause?.message || String(cause)); setBusy(null); }
  };

  const create = () => run('create', async () => {
    const result = await createManagedUser(user, { email, displayName, accessGranted: true });
    setEmail(''); setDisplayName('');
    setGeneratedLink({ label: `Configuración de contraseña · ${result.email}`, url: result.passwordSetupLink });
    const copied = await copyText(result.passwordSetupLink);
    setNotice(copied
      ? `Cuenta creada: ${result.email}. El enlace de configuración se ha copiado y queda visible abajo.`
      : `Cuenta creada: ${result.email}. El navegador no permitió copiar automáticamente; el enlace queda visible abajo.`);
    return result;
  });

  const resetLink = async (row: AdminUserRow) => {
    setBusy(`reset:${row.uid}`); setError(null); setNotice(null);
    try {
      const result = await createPasswordResetLink(user, row.uid);
      setGeneratedLink({ label: `Restablecimiento de contraseña · ${result.email}`, url: result.passwordResetLink });
      const copied = await copyText(result.passwordResetLink);
      await refresh();
      setNotice(copied
        ? `Enlace de contraseña de ${result.email} copiado. También queda visible abajo.`
        : `Enlace de contraseña generado para ${result.email}. El navegador no permitió copiar automáticamente; queda visible abajo.`);
    } catch (cause: any) { setError(cause?.message || String(cause)); setBusy(null); }
    finally { setBusy(null); }
  };

  const requestUpdate = (row: AdminUserRow, key: string, title: string, message: string, patch: ManagedUserPatch) => {
    setError(null); setNotice(null);
    setPendingAction({ kind: 'update', key, title, message, row, patch });
  };

  const requestRemove = (row: AdminUserRow) => {
    setError(null); setNotice(null);
    setPendingAction({
      kind: 'delete',
      key: 'delete',
      title: 'Borrar cuenta',
      message: `Borrar definitivamente la cuenta ${row.email ?? row.uid} y sus datos privados? Esta acción no se puede deshacer.`,
      row
    });
  };

  const confirmPendingAction = async () => {
    const action = pendingAction;
    if (!action || busy != null) return;
    setPendingAction(null);
    if (action.kind === 'update') {
      await run(`${action.key}:${action.row.uid}`, () => updateManagedUser(user, action.row.uid, action.patch));
      return;
    }
    await run(`delete:${action.row.uid}`, () => deleteManagedUser(user, action.row.uid));
  };

  const copyGeneratedLink = async () => {
    if (!generatedLink) return;
    const copied = await copyText(generatedLink.url);
    setNotice(copied
      ? 'Enlace copiado al portapapeles.'
      : 'El navegador no permite copiar automáticamente. Selecciona el enlace visible y cópialo manualmente.');
  };

  const needle = query.trim().toLowerCase();
  const visibleRows = rows.filter(row => !needle || [row.email, row.displayName, row.uid].some(value => String(value ?? '').toLowerCase().includes(needle)));
  const emailByUid = new Map(rows.map(row => [row.uid, row.email ?? row.uid]));

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/75 p-3 backdrop-blur-sm">
    <div className="mx-auto max-w-5xl rounded-2xl border border-violet-500/30 bg-slate-950 p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-300"/><h2 className="font-bold text-white">Administración de cuentas</h2></div><p className="mt-1 text-[11px] text-slate-400">El rol ADMIN se valida mediante Firebase Custom Claims. Los usuarios no pueden darse acceso ni privilegios desde Firestore. Las operaciones administrativas sensibles quedan auditadas en el backend de Trading.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 p-2 text-slate-400"><X className="h-4 w-4"/></button>
      </div>

      {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
      {notice && <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</div>}

      {pendingAction && <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
        <div className="text-xs font-bold text-amber-200">Confirmar acción · {pendingAction.title}</div>
        <div className="mt-1 text-xs text-slate-300">{pendingAction.message}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy != null} onClick={() => void confirmPendingAction()} className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Confirmar acción</button>
          <button type="button" disabled={busy != null} onClick={() => setPendingAction(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 disabled:opacity-50">Cancelar</button>
        </div>
      </div>}

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"/>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nombre (opcional)" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"/>
        <button type="button" disabled={!email.trim() || busy != null} onClick={create} className="flex items-center justify-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><UserPlus className="h-4 w-4"/>Crear con acceso</button>
      </div>
      <div className="mt-2 text-[10px] text-slate-500">La contraseña inicial es aleatoria y no se muestra. Al crear la cuenta se genera un enlace de configuración/restablecimiento. El enlace queda visible en el panel aunque el navegador bloquee el portapapeles.</div>

      {generatedLink && <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
        <div className="text-[10px] font-bold text-cyan-200">{generatedLink.label}</div>
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <input readOnly value={generatedLink.url} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-[10px] text-slate-200"/>
          <button type="button" onClick={() => void copyGeneratedLink()} className="flex items-center justify-center gap-1 rounded border border-cyan-500/30 px-3 py-2 text-[10px] font-bold text-cyan-200"><Copy className="h-3.5 w-3.5"/>Copiar enlace</button>
          <button type="button" onClick={() => setGeneratedLink(null)} className="rounded border border-slate-700 px-3 py-2 text-[10px] text-slate-400">Ocultar</button>
        </div>
      </div>}

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
        <Search className="h-4 w-4 text-slate-500"/>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por correo, nombre o UID" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600"/>
        <span className="text-[10px] text-slate-500">{visibleRows.length}/{rows.length}</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs"><thead className="text-slate-500"><tr><th className="p-2 text-left">Cuenta</th><th className="p-2">Correo</th><th className="p-2">Acceso</th><th className="p-2">Admin</th><th className="p-2">Estado</th><th className="p-2 text-left">Último acceso</th><th className="p-2 text-right">Acciones</th></tr></thead>
          <tbody>{visibleRows.map(row => {
            const self = row.uid === callerUid;
            return <tr key={row.uid} className="border-t border-slate-800">
              <td className="p-2"><b className="text-white">{row.email ?? row.uid}</b><div className="text-[10px] text-slate-500">{row.displayName ?? '—'} · {row.uid.slice(0, 10)}…</div></td>
              <td className="p-2 text-center"><span className={row.emailVerified ? 'text-emerald-300' : 'text-amber-300'}>{row.emailVerified ? 'VERIFICADO' : 'PENDIENTE'}</span></td>
              <td className="p-2 text-center"><span className={row.accessGranted ? 'text-emerald-300' : 'text-amber-300'}>{row.isAdmin ? 'POR ADMIN' : row.accessGranted ? 'CONCEDIDO' : 'PENDIENTE'}</span></td>
              <td className="p-2 text-center"><span className={row.isAdmin ? 'font-bold text-violet-300' : 'text-slate-600'}>{row.isAdmin ? 'ADMIN' : '—'}</span></td>
              <td className="p-2 text-center"><span className={row.disabled ? 'text-rose-300' : 'text-emerald-300'}>{row.disabled ? 'BLOQUEADA' : 'ACTIVA'}</span></td>
              <td className="p-2 text-slate-500">{row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString('es-ES') : 'Nunca'}</td>
              <td className="p-2"><div className="flex justify-end gap-1">
                {!self && !row.isAdmin && <button type="button" title={row.accessGranted ? 'Revocar acceso' : 'Dar acceso'} disabled={busy != null} onClick={() => requestUpdate(row, 'access', row.accessGranted ? 'Revocar acceso' : 'Conceder acceso', `${row.accessGranted ? 'Revocar' : 'Conceder'} acceso a ${row.email ?? row.uid}?`, { accessGranted: !row.accessGranted })} className="rounded border border-slate-700 p-2 text-slate-300 disabled:opacity-50">{row.accessGranted ? <UserX className="h-3.5 w-3.5"/> : <CheckCircle2 className="h-3.5 w-3.5"/>}</button>}
                {!self && <button type="button" title={row.isAdmin ? 'Quitar ADMIN' : 'Hacer ADMIN'} disabled={busy != null} onClick={() => requestUpdate(row, 'admin', row.isAdmin ? 'Retirar ADMIN' : 'Conceder ADMIN', `${row.isAdmin ? 'Retirar ADMIN de' : 'Conceder ADMIN a'} ${row.email ?? row.uid}?`, { isAdmin: !row.isAdmin })} className="rounded border border-violet-500/30 p-2 text-violet-300 disabled:opacity-50"><ShieldCheck className="h-3.5 w-3.5"/></button>}
                {!self && <button type="button" title={row.disabled ? 'Reactivar cuenta' : 'Bloquear cuenta'} disabled={busy != null} onClick={() => requestUpdate(row, 'disable', row.disabled ? 'Reactivar cuenta' : 'Bloquear cuenta', `${row.disabled ? 'Reactivar' : 'Bloquear'} la cuenta ${row.email ?? row.uid}?`, { disabled: !row.disabled })} className="rounded border border-amber-500/30 p-2 text-amber-300 disabled:opacity-50"><UserX className="h-3.5 w-3.5"/></button>}
                <button type="button" title="Generar enlace de contraseña" disabled={busy != null || !row.email} onClick={() => void resetLink(row)} className="rounded border border-cyan-500/30 p-2 text-cyan-300 disabled:opacity-50"><KeyRound className="h-3.5 w-3.5"/></button>
                {!self && <button type="button" title="Borrar cuenta" disabled={busy != null} onClick={() => requestRemove(row)} className="rounded border border-rose-500/30 p-2 text-rose-300 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5"/></button>}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
        {busy === 'load' && <div className="p-4 text-center text-slate-500">Cargando cuentas…</div>}
        {busy !== 'load' && visibleRows.length === 0 && <div className="p-4 text-center text-xs text-slate-500">No hay cuentas que coincidan con la búsqueda.</div>}
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-violet-300"/><h3 className="text-xs font-bold text-white">Actividad administrativa reciente</h3><span className="text-[10px] text-slate-500">últimas {auditRows.length}</span></div>
        {auditError && <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-200">{auditError}</div>}
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-800">
          {auditRows.length === 0 ? <div className="p-3 text-[10px] text-slate-500">Todavía no hay operaciones administrativas auditadas.</div> : auditRows.map(entry => <div key={entry.id} className="grid gap-1 border-b border-slate-800 p-3 text-[10px] last:border-b-0 md:grid-cols-[150px_1fr_1fr]">
            <div className="text-slate-500">{entry.createdAt ? new Date(entry.createdAt).toLocaleString('es-ES') : '—'}</div>
            <div><b className="text-violet-200">{auditActionLabel(entry.action)}</b><div className="text-slate-500">por {entry.actorEmail ?? entry.actorUid}</div></div>
            <div className="text-slate-400">objetivo: {entry.targetUid ? (emailByUid.get(entry.targetUid) ?? entry.targetUid) : '—'}</div>
          </div>)}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500"><Copy className="h-3.5 w-3.5"/>Un ADMIN siempre tiene acceso: para revocárselo primero hay que retirarle ADMIN. Los enlaces de contraseña permanecen visibles aunque el preview bloquee confirmaciones o portapapeles nativos. Trading conserva su propio Firebase, usuarios, datos y backend.</div>
    </div>
  </div>;
};