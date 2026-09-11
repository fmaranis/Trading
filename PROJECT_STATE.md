# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`.
>
> Al retomar trabajo técnico: comprobar primero el HEAD real de `main`, leer este archivo y después `docs/APP_FLOW_AND_ROADMAP.md`. Si un chat antiguo contradice el repositorio actual, manda el repositorio.

Documentos de entrada:

- `PROJECT_STATE.md` — estado técnico y siguiente paso.
- `docs/APP_FLOW_AND_ROADMAP.md` — diagrama maestro y ruta de cierre.
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md` — arquitectura normativa de discovery/Top64.
- `docs/DECISIONS.md` — decisiones durables, ya alineadas con la arquitectura actual.

---

# 0. RUTA DE TRABAJO VIGENTE

Esta es la secuencia que debe seguirse. No abrir una fase posterior por aparecer una idea interesante en una anterior.

```text
FASE 0  MAPA MAESTRO / ESTADO CANÓNICO       ← ACTIVA, pendiente de aceptación del usuario
FASE 1  BASE PRODUCTIVA V1                    ← DONE salvo bug/regresión reproducible
FASE 2  DESPLIEGUE / SEGURIDAD / AUTONOMÍA    ← NEXT, prioridad inmediata
FASE 3  PROTOCOLO ECONÓMICO FINAL             ← después de Fase 2
FASE 4  REENTRADA TRAS SALIDA ERRÓNEA         ← research fresh/blind/OOS
FASE 5  PROTECCIÓN DE GRANDES GANADORES       ← research fresh/blind/OOS
FASE 6  FORWARD RISK V8 COMO CONTEXTO         ← research posterior
FASE 7  QUALITY FUTURE FORWARD                ← WAITING/COLLECTING en paralelo
FASE 8  UNIVERSO HISTÓRICO POINT-IN-TIME      ← pendiente para evidencia histórica fuerte
FASE 9  AUDITORÍA END-TO-END / CIERRE V1      ← cierre de los carriles anteriores
FASE 10 EXPANSIONES V2                        ← DEFERRED
```

Carriles permitidos:

- **Producto/operación:** F0 → F1 → F2 → F9.
- **Evidencia económica:** F3 → F4 → F5 → F6 → F9.
- **Prospectivo por calendario:** F7, sin tocar sus fuentes congeladas.
- **Datos históricos:** F8 → F9.
- **V2:** F10 sólo después de cerrar V1.

Regla de control:

1. clasificar cada hallazgo como `BUG`, `HYPOTHESIS`, `DEFERRED` o `RETIRED`;
2. resolverlo dentro de la arquitectura existente siempre que sea posible;
3. actualizar `PROJECT_STATE.md` y `docs/APP_FLOW_AND_ROADMAP.md` al cerrar una fase;
4. no crear un nuevo panel, job, replay o motor por cada investigación.

---

# 1. ARQUITECTURA PRODUCTIVA — CERRADA

Arquitectura:

`CORE_ARCHITECTURE_V1`

Cadena canónica:

```text
mercado actual REAL
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

Producción mantiene:

- allocation/opportunity: **LEGACY**;
- `CORE_ELIGIBILITY_V2`: shadow;
- Forward Risk: sin autoridad productiva;
- una sola `portfolioDecision` y un solo `executionPlan`;
- cero capital real permanece cero;
- una propuesta teórica suprimida por ejecución/fiscalidad es `REVIEW`, no una orden.

Rutas:

- `/` = superficie canónica de decisión/seguimiento;
- `/portfolio.html` = laboratorio cuantitativo sin autoridad productiva;
- `/legacy.html` = redirección a `/`, no superficie alternativa.

Baseline funcional validado antes de esta Fase 0 documental:

`a4b15eaf72960aef51f0e9e7691b487f9f46bf51`

`Producto · cierre rápido`: **PASS** tras corrección final de identidad dinámica/worker.  
TypeScript: **PASS** en la ejecución reportada por el usuario.  
Móvil + exportación JSON física: **PASS 2026-09-11**.

