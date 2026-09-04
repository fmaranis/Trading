import React, { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, getIdToken, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { KeyRound, LogOut, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { AdminUsersPanel } from '../components/AdminUsersPanel';
import { bootstrapAccount, loadAccountMe, type AccountMe } from './accountApi';
import { loadFirebaseClientRuntime, type FirebaseClientRuntime } from './firebaseClient';
import { clearPrivateLocalState, UserCloudStateService } from './userCloudState';

interface Props { children: React.ReactNode; }

type GateState = 'LOADING' | 'LOGIN' | 'PENDING' | 'READY' | 'DEV_BYPASS' | 'ERROR';

export const SecureAppGate: React.FC<Props> = ({ children }) => {
  const [runtime, setRuntime] = useState<FirebaseClientRuntime | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<AccountMe | null>(null);
  const [gate, setGate] = useState<GateState>('LOADING');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let syncStop: (() => void) | null = null;
    let alive = true;
    loadFirebaseClientRuntime().then(rt => {
      if (!alive) return;
      setRuntime(rt);
      if (!rt.config.configured || !rt.auth) {
        setGate(rt.config.authRequired ? 'ERROR' : 'DEV_BYPASS');
        return;
      }
      unsubscribe = onAuthStateChanged(rt.auth, async current => {
        syncStop?.(); syncStop = null;
        setUser(current);
        setMe(null);
        setMessage(null);
        if (!current) { setGate('LOGIN'); return; }
        setGate('LOADING');
        try {
          const boot = await bootstrapAccount(current);
          if (boot.tokenRefreshRequired) await getIdToken(current, true);
          const account = await loadAccountMe(current);
          setMe(account);
          if (!account.accessGranted) { setGate('PENDING'); return; }
          const hydration = await UserCloudStateService.hydrate(current);
          syncStop = UserCloudStateService.startAutoSync(current);
          if (hydration.migratedLegacy) setMessage('La cartera local existente se ha vinculado a esta cuenta privada.');
          setGate('READY');
        } catch (error: any) {
          const text = String(error?.message || error);
          if (text.includes('ACCOUNT_ACCESS_PENDING_OR_REVOKED')) setGate('PENDING');
          else { setMessage(text); setGate('ERROR'); }
        }
      });
    }).catch(error => { if (alive) { setMessage(error?.message || String(error)); setGate('ERROR'); } });
    return () => { alive = false; unsubscribe?.(); syncStop?.(); };
  }, []);

  const authenticate = async () => {
    if (!runtime?.auth) return;
    setBusy(true); setMessage(null);
    try {
      if (mode === 'REGISTER') {
        if (!runtime.config.selfRegistrationEnabled) throw new Error('El registro público está desactivado. Un administrador debe crear la cuenta.');
        await createUserWithEmailAndPassword(runtime.auth, email.trim(), password);
        setMessage('Cuenta creada. Queda pendiente de aprobación por un administrador.');
      } else {
        await signInWithEmailAndPassword(runtime.auth, email.trim(), password);
      }
    } catch (error: any) { setMessage(error?.message || String(error)); }
    finally { setBusy(false); }
  };

  const refreshAccess = async () => {
    if (!user) return;
    setBusy(true); setMessage(null);
    try {
      await getIdToken(user, true);
      const account = await loadAccountMe(user);
      setMe(account);
      if (!account.accessGranted) { setMessage('La cuenta sigue pendiente de aprobación.'); return; }
      await UserCloudStateService.hydrate(user);
      setGate('READY');
    } catch (error: any) { setMessage(error?.message || String(error)); }
    finally { setBusy(false); }
  };

  const forgotPassword = async () => {
    if (!runtime?.auth || !email.trim()) { setMessage('Indica primero tu correo.'); return; }
    try { await sendPasswordResetEmail(runtime.auth, email.trim()); setMessage('Firebase ha generado el proceso de restablecimiento para ese correo.'); }
    catch (error: any) { setMessage(error?.message || String(error)); }
  };

  const logout = async () => {
    if (!runtime?.auth || !user) return;
    setBusy(true);
    try { await UserCloudStateService.push(user).catch(() => undefined); await signOut(runtime.auth); }
    finally { clearPrivateLocalState(); setBusy(false); }
  };

  if (gate === 'DEV_BYPASS') return <><div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-[10px] font-bold text-amber-200">MODO LOCAL PRIVADO · Firebase aún no configurado. En producción este bypass está prohibido.</div>{children}</>;

  if (gate === 'LOADING') return <div className="flex min-h-screen items-center justify-center bg-[#0b0f19] text-slate-300"><RefreshCw className="mr-2 h-4 w-4 animate-spin"/>Verificando sesión privada…</div>;

  if (gate === 'ERROR' && (!runtime?.config.configured || !user)) return <div className="flex min-h-screen items-center justify-center bg-[#0b0f19] p-4"><div className="max-w-lg rounded-2xl border border-rose-500/30 bg-slate-950 p-6 text-sm text-slate-300"><h1 className="font-bold text-rose-200">Acceso privado no disponible</h1><p className="mt-2">La versión publicada exige Firebase Authentication correctamente configurado. No se muestra ninguna cartera sin protección.</p>{message && <div className="mt-3 font-mono text-xs text-rose-300">{message}</div>}</div></div>;

  if (gate === 'LOGIN') return <div className="flex min-h-screen items-center justify-center bg-[#0b0f19] p-4">
    <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
      <div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-cyan-300"/><div><h1 className="font-bold text-white">Custodia · acceso privado</h1><p className="text-[11px] text-slate-500">La cartera, efectivo, historial y decisiones sólo se cargan después de autenticar la cuenta.</p></div></div>
      <div className="mt-5 space-y-3"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white"/><input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void authenticate(); }} placeholder="Contraseña" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white"/></div>
      {message && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">{message}</div>}
      <button disabled={busy || !email.trim() || password.length < 6} onClick={() => void authenticate()} className="mt-4 w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Procesando…' : mode === 'LOGIN' ? 'Entrar' : 'Crear cuenta'}</button>
      <div className="mt-3 flex items-center justify-between text-[11px]"><button onClick={() => void forgotPassword()} className="text-slate-400 hover:text-cyan-300">He olvidado la contraseña</button>{runtime?.config.selfRegistrationEnabled && <button onClick={() => { setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setMessage(null); }} className="text-cyan-300">{mode === 'LOGIN' ? 'Solicitar cuenta' : 'Ya tengo cuenta'}</button>}</div>
      {mode === 'REGISTER' && <div className="mt-3 text-[10px] text-slate-500">El registro no concede acceso a carteras. La cuenta queda pendiente hasta que un administrador la apruebe.</div>}
    </div>
  </div>;

  if (gate === 'PENDING') return <div className="flex min-h-screen items-center justify-center bg-[#0b0f19] p-4"><div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-950 p-6 text-center"><UserRound className="mx-auto h-8 w-8 text-amber-300"/><h1 className="mt-3 font-bold text-white">Cuenta pendiente de acceso</h1><p className="mt-2 text-sm text-slate-400">{me?.email ?? user?.email} está autenticada, pero todavía no puede leer ni guardar una cartera. Un administrador debe concederle acceso.</p>{message && <div className="mt-3 text-xs text-amber-200">{message}</div>}<div className="mt-5 flex justify-center gap-2"><button disabled={busy} onClick={() => void refreshAccess()} className="flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white"><RefreshCw className="h-3.5 w-3.5"/>Comprobar acceso</button><button disabled={busy} onClick={() => void logout()} className="flex items-center gap-1 rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300"><LogOut className="h-3.5 w-3.5"/>Salir</button></div></div></div>;

  return <>
    <div className="fixed bottom-3 right-3 z-[80] flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/95 p-2 shadow-xl backdrop-blur">
      <div className="hidden text-right sm:block"><div className="max-w-48 truncate text-[10px] font-bold text-white">{me?.email ?? user?.email}</div><div className="text-[9px] text-slate-500">{me?.isAdmin ? 'ADMIN · acceso privado' : 'usuario · acceso privado'}</div></div>
      {me?.isAdmin && <button title="Administrar cuentas" onClick={() => setAdminOpen(true)} className="rounded-lg border border-violet-500/30 p-2 text-violet-300"><ShieldCheck className="h-4 w-4"/></button>}
      <button title="Restablecer contraseña" onClick={() => { if (runtime?.auth && user?.email) void sendPasswordResetEmail(runtime.auth, user.email).then(() => setMessage('Correo de restablecimiento solicitado.')).catch(() => undefined); }} className="rounded-lg border border-slate-700 p-2 text-slate-400"><KeyRound className="h-4 w-4"/></button>
      <button title="Cerrar sesión" disabled={busy} onClick={() => void logout()} className="rounded-lg border border-slate-700 p-2 text-slate-400"><LogOut className="h-4 w-4"/></button>
    </div>
    {message && gate === 'READY' && <div className="fixed bottom-16 right-3 z-[79] max-w-sm rounded-lg border border-cyan-500/25 bg-slate-950 p-3 text-[10px] text-cyan-200">{message}</div>}
    {children}
    {adminOpen && user && <AdminUsersPanel user={user} onClose={() => setAdminOpen(false)}/>} 
  </>;
};
