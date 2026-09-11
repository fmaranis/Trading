# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`.
>
> Al retomar trabajo técnico: comprobar primero el HEAD real de `main`, leer este archivo y después `docs/APP_FLOW_AND_ROADMAP.md`. Si un chat antiguo contradice el repositorio actual, manda el repositorio.

Documentos de entrada:

- `PROJECT_STATE.md` — estado técnico y siguiente paso.
- `docs/APP_FLOW_AND_ROADMAP.md` — diagrama maestro y ruta de cierre.
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md` — arquitectura normativa de discovery/Top64.
- `docs/DECISIONS.md` — decisiones durables.

---

# INSTRUCCIONES BASE DE TRABAJO — OBLIGATORIAS

Objetivo: entregar resultados correctos a la primera, sin errores evitables, supuestos ocultos ni trabajo incompleto.

## Contexto técnico

Stack verificado en `package.json` a 2026-09-11:

- TypeScript `~5.8.2`;
- React / React DOM `^19.0.1`;
- Vite `^6.2.3`;
- Tailwind CSS `^4.1.14`;
- Express `^4.21.2`;
- Firebase client `12.18.0`;
- Firebase Admin `13.10.0`;
- `tsx` `^4.21.0`;
- Recharts `^3.10.1`;
- Motion `^12.23.24`.

No asumir una versión concreta de Node desplegado si no está verificada.

Restricciones permanentes:

- repo canónico `fmaranis/Trading`, rama `main`;
- arquitectura productiva `CORE_ARCHITECTURE_V1`;
- cambios mínimos e integrados;
- no crear motores, pantallas, jobs o replays paralelos si la capacidad cabe en el flujo existente;
- no añadir dependencias sin necesidad real;
- no usar GitHub Actions para replays o validaciones largas;
- trabajos largos en el motor local/backend de la app;
- respetar `REAL / STATIC_REFERENCE / SYNTHETIC`, causalidad y no-lookahead;
- no reutilizar muestras consumidas como fresh/OOS;
- no tocar archivos congelados de validaciones prospectivas sin decisión metodológica explícita;
- Cubetos/Muros puede servir como referencia técnica, nunca como dependencia o plataforma compartida.

## Forma de trabajo obligatoria

Antes de una tarea técnica relevante:

1. confirmar en 1–2 líneas qué se va a hacer y el resultado esperado;
2. comprobar HEAD y este `PROJECT_STATE.md`;
3. preguntar antes de implementar si falta información crítica;
4. no inventar datos ni rellenar huecos silenciosamente;
5. señalar problemas fuera de alcance antes de arreglarlos, salvo regresión imprescindible para completar correctamente la tarea.

En tareas de varios pasos:

1. plan breve;
2. ejecución siguiendo el plan;
3. si un hallazgo cambia materialmente alcance/arquitectura/metodología, explicar y ajustar antes de continuar;
4. no añadir cambios por “ya que estamos”.

Entregables:

- completos y utilizables;
- sin `TODO`, `...` ni pseudocódigo incompleto;
- cambios mínimos;
- errores/casos límite tratados;
- no inventar APIs/comandos/librerías;
- verificar el camino real cuando intervienen UI, worker, backend, persistencia, replay o scheduler.

Antes de entregar revisar:

1. alcance exacto;
2. funcionamiento punta a punta;
3. casos límite;
4. sintaxis/tipos/lógica/cálculo/causalidad;
5. restricciones arquitectónicas/metodológicas;
6. no romper capacidades ya validadas;
7. revisar diff final;
8. actualizar este archivo y roadmap si el cambio es relevante.

Regla de oro: si hay que elegir entre rapidez y corrección, prima la corrección.

---

# 0. RUTA DE TRABAJO VIGENTE

```text
FASE 0  MAPA MAESTRO / ESTADO CANÓNICO       ← DONE
FASE 1  BASE PRODUCTIVA V1                    ← DONE salvo bug/regresión reproducible
FASE 2  USUARIOS / SEGURIDAD / AUTONOMÍA      ← ACTIVA · 2A REABIERTO POR BUG REAL DE REVOCACIÓN · FIX IMPLEMENTADO, VALIDACIÓN PENDIENTE
FASE 3  PROTOCOLO ECONÓMICO FINAL             ← NEXT después de cerrar Fase 2
FASE 4  REENTRADA TRAS SALIDA ERRÓNEA         ← research fresh/blind/OOS
FASE 5  PROTECCIÓN DE GRANDES GANADORES       ← research fresh/blind/OOS
FASE 6  FORWARD RISK V8 COMO CONTEXTO         ← research posterior
FASE 7  QUALITY FUTURE FORWARD                ← WAITING/COLLECTING en paralelo
FASE 8  UNIVERSO HISTÓRICO POINT-IN-TIME      ← pendiente para evidencia histórica fuerte
FASE 9  AUDITORÍA END-TO-END / CIERRE V1      ← cierre final
FASE 10 EXPANSIONES V2                        ← DEFERRED
```

Carriles:

- Producto/operación: F0 → F1 → F2 → F9.
- Evidencia económica: F3 → F4 → F5 → F6 → F9.
- Prospectivo por calendario: F7.
- Datos históricos: F8 → F9.
- V2: F10 tras cerrar V1.

Regla: cada hallazgo se clasifica como `BUG`, `HYPOTHESIS`, `DEFERRED` o `RETIRED`; no se abre una fase posterior sin cerrar/registrar la actual.

---

# 1. ARQUITECTURA PRODUCTIVA — CERRADA

Cadena canónica:

```text
mercado REAL actual
→ AssetUniverseScanner
→ Top64 dinámico
→ PortfolioCandidateGate
→ InvestmentDecisionEngine
→ PortfolioDecisionEngine / evaluatePortfolioDecision
→ CORE_GATE_V1
→ CORE_ARCHITECTURE_V1
→ buildPortfolioExecutionPlan
→ applyTaxAwareExecutionOverlay
→ COMPRAR / VENDER / TRASPASAR / REVIEW / NO HACER NADA
→ ejecución manual
→ registro y seguimiento
```

Producción:

- allocation/opportunity: `LEGACY`;
- `CORE_ELIGIBILITY_V2`: shadow;
- Forward Risk: sin autoridad productiva;
- una sola `portfolioDecision` y un solo `executionPlan`;
- cero capital real permanece cero;
- propuesta teórica suprimida por costes/fiscalidad = `REVIEW`, no orden.

Rutas:

- `/` superficie canónica;
- `/portfolio.html` laboratorio sin autoridad productiva;
- `/legacy.html` redirige a `/`.

Último quick closure completo anterior al bug de smoke, ejecutado por el usuario el 2026-09-11 sobre `dac08b2729d7e3c0065f33918154cd94a969cfd0`:

- superficie: 32/32 PASS;
- decisión única: 20/20 PASS;
- ejecución: 29/29 PASS;
- cartera: 24/24 PASS;
- salud: 27/27 PASS;
- broker: 7/7 PASS;
- fiscalidad: 7/7 PASS;
- TypeScript: PASS.

Ese PASS no cerró Fase 2A porque el smoke real encontró un fallo que los guards estáticos no detectaban.

---

# 2. DISCOVERY / TOP64 — CERRADO

- `OPEN_MARKET_DISCOVERY_V1` integrado en `AssetUniverseScanner`.
- 64 = máximo/target dinámico, no whitelist fija.
- `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` = seed/bootstrap/fallback.
- ranking productivo = `MARKET_SHORTLIST_LEGACY_SCORE_V1`.
- diversificación/caps aguas abajo.

Validación REAL 2026-09-09:

- raw 180;
- EUR aceptados 113;
- ETF 50;
- EQUITY 63;
- promovidos fuera del seed 98;
- scanner pool 162;
- REAL aceptados 157;
- Top64 64;
- `OPEN_*` 29;
- gate LEGACY 11/11;
- leaks fuera de Top64 0.

Estado: PASS / ARCHIVED.

---

# 3. REPLAY HISTÓRICO — INTEGRADO Y CAUSAL

Modos:

- Desde cero / manual / cartera actual;
- Motor Custodia / mantener cartera;
- DAILY / WEEKLY / MONTHLY / QUARTERLY como frecuencia de revisión.

Incluye:

- información sólo hasta `decisionDate`;
- ejecución posterior a señal / `NEXT_OPEN`;
- cash BCE histórico cuando corresponde;
- fiscalidad causal;
- `externalCashFlows` explícitos;
- aportaciones externas no son rentabilidad;
- benchmarks independientes;
- JSON auditable.

Limitación: survivorship/catalog bias hasta instrument master point-in-time.

---

# 4. OPPORTUNITY / ALLOCATION / CASH FLOWS

Producción: `LEGACY`.

Consumidos:

- QUALITY_V1: información útil, efecto/reach insuficiente;
- SLOPE_V1: no promovido;
- QUALITY_ALLOCATION_BRIDGE_V1: research-only, coeficientes congelados;
- externalCashFlows V1: PASS de causalidad/contabilidad, muestras consumidas.

Hallazgo retenido: el allocator muchas veces no tenía capital nuevo desplegable; el problema no era sólo el ranking.

---

# 5. QUALITY FUTURE FORWARD — FASE 7

`QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1`

Estado:

- 1/12 observaciones;
- 0 outcomes maduros a 2026-09-11;
- producción LEGACY;
- 25 archivos metodológicos congelados;
- estado autoritativo en `replay-results`;
- septiembre ya registrado y no se reescribe.

Próxima ventana válida:

**2026-10-09 22:30–24:00 Europe/Madrid**.

No tocar los 25 archivos congelados para avanzar Fases 2–6.

---

# 6. FORWARD RISK

V8 conserva valor predictivo de downside.

- V9 RETIRED.
- V10 RETIRED.
- V11 RETIRED.
- No V12/V13 como tuning retrospectivo.

Uso futuro sólo bajo protocolo fresh como contexto de riesgo, sizing, ranking/priorización, alertas, stress o margen de seguridad.

---

# 7. HFG — CONSUMIDO / CERRADO

Caso A mostró salida temprana, recuperación posterior y falta de reentrada financiada.

Caso B mostró que Custodia puede mantener un gran ganador; `TREND_PROTECTION_V1` detectó deterioro antes del EXIT económico.

Bug de identidad `DYNAMIC_HFG_DE`:

- corregido en navegador y worker;
- replay REAL confirmó `positionIsDiversifiedCore=false`;
- 6 ejecuciones y economía no cambiaron;
- protección diagnóstica 25%→50% en satélite, sin autoridad ejecutiva.

HFG está consumido y no puede fijar nuevos thresholds.

Hipótesis futuras:

1. reentrada tras salida errónea;
2. protección causal de grandes ganadores.

---

# 8. FASE 2 — USUARIOS, SEGURIDAD Y AUTONOMÍA

## 8.1 Independencia Cubetos/Muros

Cubetos/Muros es sólo referencia técnica.

No se comparten ni unifican:

- Firebase;
- usuarios/UID;
- Firestore;
- perfiles;
- claims/roles;
- planes/entitlements;
- backend/API;
- despliegue/runtime;
- estado privado;
- alarmas;
- repositorios/imports.

## 8.2 Base ya existente en Trading

- Firebase Auth propio;
- `SecureAppGate`;
- verificación server-side de ID token;
- Admin SDK;
- claims `accessGranted` / `isAdmin`;
- Firestore privado por UID;
- deny-by-default;
- aislamiento financiero;
- migración/aislamiento local;
- ADMIN para alta/acceso/bloqueo/roles/reset/borrado;
- persistencia durable de alertas;
- validación multiusuario previa.

## 8.3 Hardening selectivo 2A implementado

Tomado como patrón de referencia, pero reimplementado dentro de Trading:

- audit log administrativo propio;
- búsqueda por correo/nombre/UID;
- `emailVerified` visible;
- confirmaciones de acciones sensibles;
- rollback best-effort de altas parciales;
- actividad administrativa integrada en el panel existente.

No se incorporaron planes, entitlements, créditos, anuncios ni `PermissionContext` genérico.

## 8.4 Smoke real: BUG DE REVOCACIÓN DE ACCESO

El 2026-09-11, después del quick closure PASS, el usuario comprobó que **“Revocar acceso” no funcionaba**.

Clasificación: `BUG`, no investigación ni cambio de política.

Revisión del camino real detectó dos problemas:

1. **ADMIN no-op silencioso:** la UI permitía pulsar “Revocar acceso” sobre una cuenta ADMIN, pero el backend fuerza acceso a cualquier ADMIN. Resultado: la acción parecía ejecutarse pero no cambiaba nada.
2. **Sesión ya abierta:** para un usuario normal el backend revocaba claims/tokens, pero una app ya abierta no revalidaba activamente el estado de acceso y podía seguir mostrando el estado privado ya cargado hasta una nueva comprobación.

Estos problemas preexistían en la arquitectura de usuarios; el hardening 2A los hizo visibles durante el smoke.

## 8.5 Fix implementado — validación runtime pendiente

HEAD funcional del fix antes de esta actualización documental:

`ba1c4d216c9d9af7eab0e558157838a72e8d71c5`

Cambios:

- `server/accountRoutes.ts`
  - revocar acceso a un ADMIN sin retirarle ADMIN devuelve `ADMIN_ACCESS_REQUIRES_DEMOTION_FIRST` en vez de hacer no-op;
  - nuevo endpoint ligero `/session-status`, sin escritura periódica en Firestore, para consultar estado actual de acceso/disabled/ADMIN.
- `src/auth/accountApi.ts`
  - `loadAccountSessionStatus(...)`.
- `src/components/AdminUsersPanel.tsx`
  - un ADMIN muestra acceso `POR ADMIN`;
  - no ofrece botón de revocar acceso mientras mantenga ADMIN;
  - texto explícito: primero retirar ADMIN y después revocar acceso.
- `src/auth/SecureAppGate.tsx`
  - revalida acceso cada 15 s y al volver a foco/visibilidad;
  - si la cuenta está revocada o deshabilitada, limpia estado privado local y cierra la sesión;
  - tokens revocados se tratan como pérdida de acceso, no se deja la cartera renderizada.
- guards existentes ampliados:
  - `tests/privateUserSecurity.unit.ts`;
  - `tests/productSurfaceClosureV1.unit.ts` pasa de 32 a **33 invariantes**.

Revisión del diff desde `3f2a9e42...`:

- sólo auth/ADMIN/tests;
- ningún motor financiero;
- ningún replay;
- ninguna lógica de alertas de trading;
- ningún archivo congelado de Future Forward;
- ninguna dependencia nueva.

**No marcar 2A DONE todavía.**

## 8.6 Validación exacta que toca ahora

Sincronizar la app al HEAD actual y ejecutar una sola vez:

**`Producto · cierre rápido`**

Esperado:

- superficie **33/33 PASS**;
- resto de guards igual que antes;
- TypeScript PASS.

Si pasa, repetir smoke sólo con una **cuenta normal NO-ADMIN**:

1. abrir ADMIN;
2. confirmar que la cuenta normal muestra acceso `CONCEDIDO`;
3. pulsar `Revocar acceso` y aceptar el diálogo;
4. comprobar que cambia a `PENDIENTE`;
5. comprobar que la operación aparece en actividad administrativa;
6. si esa cuenta tiene otra sesión abierta, debe perder acceso al volver a foco o en ≤15 s;
7. volver a conceder acceso y comprobar recuperación;
8. no modificar la cuenta principal.

Para una cuenta ADMIN:

- no debe aparecer la acción de revocar acceso directamente;
- primero se retira ADMIN;
- después se puede revocar acceso.

## 8.7 Fase 2B — alertas/autonomía

Las alarmas ya son operativas para la configuración actual del usuario.

Existe:

- oportunidades de entrada;
- dedupe GOOD_ENTRY/HIGH_CONVICTION;
- Firestore;
- Telegram/webhook;
- `portfolioManagementAlerts.ts`;
- lectura de estado privado;
- `PortfolioPositionHealthService` / `classifyPositionHealth`;
- ADD/WATCH/REDUCE/EXIT.

Pendiente residual sólo si V1 lo necesita:

1. decidir si generalizar a todos los usuarios ACTIVE;
2. mantener dedupe independiente por UID;
3. auditar `PortfolioRotationReviewEngine` / `ROTATE_NOW` para evitar autoridad paralela;
4. añadir guard si se modifica;
5. confirmar que las alarmas actuales siguen funcionando.

No introducir ejecución automática de broker.

---

# 9. FASE 3 — PROTOCOLO ECONÓMICO FINAL

NEXT después de cerrar Fase 2.

Antes de abrir muestras nuevas congelar:

- métricas PASS/FAIL;
- fresh/blind/OOS;
- inventario de muestras consumidas;
- benchmarks comparables;
- costes/fiscalidad;
- materialidad económica;
- reglas de promoción/retirada;
- política antes de ver resultados.

---

# 10. FASES 4–6

## F4 Reentrada

Diseñar sin thresholds derivados de HFG y validar fresh/OOS.

## F5 Grandes ganadores

Diseñar política antes de abrir muestra nueva; HFG no fija un REDUCE productivo.

## F6 Forward Risk V8

Usarlo como información contextual, no como ON/OFF diario ni V12/V13 retrospectivo.

---

# 11. FASE 8 — UNIVERSO HISTÓRICO POINT-IN-TIME

Necesario para reducir survivorship:

- listings;
- delistings;
- cambios de ticker/mercado;
- existencia/disponibilidad por fecha.

Hasta entonces no afirmar reconstrucción completa del mercado histórico.

---

# 12. FASE 9 — CIERRE V1

Criterios:

- cadena productiva única;
- usuarios/seguridad/persistencia estables;
- alertas coherentes con cadena canónica;
- replay causal;
- cash/flujos/costes/fiscalidad;
- evidencia económica bajo protocolo válido;
- survivorship explícito;
- deuda V2 mínima y clasificada.

---

# 13. DEFERRED / RETIRED

No reabrir ahora:

- V9/V10/V11;
- V12/V13 retrospectivo;
- SLOPE_V1;
- QUALITY retrospectivo;
- HFG como muestra de promoción;
- motores/pantallas/replays paralelos;
- jobs específicos por activo;
- retuning Top64/Opportunity con snapshots consumidos;
- reconstruir Firebase/Telegram desde cero;
- compartir sistema con Cubetos/Muros.

V2:

- USD/Nasdaq/NYSE + FX;
- IPO/listings jóvenes;
- fundamentales;
- revisiones de beneficios;
- volumen avanzado;
- taxonomía sectorial;
- instrument master más exhaustivo;
- broker API si se justifica;
- RL/FinRL sólo si aporta valor.

---

# 14. SIGUIENTE SECUENCIA TÉCNICA EXACTA

1. F0 DONE.
2. F1 congelada.
3. F2A reabierta por smoke real; fix de revocación implementado.
4. **No escribir más código de 2A antes de validar este fix.**
5. Ejecutar `Producto · cierre rápido` una vez sobre el HEAD actual.
6. Si falla, corregir la causa exacta; no replay ni Future Forward.
7. Si pasa, repetir smoke de revocación con cuenta normal NO-ADMIN.
8. Si revocación + re-concesión + audit + cierre de sesión abierta funcionan, marcar F2A DONE.
9. Decidir alcance residual de F2B y auditar `ROTATE_NOW` antes de tocar alertas.
10. F3 protocolo económico.
11. F4 reentrada fresh/OOS.
12. F5 ganadores fresh/OOS.
13. F6 Forward Risk V8 contextual.
14. F7 sólo por calendario; próxima ventana 2026-10-09 22:30–24:00 Europe/Madrid.
15. F8 instrument master point-in-time.
16. F9 auditoría end-to-end.
17. F10 deferred.

Al cerrar cada fase actualizar este archivo y `docs/APP_FLOW_AND_ROADMAP.md`.

---

# 15. DOCUMENTOS DE REFERENCIA

- `docs/APP_FLOW_AND_ROADMAP.md`
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/PRIVATE_USERS_DEPLOYMENT.md`
- `docs/TELEGRAM_ALERTS.md`
- `docs/V1_PILOT_DEPLOYMENT.md`
- `docs/DYNAMIC_HISTORICAL_REPLAY.md`
- `docs/dynamic_market_top64_v1_final_outcome.md`
- `docs/replay_explicit_cash_flows_v1_outcome.md`
- `docs/quality_allocation_dynamic_future_forward_v1_preregistration.md`
- `docs/quality_allocation_dynamic_future_forward_v1_status.md`
- `docs/forward_risk_research_state.md`

Referencia externa de diseño, no dependencia:

- `fmaranis/Cubetos-y-balsas-sincronizado`.