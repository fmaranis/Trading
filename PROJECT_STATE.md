# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`. Leer este archivo primero al retomar el proyecto. El detalle histórico permanece en Git; este estado actual evita incluir datos financieros personales.

## Reglas no negociables
- Nunca usar GitHub Actions. Validaciones en local/AI Studio.
- ChatGPT modifica GitHub; AI Studio sincroniza `main`, ejecuta/Preview/valida y no modifica archivos salvo instrucción expresa.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; sin lookahead.
- Replays largos los ejecuta el motor local/app, no un agente consumiendo tokens.
- No calibrar thresholds con ventanas ya usadas para diagnóstico.
- Tras un fallo, ejecutar primero sólo el test dirigido que falla.
- No añadir scores/capas desconectadas: integrar y atribuir antes de cambiar políticas.
- La estrategia V1 queda congelada durante el piloto: sólo bugs reproducibles o problemas de datos/operación.
- Ningún dato de cartera real, efectivo, coste, historial fiscal u operación de un usuario debe quedar embebido en código público.

---

# Estado vigente — 2026-09-04

Pregunta central: **¿Muevo dinero hoy o no?**

Arquitectura financiera vigente:
1. DÓNDE — ranking/calidad/consenso.
2. CUÁNDO — Entry Timing causal.
3. CUÁNTO HOY — STARTER/BUILD/sizing.
4. CÓMO GESTIONAR — HOLD/ADD/WATCH/REDUCE/EXIT/ROTATE.
5. CASH — alternativa remunerada explícita: no invertir también puede ser la decisión correcta.

Perfil MEDIUM de referencia: STARTER READY 3% / STRONG 5%; BUILD 8%; máximo 12 posiciones; máximo 2 nuevas/evaluación. Rotación 1:1 estricta y atómica. Sin deuda/cash negativo.

Los datos de cartera real ya no se documentan aquí ni se usan como defaults de código. Se migran/persisten únicamente como estado privado asociado al UID autenticado.

---

# MOTOR VIGENTE — CERRADO

## Arquitectura validada
- Entrada productiva: `decisionMain.tsx` / centro integrado.
- Estudio actual y replay comparten scanner, `PortfolioCandidateGate` e `InvestmentDecisionEngine`.
- Señales actuales son una vista del mismo gate + `StrategyConsensusEngine` + `EntryTimingEngine`; no constituyen un motor financiero alternativo.
- `CORE_GATE_V1` tiene una única implementación compartida por replay y cartera real.
- Replay y cartera real usan el mismo `classifyPositionHealth` para HOLD/ADD/WATCH/REDUCE/EXIT.
- La cartera reconstruye retorno/MFE/giveback con lotes e historial de ejecuciones cuando el coste está completo; si falta, se declara `POSITION_COST_BASIS_INCOMPLETE` y no se inventan datos.
- `TREND_PROTECTION_V2` permanece contrafactual/experimental; no se promociona.
- `tests/decisionArchitectureParity.unit.ts` protege el cableado.

## Regresión técnica congelada
Replay REAL auditado de referencia:
- 2026-06-01 → 2026-08-31.
- DAILY · AUTO · chunks 30 días · capital de prueba 13.000 €.
- Cash histórico `HISTORICAL_ECB_DFR_FLOOR_0`.
- Valor final: 13.193,530595 €.
- Rentabilidad: +1,488696885%.
- Máximo drawdown: 0,775077842%.
- 25 ejecuciones = 12 BUY + 13 ADD.
- Comisiones: 20 €.
- Señales persistidas compactadas: 928; diagnósticas: 28.

Este benchmark es exclusivamente una regresión técnica para detectar cambios del motor; no representa ni publica la cartera real de ningún usuario.

## Política de experiments
- `SELECTION_QUALITY_V1`: no promocionado.
- `QUALITY_SIZING_V1`: no promocionado.
- `SELECTION_SLOPE_V1`: no promocionado.
- `TREND_PROTECTION_V2_MEDIUM_TERM_WINNER_CONFIRM`: no promocionado.
- No reabrir thresholds por diferencias menores aisladas.

---

# UX / V1 PILOT — IMPLEMENTADO

La interfaz ya incorpora:
- resumen ejecutivo “qué hacer hoy / cuánto / qué vigilar”;
- zoom 1M/3M/6M/1A/Todo en investigación;
- SMA20/SMA50 activables;
- BUY/ADD/SELL-REDUCE en gráfica;
- tabla de operaciones visibles;
- vista centrada por operación con contexto ex post claramente separado de la decisión causal;
- historial diario V1 PILOT;
- seguimiento de posiciones con retorno/MFE/giveback/estado;
- historial de ejecuciones reales;
- disponibilidad MyInvestor confirmable por usuario;
- alarmas de entrada por evento nuevo, no repetitivas;
- si el webhook falla, el evento no se marca como entregado y puede reintentarse.

La trayectoria posterior a una operación es siempre diagnóstico ex post y nunca input causal.

---

# USUARIOS PRIVADOS / ADMINISTRACIÓN — IMPLEMENTACIÓN EN MAIN

## Objetivo
La versión publicada debe ser multiusuario y fail-closed. No se publica una cartera mediante una sesión pública ni se confía en un UID enviado por el navegador.