No repetir el cierre rápido salvo cambio material posterior.

---

# 2. DISCOVERY CURRENT/LIVE — CERRADO

La app no utiliza una whitelist fija de 64 nombres.

`OPEN_MARKET_DISCOVERY_V1` está integrado en `AssetUniverseScanner`.

Top64:

- 64 = máximo/target dinámico;
- `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` = seed/bootstrap/fallback;
- ranking productivo = `MARKET_SHORTLIST_LEGACY_SCORE_V1`;
- discovery/ranking crea candidatos, no autoriza compra;
- diversificación/caps se aplican después en gates/allocation.

Validación REAL final 2026-09-09:

- raw candidates: 180;
- EUR aceptados: 113;
- ETF: 50;
- EQUITY: 63;
- promovidos fuera del seed: 98;
- scanner pool: 162;
- REAL aceptados: 157;
- Top64: 64;
- `OPEN_*` dentro Top64: 29;
- gate LEGACY: 11/11;
- leak elegible fuera de Top64: 0.

Estado: **PASS / ARCHIVED**.

---

# 3. REPLAY HISTÓRICO — INTEGRADO Y CAUSAL

Modos de estado inicial:

- `Desde cero`;
- `manual`;
- `cartera actual`.

Política:

- `Motor Custodia`;
- `mantener cartera`.

Frecuencia:

- `DAILY / WEEKLY / MONTHLY / QUARTERLY` = frecuencia de revisión, no generación de dinero.

Incluye:

- información sólo disponible hasta `decisionDate`;
- ejecución posterior a señal / `NEXT_OPEN` cuando corresponde;
- cash BCE histórico con suelo nominal 0% en el modo correspondiente;
- fiscalidad causal;
- `externalCashFlows` explícitos y fechados;
- aportaciones no contabilizadas como rentabilidad;
- benchmarks independientes;
- JSON auditable.

Limitación vigente:

> Yahoo current discovery no reconstruye el universo histórico. Persiste survivorship/catalog bias hasta disponer de instrument master point-in-time con listings/delistings/cambios de ticker.

---

# 4. EXTERNAL CASH FLOWS — CERRADO / MUESTRAS CONSUMIDAS

Resultado:

`PASS_EXPLICIT_CASH_FLOW_INTEGRATION`

Comprobado:

- la frecuencia no crea aportaciones;
- `stagedCapitalPlan` no es aportación recurrente;
- aportaciones/retiradas son flujos explícitos y causales;
- aportaciones no son rentabilidad;
- benchmark cash no duplica intereses/impuestos;
- cuando hay flujos se usan métricas ajustadas por flujos;
- QUALITY obtuvo más reach cuando hubo capital nuevo, pero la evidencia retrospectiva no justificó promoción.

Producción sigue `LEGACY`.

---

# 5. OPPORTUNITY / ALLOCATION

Estado productivo:

`LEGACY`

Investigaciones consumidas:

- `QUALITY_V1`: información útil, reach/economía insuficientes;
- `SLOPE_V1`: no promovido;
- `QUALITY_ALLOCATION_BRIDGE_V1`: research-only dentro de `PortfolioDecisionEngine`.

Coeficientes del bridge congelados; no retunear usando las ventanas observadas.

Hallazgo estructural retenido:

> el allocator no sólo sufría por ordenación de candidatos; muchas veces no tenía capital nuevo desplegable que repartir.

---

# 6. QUALITY FUTURE FORWARD — FASE 7 EN PARALELO

`QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1`

Estado:

**COLLECTING / 1 DE 12 OBSERVACIONES / 0 OUTCOMES MADUROS / PRODUCTION LEGACY / NO PROMOTION FROM PHASE A**

Primer checkpoint válido:

**2026-09-09 23:37 Europe/Madrid**.

Persistencia autoritativa:

- branch `replay-results`;
- path `validation-runs/quality-allocation-dynamic-future-forward-v1-state.json`;
- 25 archivos metodológicos congelados.

