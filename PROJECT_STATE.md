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

# USUARIOS PRIVADOS / ADMINISTRACIÓN — IMPLEMENTADO Y VALIDADO

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

En producción Firebase es obligatorio. Cualquier error de autenticación/autorización/hidratación deja la app cerrada (`fail-closed`).

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

## Validación real realizada
Validado manualmente en el proyecto Firebase configurado:
- primer usuario ADMIN autenticado correctamente;
- cartera real migrada/asociada exclusivamente a su UID privado;
- segundo usuario creado desde el panel ADMIN;
- segundo usuario sin privilegios ADMIN;
- cartera del segundo usuario aislada de la del ADMIN;
- cambio de UID en el mismo navegador sin contaminación de `localStorage`;
- retorno al ADMIN recuperando únicamente su cartera;
- borrado del usuario de prueba disponible desde el panel.

Nuevas cuentas empiezan vacías; no existen posiciones ni cantidades personales predefinidas en código actual.

---

# ALERTAS / PERSISTENCIA 24/7 — DEDUPE DE ENTRADAS CERRADO

El deduplicado global de `GOOD_ENTRY/HIGH_CONVICTION` ya no depende del filesystem efímero cuando Firebase está configurado.

- Estado durable: `system/alertAutomation` en Firestore.
- El backend lee/escribe ese documento mediante Firebase Admin SDK.
- En producción o cuando `FIREBASE_AUTH_REQUIRED=true`, ausencia de persistencia Firebase produce `ALERT_STATE_PERSISTENCE_NOT_CONFIGURED`; no hay fallback silencioso a `.runtime`.
- Sólo desarrollo sin Firebase conserva `.runtime/alertAutomationState.json` como fallback local.
- `/api/alerts/status` devuelve `persistence: FIRESTORE | LOCAL_DEV | UNAVAILABLE`.
- Se mantiene la semántica vigente: nuevo aviso al aparecer `GOOD_ENTRY`, escalar a `HIGH_CONVICTION` o reaparecer tras dejar de ser accionable; webhook fallido no se marca como entregado.
- `tests/privateUserSecurity.unit.ts` protege también la persistencia durable del estado de alertas.

Cloud Run tiene filesystem desechable; por tanto esta migración era obligatoria antes de considerar fiable el dedupe entre reinicios/reescalados.

---

# DESPLIEGUE / AUTONOMÍA

AI Studio Preview sirve para desarrollar y probar, pero no constituye ejecución 24/7.

Destino previsto:
- app full-stack → Cloud Run;
- estado de usuario → Firestore;
- estado técnico de alertas → Firestore;
- programación fiable → Cloud Scheduler llamando `POST /api/alerts/run-now`;
- secretos sólo server-side;
- canal de aviso vía webhook.

Cuando Cloud Scheduler sea la fuente de programación en Cloud Run:
- `ALERT_AUTOMATION_ENABLED=false` para evitar doble scheduler;
- `ALERT_ADMIN_TOKEN` configurado como secreto y enviado como `x-alert-admin-token` al endpoint actual;
- zona horaria del job: `Europe/Madrid`;
- verificar `/api/alerts/status` y exigir `persistence: FIRESTORE`.

Pendiente antes de afirmar autonomía total de `WATCH/REDUCE/EXIT`: el job backend debe enumerar usuarios ACTIVE, reconstruir por UID la cartera/contexto desde Firestore y llamar al mismo `classifyPositionHealth` compartido. No crear una segunda lógica de trading.

---

# DEPENDENCIAS / LOCK

Versiones fijadas:
- `firebase 12.18.0`
- `firebase-admin 13.10.0`

`package-lock.json` fue regenerado y publicado en `main` con ambas dependencias. AI Studio validó:
- `npm ls firebase firebase-admin` PASS;
- `npm run lint` PASS;
- `tests/privateUserSecurity.unit.ts` PASS antes del cambio de persistencia de alertas;
- `npm run build` PASS.

Tras el cambio de persistencia de alertas debe repetirse sólo el gate dirigido de seguridad, lint y build; no ejecutar replay financiero.

---

# GATES RESTANTES ANTES DE PUBLICAR

1. Sincronizar el `main` actual en AI Studio/local.
2. Ejecutar:
   - `npx tsx tests/privateUserSecurity.unit.ts`
   - `npm run lint`
   - `npm run build`
3. No ejecutar replay por este bloque.
4. Desplegar `firestore.rules` en el proyecto Firebase real.
5. Probar fallo de carga privada y confirmar fail-closed si no se hizo de forma explícita.
6. Desplegar preproducción en Cloud Run con los secretos del entorno.
7. Verificar `/api/alerts/status` → `persistence: FIRESTORE`.
8. Configurar Cloud Scheduler y forzar una ejecución manual controlada antes de dejar la programación activa.
9. Mantener `ALERT_AUTOMATION_ENABLED=false` cuando Cloud Scheduler controle la cadencia.

---

# Próxima acción

Sincronizar `main` y ejecutar únicamente los tres gates dirigidos (`privateUserSecurity`, `lint`, `build`). Si pasan, desplegar las reglas Firestore y preparar Cloud Run/Cloud Scheduler. No modificar el motor financiero ni ejecutar replays.