## Arquitectura
- Firebase Authentication: email/password.
- El cliente envía Firebase ID token al backend.
- Backend verifica `verifyIdToken(..., true)` y obtiene el UID real del token.
- Firestore persiste estado privado por `users/{uid}/private/state`.
- Firebase Admin SDK gestiona usuarios/claims; no se confía en campos editables de Firestore para privilegios.
- Custom Claims:
  - `accessGranted=true` → acceso a la aplicación privada.
  - `isAdmin=true` → administración de cuentas y acceso propio.
- ADMIN administra cuentas, pero no dispone de endpoint/UI para leer la cartera financiera de otro usuario.
- Firestore rules: estado financiero privado legible sólo por su propietario; deny-by-default y sin escrituras directas desde cliente.

## Entradas protegidas
- `/`
- `/portfolio.html`
- `/legacy.html`

En producción Firebase es obligatorio aunque una variable de entorno estuviese mal configurada. Cualquier error de autenticación/autorización/hidratación deja la app cerrada (`fail-closed`).

## Administración de cuentas
El panel ADMIN permite:
- listar cuentas;
- crear cuenta con acceso;
- conceder/revocar acceso;
- promover/despromover ADMIN;
- bloquear/reactivar;
- generar enlace de cambio/configuración de contraseña;
- borrar cuenta y árbol Firestore asociado.

Protecciones:
- no auto-borrado / auto-bloqueo / auto-desadmin;
- no eliminación/despromoción del último ADMIN activo;
- revocación de refresh tokens al bloquear o retirar privilegios.

Primer ADMIN:
- se configura mediante `FIREBASE_BOOTSTRAP_ADMIN_EMAILS` o UID exacto;
- bootstrap por email exige `email_verified=true`;
- después se fuerza renovación de token para recibir los claims.

## Privacidad de estado local
- Cada UID tiene marcador propietario local `custodia_cloud_owner_uid_v1`.
- Si cambia el UID en el mismo navegador, primero se limpian las claves privadas del usuario anterior.
- Si el UID ya tiene cloud state, ese estado manda y reemplaza la caché local.
- Si es el primer UID y existe el estado histórico local sin propietario, se migra una sola vez a ese UID.
- Logout intenta sincronizar y limpia la caché privada.
- Nuevas cuentas empiezan con cartera vacía; no hay posiciones ni cantidades personales predefinidas en el código actual.

Claves migradas/aisladas incluyen cartera unificada, claves legacy de fondos/capital, plan pendiente de ejecución, historial de ejecuciones/cashflow, disponibilidad MyInvestor, historial piloto, fiscalidad/lotes, cash benchmark e historial de decisiones.

## Archivos principales
- `server/firebaseAdmin.ts`
- `server/authSecurity.ts`
- `server/accountRoutes.ts`
- `src/auth/firebaseClient.ts`
- `src/auth/accountApi.ts`
- `src/auth/userCloudState.ts`
- `src/auth/SecureAppGate.tsx`
- `src/components/AdminUsersPanel.tsx`
- `firestore.rules`
- `firebase.json`
- `tests/privateUserSecurity.unit.ts`
- `docs/PRIVATE_USERS_DEPLOYMENT.md`

---

# DESPLIEGUE / AUTONOMÍA

AI Studio Preview sirve para desarrollar y probar, pero no constituye ejecución 24/7.

Destino recomendado:
- app full-stack → Cloud Run;
- estado de usuario → Firestore;
- programación fiable → Cloud Scheduler llamando `POST /api/alerts/run-now`;
- secretos sólo server-side;
- canal de aviso vía webhook.

Pendiente antes de afirmar autonomía total de `WATCH/REDUCE/EXIT`: el job backend debe reconstruir por UID la cartera/contexto desde Firestore y llamar al mismo clasificador compartido. No crear una segunda lógica de trading.

El dedupe global actual del job de entradas sigue usando `.runtime/alertAutomationState.json`; en un contenedor efímero debe migrarse a almacenamiento persistente antes del despliegue 24/7 definitivo.

---

# GATES ANTES DE PUBLICAR

Después de sincronizar `main` en el entorno local/AI Studio:

1. Ejecutar `npm install` una vez para instalar Firebase y regenerar `package-lock.json` coherente.
2. Ejecutar `npx tsx tests/privateUserSecurity.unit.ts`.
3. Ejecutar `npm run lint`.
4. Ejecutar `npx tsx tests/userPortfolio.unit.ts` y `npx tsx tests/fundPortfolio.unit.ts`.
5. No ejecutar replay por este bloque: seguridad/persistencia no debe cambiar estrategia.
6. Configurar proyecto Firebase, Email/Password y Firestore.
7. Configurar `FIREBASE_AUTH_REQUIRED=true` para prueba de preproducción.
8. Configurar y verificar el primer ADMIN.
9. Desplegar `firestore.rules`.
10. Probar cuenta normal, cuenta pendiente, ADMIN, bloqueo y borrado de una cuenta de prueba.
11. Probar cambio de UID en el mismo navegador y verificar que no aparece la cartera anterior.
12. Probar fallo de carga privada y confirmar que la app no renderiza cartera.

`package-lock.json` se eliminó temporalmente porque el lock anterior no contenía las nuevas dependencias Firebase y este entorno no puede resolver npm para regenerarlo. No desplegar hasta regenerarlo mediante `npm install` y validar.

---

# Próxima acción

Sincronizar `main` y ejecutar únicamente los gates anteriores. Si pasan, el siguiente bloque es configurar Firebase real y desplegar preproducción; no modificar el motor financiero.