Verificación 2026-09-10:

- `PROSPECTIVE_STATE_VERIFIED_NO_REWRITE`;
- `observationRecordedThisRun = false`;
- septiembre no se reescribió;
- 1/12 observaciones.

Siguiente observación nueva válida:

**2026-10-09 22:30–24:00 Europe/Madrid**.

No repetir septiembre. No tocar los 25 archivos congelados para avanzar Fases 2–6.

---

# 7. FORWARD RISK

Forward Risk V8 conserva valor predictivo de downside.

Interpretación canónica:

- V8 anticipó una parte relevante de futuras caídas;
- las políticas económicas probadas para monetizar esa señal fallaron o destruyeron demasiado upside;
- un FAIL económico no borra la información predictiva.

Estado:

- V9: **RETIRED**;
- V10: **RETIRED**;
- V11: **RETIRED**;
- no crear V12/V13 como parameter chasing retrospectivo.

Uso futuro admisible sólo bajo protocolo fresh: contexto de riesgo, sizing, ranking/priorización, alertas, stress o margen de seguridad.

---

# 8. HFG / GRANDES GANADORES — DIAGNÓSTICO CONSUMIDO Y CERRADO

## Caso A — enero 2019

Configuración diagnóstica:

- 26.000 EUR;
- 13.000 EUR HFG.DE + 13.000 EUR cash;
- MONTHLY;
- Motor Custodia;
- BCE histórico.

Hallazgos:

- salida inicial muy temprana por deterioro estructural fuerte;
- el deterioration streak no causó el EXIT completo;
- HFG recuperó tendencia posteriormente;
- llegó a `ENTRY_READY`, pero no recibió una compra financiada porque el cash desplegable ya no estaba disponible y el core sano mantenía inercia.

## Caso B — HFG dentro durante tendencia sana

Hallazgos:

- Custodia mantuvo HFG durante gran parte del multibagger;
- MFE > +700%;
- `TREND_PROTECTION_V1` vio deterioro antes que la política económica;
- EXIT real en febrero de 2022, aproximadamente 59,20 EUR;
- Custodia terminó claramente por encima de mantener HFG+cash hasta 2023.

## Bug de identidad

Problema:

`DYNAMIC_HFG_DE` aparecía como `positionIsDiversifiedCore=true`.

Corrección final:

- identidad `EQUITY` preservada;
- el Web Worker hidrata identidades dinámicas desde el catálogo del replay;
- acciones `DYNAMIC_*`/`OPEN_*` no heredan core por categoría amplia;
- ETFs dinámicos mantienen tratamiento diversificado.

Replay REAL posterior:

- HFG exporta `positionIsDiversifiedCore=false`;
- las 6 ejecuciones permanecen iguales;
- EXIT continúa 02/02/2022 ~59,20 EUR;
- la protección diagnóstica pasa de 25% a 50% cuando corresponde a satélite, pero no tenía autoridad de ejecución y no cambia la trayectoria económica.

Conclusión:

**BUG CONFIRMADO → CORREGIDO → QUICK CLOSURE PASS → REPLAY REAL PASS.**

HFG queda consumido para promoción. No retunear MFE/giveback/streak/timing/allocation/protección con esta muestra.

Hipótesis abiertas para Fases 4–5:

1. reentrada después de una salida equivocada;
2. monetización causal de protección de grandes ganadores.

---

# 9. USUARIOS PRIVADOS / FIREBASE / ADMIN — FASE 2A

Documento:

`docs/PRIVATE_USERS_DEPLOYMENT.md`

Implementado/documentado:

- Firebase Authentication email/password;
- verificación server-side del Firebase ID token;
- Firebase Admin SDK;
- custom claims `accessGranted` / `isAdmin`;
- Firestore privado por UID;
- reglas deny-by-default;
- migración/aislamiento de estado local;
- panel ADMIN para alta, acceso, bloqueo, roles, reset y borrado;
- sincronización de cartera, fiscalidad, historial, disponibilidad MyInvestor y demás estado privado;
- persistencia durable del estado de alertas;
- validación manual multiusuario ya realizada.

Estado:

**IMPLEMENTADO + MANUAL MULTIUSER PASS, pero no dar publicación V1 por cerrada hasta auditar explícitamente el entorno desplegado.**

Checklist inmediato de Fase 2A:

- Firebase real configurado;
- `FIREBASE_AUTH_REQUIRED=true`;
- reglas Firestore desplegadas;
- ADMIN y usuario normal comprobados;
- test de seguridad + TypeScript PASS;
- usuario normal sin acceso ADMIN;
- ADMIN puede alta/bloqueo/borrado de una cuenta de prueba;
- ADMIN no puede abrir cartera privada ajena desde cliente;
- cambio de UID sin mezcla de estados;
- error de carga privada = fail-closed;
- `/api/alerts/status` = `persistence: FIRESTORE`;
- scheduler persistente probado manualmente.

---

# 10. ALERTAS / AUTONOMÍA — FASE 2B

## Entradas

Ya existe:

- backend de oportunidades;
- dedupe `GOOD_ENTRY / HIGH_CONVICTION`;
- persistencia Firestore cuando Firebase está configurado;
- webhook/Telegram.

## Gestión de cartera

La revisión del HEAD durante Fase 0 confirma que **ya existe** `server/portfolioManagementAlerts.ts` y no debe recrearse.

`runPortfolioManagementAlerts(...)` actualmente:

- resuelve un UID mediante `ALERT_PORTFOLIO_UID` o un único bootstrap admin UID;
- comprueba usuario autorizado/activo;
- lee `users/{uid}/private/state`;
- reconstruye cartera, historial de ejecución, tax lots y cash benchmark;
- reutiliza `PortfolioPositionHealthService` / `classifyPositionHealth`;
- deduplica estado en `users/{uid}/private/portfolioAlertAutomation`;
- puede enviar `ADD / WATCH / REDUCE / EXIT` por Telegram.

Por tanto el estado correcto es:

**PARTIAL / SINGLE-UID IMPLEMENTED**, no “salidas 24/7 no implementadas”.

Pendiente real para Fase 2B:

1. generalizar de un UID configurado a todos los usuarios ACTIVE/autorizados que deban recibir avisos;
2. mantener dedupe independiente por UID;
3. revisar/eliminar autoridad paralela: el backend aún consulta `PortfolioRotationReviewEngine` y puede generar un evento `ROTATE_NOW`, mientras la superficie productiva ya se cerró sobre una única `portfolioDecision`/`executionPlan`;
4. alinear cualquier alerta accionable con la cadena canónica compartida;
5. añadir guard/test específico del flujo backend multiusuario/canónico;
6. verificar scheduler + Firestore + Telegram end-to-end en despliegue real.

No existe ni se debe introducir ahora ejecución automática de órdenes de broker.

---

# 11. FASE 3 — PROTOCOLO ECONÓMICO FINAL

No abrir muestras nuevas antes de congelar documentalmente:

- métricas PASS/FAIL;
- definición fresh/blind/OOS;
- inventario de muestras consumidas;
- benchmarks comparables;
- costes/fiscalidad;
- materialidad económica;
- criterio de promoción/retirada;
- política congelada antes de ver resultados.

Después de Fase 3:

- Fase 4 = reentrada tras salida errónea;
- Fase 5 = protección de grandes ganadores;
- Fase 6 = Forward Risk V8 como contexto.

---

# 12. FASE 8 — UNIVERSO HISTÓRICO POINT-IN-TIME

Necesario para reducir survivorship y validar de forma más fuerte la selección histórica de mercado.

Instrument master mínimo:

- listings/altas;
- delistings/bajas;
- cambios de ticker/mercado;
- existencia/disponibilidad por fecha.

Hasta disponer de ello, no afirmar que el replay histórico reconstruye “los mejores del mercado completo” de cada fecha.

---

# 13. FASE 9 — CRITERIO DE CIERRE V1

V1 se considera cerrada integralmente cuando estén suficientemente cerrados:

- cadena productiva única;
- seguridad/persistencia/despliegue;
- alertas coherentes con la cadena compartida;
- replay causal;
- cash/flujos/costes/fiscalidad;
- evaluación económica bajo protocolos válidos;
- limitaciones de survivorship explícitas;
- deuda V2 mínima y clasificada.

La app puede ser técnicamente operativa antes de terminar QUALITY Future Forward, pero QUALITY no puede promocionarse antes de su evidencia prospectiva.

---

# 14. DEFERRED / RETIRED

No reabrir ahora:

- V9/V10/V11;
- V12/V13 como tuning retrospectivo;
- SLOPE_V1;
- QUALITY_V1 retrospectivo;
- QUALITY bridge sobre ventanas consumidas;
- HFG como muestra de promoción;
- replays/motores/pantallas paralelos;
- jobs específicos por activo;
- retuning de Top64/Opportunity con snapshots observados.

Fase 10 / V2, sólo después de cierre V1:

- USD/Nasdaq/NYSE con FX explícito;
- listings jóvenes/IPO;
- fundamentales;
- revisiones de beneficios;
- volumen avanzado;
- taxonomía sectorial robusta;
- proveedor/instrument master más exhaustivo;
- broker API automática si se justifica;
- RL/FinRL sólo si aporta valor suficiente.

---

# 15. SIGUIENTE SECUENCIA TÉCNICA EXACTA

**Fase 0 queda preparada para revisión del usuario con cambios exclusivamente documentales.** No marcarla DONE hasta su aceptación.

Después de aceptación:

1. Fase 1 queda congelada salvo bug/regresión reproducible.
2. Entrar en **Fase 2A**: auditar el checklist real de Firebase/Firestore/seguridad/despliegue, sin tocar estrategia financiera.
3. Continuar **Fase 2B** sobre `runPortfolioManagementAlerts` existente: multiusuario + dedupe por UID + alineación canónica; no construir otro sistema.
4. Preparar **Fase 3** documentalmente antes de abrir nuevas muestras.
5. No iniciar Fases 4–6 hasta congelar Fase 3.
6. Fase 7 continúa sólo por calendario; próxima ventana válida **2026-10-09 22:30–24:00 Europe/Madrid**.
7. No tocar los 25 archivos congelados de Future Forward para avanzar Fases 2–6.
8. Abordar Fase 8 antes de afirmar validación histórica completa sin survivorship.
9. Fase 10 permanece deferred hasta cierre V1.

Al cerrar cada fase:

- actualizar `PROJECT_STATE.md`;
- actualizar `docs/APP_FLOW_AND_ROADMAP.md`;
- archivar/retirar lo cerrado;
- no dejar tareas cerradas presentadas como CURRENT.

---

# 16. DOCUMENTOS DE REFERENCIA

- `docs/APP_FLOW_AND_ROADMAP.md` — mapa maestro y roadmap.
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md` — discovery/Top64 normativo.
- `docs/DECISIONS.md` — decisiones durables alineadas.
- `docs/PRIVATE_USERS_DEPLOYMENT.md` — seguridad, multiusuario y despliegue.
- `docs/TELEGRAM_ALERTS.md` — canal de notificación.
- `docs/V1_PILOT_DEPLOYMENT.md` — piloto/autonomía.
- `docs/DYNAMIC_HISTORICAL_REPLAY.md` — replay.
- `docs/dynamic_market_top64_v1_final_outcome.md` — cierre Top64.
- `docs/replay_explicit_cash_flows_v1_outcome.md` — flujos externos.
- `docs/quality_allocation_dynamic_future_forward_v1_preregistration.md` — protocolo QUALITY.
- `docs/quality_allocation_dynamic_future_forward_v1_status.md` — estado QUALITY.
- `docs/forward_risk_research_state.md` — estado Forward Risk.