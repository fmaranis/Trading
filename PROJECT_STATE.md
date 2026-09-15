# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`.
>
> Al retomar trabajo técnico: comprobar primero el HEAD real de `main`, leer este archivo y después `docs/APP_FLOW_AND_ROADMAP.md`. Si un chat antiguo contradice el repositorio actual, manda el repositorio.

Documentos de entrada:

- `PROJECT_STATE.md` — estado técnico y siguiente paso.
- `PROJECT_SKILLS_POLICY.md` — regla permanente de uso activo de skills/plugins útiles para la app.
- `docs/APP_FLOW_AND_ROADMAP.md` — diagrama maestro y ruta de cierre.
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md` — arquitectura normativa de discovery/Top64.
- `docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md` — protocolo económico común congelado para Fases 4–6.
- `docs/DECISIONS.md` — decisiones durables.

---

# INSTRUCCIONES BASE DE TRABAJO — OBLIGATORIAS

Estas reglas se aplican a todo trabajo futuro de este proyecto y deben tratarse como parte del contexto operativo canónico. El objetivo es entregar resultados **correctos a la primera**, sin errores evitables, sin supuestos ocultos y sin trabajo incompleto.

## 0. Contexto técnico actual

Stack verificado en `package.json` a 2026-09-11:

- TypeScript `~5.8.2`;
- React `^19.0.1` / React DOM `^19.0.1`;
- Vite `^6.2.3`;
- Tailwind CSS `^4.1.14`;
- Express `^4.21.2`;
- Firebase client `12.18.0`;
- Firebase Admin `13.10.0`;
- `tsx` `^4.21.0`;
- Recharts `^3.10.1`;
- Motion `^12.23.24`.

No asumir una versión concreta del runtime Node desplegado si no se ha comprobado en la configuración real de despliegue.

Convenciones y restricciones del proyecto:

- repositorio canónico: `fmaranis/Trading`;
- rama canónica: `main`;
- arquitectura productiva: `CORE_ARCHITECTURE_V1`;
- cambios mínimos e integrados en la arquitectura existente;
- no crear motores, pantallas, jobs o replays paralelos si la capacidad cabe en el flujo existente;
- no añadir dependencias salvo necesidad real y justificada;
- no usar GitHub Actions para replays o validaciones largas;
- validaciones largas se ejecutan en el motor local/backend de la app;
- datos y causalidad deben respetar `REAL / STATIC_REFERENCE / SYNTHETIC` y no-lookahead;
- no tocar ni reinterpretar muestras consumidas como si fueran fresh/OOS;
- no modificar los archivos congelados de una validación prospectiva salvo decisión metodológica explícita;
- Fases 4–6 deben cumplir `docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md` antes de abrir cualquier muestra nueva;
- Cubetos/Muros puede servir como referencia técnica, nunca como dependencia ni plataforma compartida;
- para cada tarea de Trading revisar las skills/plugins disponibles y utilizar todas las que aporten valor material, sin invocarlas mecánicamente ni permitir que sustituyan la arquitectura, causalidad o gobernanza metodológica del proyecto; detalle en `PROJECT_SKILLS_POLICY.md`.

## 1. Entender antes de actuar

Antes de ejecutar una tarea técnica relevante:

- confirmar en 1–2 líneas qué se ha entendido que hay que hacer y cuál es el resultado esperado;
- comprobar primero el estado real de `main` y leer este `PROJECT_STATE.md` cuando la tarea dependa del estado técnico actual;
- si falta información crítica —objetivo real, contexto, versión, formato de salida, criterio de aceptación o fuente de verdad— preguntar **antes** de implementar;
- no inventar datos ni rellenar huecos con suposiciones silenciosas;
- si se detecta un problema fuera del alcance pedido, señalarlo antes de corregirlo, salvo que sea una regresión o error imprescindible para completar correctamente la tarea solicitada.

## 2. Planificar antes de ejecutar

En tareas de varios pasos:

1. presentar primero un plan breve y numerado;
2. ejecutar siguiendo ese plan;
3. si aparece un hallazgo que cambia materialmente alcance, arquitectura, metodología o criterio de aceptación, detener la implementación, explicar el hallazgo y ajustar el plan antes de continuar;
4. no encadenar cambios adicionales sólo porque “ya que estamos” parezcan convenientes.

## 3. Entregables completos

- Entregar soluciones completas y utilizables; no dejar `TODO`, `...`, pseudocódigo incompleto ni piezas pendientes ocultas.
- En código, seguir las convenciones existentes del repositorio y hacer el cambio mínimo que resuelva el problema.
- Manejar errores y casos límite relevantes.
- No añadir dependencias innecesarias.
- No inventar APIs, funciones, comandos, librerías, flags ni contratos de datos.
- Cuando exista duda sobre una API, sintaxis o comportamiento dependiente de versión, verificar en el código real, documentación oficial o mediante una prueba mínima antes de usarlo.
- No declarar una integración terminada sólo porque una función aislada o un unit test pase; verificar el camino real de ejecución cuando el cambio dependa de UI, worker, backend, persistencia, replay o scheduler.

## 4. Verificación obligatoria antes de entregar

Antes de dar una tarea por terminada, revisar y corregir internamente:

1. ¿Responde exactamente a lo pedido, sin ampliar ni recortar alcance sin avisar?
2. ¿Funciona de punta a punta en el flujo real afectado?
3. ¿Se han considerado los casos límite relevantes?
4. ¿Hay errores de sintaxis, tipos, lógica, cálculo, causalidad o supuestos no validados?
5. ¿Cumple todas las restricciones arquitectónicas y metodológicas del proyecto?
6. ¿Se ha comprobado que no se ha roto una capacidad ya validada?
7. ¿Se ha revisado el diff final después de terminar, no sólo mientras se editaba?
8. Si el cambio es relevante, ¿se ha actualizado `PROJECT_STATE.md` y, cuando corresponda, `docs/APP_FLOW_AND_ROADMAP.md`?

Cuando existan guards/tests rápidos aplicables, deben ejecutarse o dejarse preparados antes de pedir una validación larga. Un job largo no debe arrancar si falla un guard previo o `tsc --noEmit`.

## 5. Formato de respuesta

- Ir directo al grano.
- Explicar sólo lo necesario y el porqué de las decisiones importantes.
- Diferenciar claramente hechos verificados, inferencias, hipótesis y trabajo pendiente.
- Al finalizar una tarea técnica, cerrar indicando:
  - **qué se entregó**;
  - **cómo se verificó o cómo debe verificarse**;
  - **qué queda pendiente**, si existe algo realmente pendiente.

## Regla de oro

> Si hay que elegir entre responder rápido o responder bien, responder bien. Ante una ambigüedad importante, preguntar antes de producir un resultado potencialmente equivocado.

Estas instrucciones complementan las reglas específicas de arquitectura, replay, datos, fiscalidad, investigación y validación descritas más abajo. En caso de conflicto, prevalecen las restricciones más específicas del proyecto y el estado real del repositorio.

---

# 0. RUTA DE TRABAJO VIGENTE

Esta es la secuencia canónica de cierre. No abrir una fase posterior por aparecer una idea interesante en una anterior.

```text
FASE 0  MAPA MAESTRO / ESTADO CANÓNICO       ← DONE
FASE 1  BASE PRODUCTIVA V1                    ← DONE salvo bug/regresión reproducible
FASE 2  USUARIOS / SEGURIDAD / AUTONOMÍA      ← DONE · 2A PASS · 2B PASS RUNTIME
FASE 3  PROTOCOLO ECONÓMICO FINAL             ← DONE / FROZEN
FASE 4  REENTRADA TRAS SALIDA ERRÓNEA         ← CLOSED V1 · R2/R3 CONSUMED · INCONCLUSIVE REACH
FASE 5  PROTECCIÓN DE GRANDES GANADORES       ← CLOSED · FIRST BLIND PASS · CONFIRMATION FAIL · NO PROMOTION
FASE 6  FORWARD RISK V8 COMO CONTEXTO         ← STAGE A PREREGISTERED · SAMPLE NOT SELECTED · NOT OPENED
FASE 7  QUALITY FUTURE FORWARD                ← WAITING/COLLECTING en paralelo
FASE 8  UNIVERSO HISTÓRICO POINT-IN-TIME      ← pendiente para evidencia histórica fuerte
FASE 9  AUDITORÍA END-TO-END / CIERRE V1      ← cierre final de los carriles anteriores
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
3. actualizar `PROJECT_STATE.md` y `docs/APP_FLOW_AND_ROADMAP.md` al cerrar una fase o al cambiar materialmente su estado;
4. no crear un nuevo panel, job, replay o motor por cada investigación;
5. no rehacer infraestructura que ya funciona si basta con mejorarla de forma selectiva.

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

Baseline funcional validado antes de la Fase 0 documental:

`a4b15eaf72960aef51f0e9e7691b487f9f46bf51`

Cierre final Fase 2A ejecutado por el usuario el 2026-09-11 sobre `472e7d1f20db3901a4bac1ab5003cb16bfe4d79a`:

- smoke runtime ADMIN: **PASS**;
- revocación y recuperación: **PASS**;
- preservación/restauración de estado privado: **PASS**;
- confirmación interna de acciones ADMIN: **PASS**;
- `Producto · cierre rápido`: **PASS**;
- `Guard usuarios privados`: integrado en el mismo quick closure;
- TypeScript: incluido en el quick closure y **PASS**.

Evidencia automática anterior, mantenida como referencia:

- Guard cierre de superficie: **33/33 PASS**;
- Guard usuarios privados: **PRIVATE_USER_SECURITY_PASS**;
- Guard decisión productiva única: **20/20 PASS**;
- Guard plan de ejecución: **29/29 PASS**;
- Guard cartera: **24/24 PASS**;
- Guard salud de posiciones: **27/27 PASS**;
- Guard disponibilidad broker: **7/7 PASS**;
- Guard fiscalidad de ejecución: **7/7 PASS**.

Después del cierre 2A se aplicó el fix de Fase 2B que elimina la rotación paralela del backend de alertas. El quick closure posterior con el guard de superficie ampliado a **34 invariantes** fue ejecutado por el usuario y terminó **PASS**. La continuidad runtime del backend publicado se confirmó el 2026-09-12 con `rotationStatus:null`, `evaluatedPositions:2` y `error:null`.

Móvil + exportación JSON física: **PASS 2026-09-11**.

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

No repetir septiembre. No tocar los 25 archivos congelados para avanzar Fases 4–6.

---

# 7. FORWARD RISK

Forward Risk V8 conserva valor predictivo de downside.

Interpretación canónica:

- V8 anticipó una parte relevante de futuras caídas;
- las políticas económicas probadas para monetizar esa señal fallaron o destruyeron demasiado upside;
- un FAIL económico no borra la información predictiva.

Estado:

- V8: **PREDICTIVE INFORMATION RETAINED**;
- V9: **RETIRED**;
- V10: **RETIRED**;
- V11: **RETIRED**;
- no crear V12/V13 como parameter chasing retrospectivo.

Hallazgo V11 reutilizable:

- 272 decisiones `ELIGIBLE`;
- sólo 51 coincidieron con Forward Risk >80;
- solapamiento 18,75%;
- aplicar riesgo sólo después de `PortfolioCandidateGate` dejó poco reach incremental.

Uso futuro admisible sólo bajo protocolo fresh: contexto de riesgo, sizing, ranking/priorización, alertas, stress o margen de seguridad.

Fase 6 comienza por separar información de señal de política económica: `FORWARD_RISK_CONTEXT_V1` es shadow-only y no cambia producción.

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

---

# 9. FASE 2 — USUARIOS, SEGURIDAD Y AUTONOMÍA

Estado general:

**DONE / 2A PASS / 2B QUICK CLOSURE PASS / RUNTIME ALERT CONTINUITY PASS.**

Baseline de inicio de Fase 2A:

`d91819a61c1da6e61727122986b19b77ab707c20`

No se debe rehacer Firebase ni reconstruir las alarmas desde cero.

## 9.1 Regla de independencia respecto a Cubetos/Muros

`fmaranis/Cubetos-y-balsas-sincronizado` puede utilizarse **únicamente como referencia técnica de soluciones ya probadas**.

Trading y Cubetos/Muros son aplicaciones completamente independientes.

Está prohibido convertir esta referencia en una plataforma común. En particular **NO se comparten ni se unifican**:

- proyecto Firebase;
- usuarios o UID;
- Firestore/base de datos;
- perfiles;
- custom claims/roles;
- planes o entitlements;
- backend/API;
- despliegue;
- runtime;
- estado privado;
- alarmas;
- repositorios o imports entre aplicaciones.

Si un patrón de Cubetos/Muros es mejor, se **reimplementa/adapta de forma independiente dentro de Trading** y se valida sin romper lo existente.

## 9.2 Trading actual que debe preservarse

Ya existe y funciona:

- Firebase Authentication propio de Trading;
- `SecureAppGate`;
- verificación server-side del Firebase ID token;
- Firebase Admin SDK propio;
- custom claims `accessGranted` / `isAdmin`;
- Firestore privado por UID;
- reglas deny-by-default;
- aislamiento de estado financiero entre usuarios;
- migración/aislamiento de estado local;
- panel ADMIN para alta, acceso, bloqueo, roles, reset y borrado;
- sincronización de cartera, fiscalidad, historial, disponibilidad MyInvestor y demás estado privado;
- persistencia durable del estado de alertas;
- validación manual multiusuario ya realizada.

## 9.3 Comparación diferencial Fase 2A — COMPLETADA

Se revisó el sistema real de Trading contra patrones probados de Cubetos/Muros y se decidió mantener la arquitectura propia. Se incorporaron únicamente auditoría administrativa, búsqueda de usuarios, visibilidad de correo verificado, confirmación de acciones sensibles y rollback best-effort del alta.

No se incorporan planes/entitlements/créditos/anuncios ni un `PermissionContext` genérico sin necesidad productiva.

## 9.4–9.8 Hardening 2A — cierre

Quedó integrado y validado:

- `admin_audit_log` backend-only;
- Auth como autoridad y profile mirror best-effort;
- `resolveManagedUserPatch(...)` para semántica acceso/ADMIN/disabled;
- revocación de refresh tokens cuando corresponde;
- revalidación de sesión abierta cada 15 s y al recuperar foco;
- autosync detenido antes de limpiar caché;
- fallo de red fail-closed sin destrucción de caché;
- lista ADMIN independiente de fallo de audit log;
- confirmaciones internas en `AdminUsersPanel` sin depender de `window.confirm`;
- enlaces de reset visibles aunque clipboard falle;
- `privateUserSecurity.unit.ts` integrado en `Producto · cierre rápido`.

El usuario comprobó runtime real, revocación/recuperación, preservación de estado privado y acciones ADMIN. Quick closure final PASS.

**Estado 2A: DONE.**

## 9.9 Alertas y autonomía — Fase 2B

Las alarmas ya funcionan para la configuración actual.

Se eliminó la autoridad paralela residual de `PortfolioRotationReviewEngine`/`ROTATE_NOW` del backend de alertas. Se preservan `ADD / WATCH / REDUCE / EXIT`, scheduler, Telegram, Firestore, UID configurado y dedupe.

`rotationStatus` permanece en el summary como `null` por compatibilidad. El guard productivo impide reintroducir esa cadena paralela.

Runtime real 2026-09-12:

- `ok:true`;
- `lastError:null`;
- `portfolioManagement.configured:true`;
- `evaluated:true`;
- `evaluatedPositions:2`;
- `pendingEventCount:0`;
- `rotationStatus:null`;
- `notificationSent:false` porque no había evento health nuevo;
- `error:null`.

Multiuser fan-out queda deferred; no bloquea V1.

**Estado 2B: DONE.**

## 9.10 Cierre Fase 2 — DONE

No volver a abrir Fase 2 salvo bug/regresión reproducible.

---

# 10. FASE 3 — PROTOCOLO ECONÓMICO FINAL

Estado: **DONE / FROZEN 2026-09-12.**

Documento canónico:

`docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md`

Antes de abrir nuevas muestras de Fases 4–6 quedan congelados:

- definición `FRESH / BLIND / OUT-OF-SAMPLE`;
- registro de muestras consumidas;
- baseline/control emparejado;
- causalidad y `NEXT_OPEN`;
- benchmarks;
- costes, fiscalidad y cash;
- métricas económicas comunes;
- reach real;
- materialidad;
- estados `PASS_CANDIDATE_FOR_CONFIRMATION / FAIL_RETIRED_AS_TESTED / INCONCLUSIVE`;
- promoción en dos etapas;
- reglas específicas de Fases 4–6.

Materialidad común:

- al menos 60% de casos evaluables favorables;
- mediana favorable;
- mejora mediana superior al mayor de costes incrementales o **0,5% del capital económico expuesto**;
- guardrail de daño.

Un primer PASS no promociona producción: sólo habilita confirmación independiente.

**FASE 3: CERRADA.**

---

# 11. FASE 4 — REENTRADA TRAS SALIDA ERRÓNEA

Estado: **CLOSED FOR V1 / POLICY RESEARCH-ONLY / R2 CONSUMED-INCONCLUSIVE / R3 CONSUMED-INCONCLUSIVE / NO PRODUCTION CHANGE.**

Documentos:

- `docs/phase4_reentry_cash_custody_v1_preregistration.md`;
- `docs/phase4_reentry_cash_custody_v1_r3_preregistration.md`;
- `docs/phase4_reentry_cash_custody_v1_final_outcome.md`.

Política: `EXIT_PROCEEDS_CUSTODY_V1`.

R1: `VOID PRE-OPEN`.

R2: `CONSUMED / INCONCLUSIVE_INVALID_DATA`; el core no obtuvo serie REAL válida, sin comparación económica utilizable.

R3:

- core research-only `DBXW.DE` / `LU0274208692`;
- data start `2006-12-19`;
- replay `2009-01-05 -> 2010-12-31`;
- MONTHLY, 13.000 EUR, MEDIUM;
- cash BCE histórico floor 0;
- sin `externalCashFlows`;
- REAL-only;
- current discovery OFF;
- 252 barras causales mínimas;
- 30 fresh seleccionados desde pool congelado por coverage + SHA-256;
- 6 cohortes de 5.

Ejecución:

- guards/seal/TypeScript PASS;
- preflight core PASS con 256 barras causales;
- scanner 66/66;
- pool 65/65 coverage-eligible;
- data gate 6/6;
- `uniqueExitReservations = 0`;
- `uniqueReentries = 0`;
- veredicto `INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH`.

No es PASS ni FAIL económico; el mecanismo no actuó. R2/R3 están consumidas. No crear R4 para forzar reach ni retunear con estas muestras.

Evidencia durable R3:

`replay-results/validation-runs/research-validation/phase4-reentry-cash-custody-v1-r3.json`

---

# 12. FASE 5 — PROTECCIÓN DE GRANDES GANADORES

Estado: **CLOSED / FIRST BLIND PASS / FIRST SAMPLE CONSUMED / CONFIRMATION CONSUMED FAIL / NO PROMOTION / PRODUCTION LEGACY.**

Documentos:

- `docs/phase5_winner_protection_v2_preopen_design.md`;
- `docs/phase5_winner_protection_v2_final_outcome.md`;
- `docs/phase5_winner_protection_v2_confirmation_preregistration.md`;
- `docs/phase5_winner_protection_v2_confirmation_final_outcome.md`.

Política exacta probada:

`TREND_PROTECTION_V2_WINNER_ONLY`

Parámetros congelados:

- MFE mínimo 8%;
- giveback 6 pp;
- giveback fuerte 8 pp;
- 3 sesiones/observaciones de confirmación + 2 pp de empeoramiento;
- reducción 25% una sola vez por episodio;
- reclaim resetea;
- no actúa sobre core diversificado;
- `REDUCE/EXIT` canónico más fuerte prevalece;
- `PROTECT/WATCH` no son operaciones;
- reach cuenta sólo reducciones F5 ejecutadas `NEXT_OPEN`.

## Primer blind — consumido

Replay `2001-01-03 -> 2003-12-31`, DAILY, 13.000 EUR por cohorte, cartera inicial manual igual ponderada, cash 0, MEDIUM, BCE histórico, sin external flows, current discovery OFF, seis cohortes x tres activos.

Cohortes:

1. `FER.MC / RHM.DE / ENEL.MI`
2. `UCG.MI / OR.PA / ASML.AS`
3. `REP.MC / DTE.DE / SAN.PA`
4. `ENI.MI / SAP.DE / SU.PA`
5. `ADS.DE / BBVA.MC / TTE.PA`
6. `AI.PA / BNP.PA / ISP.MI`

Resultado:

- `PHASE5_OPENED_CONSUMED`;
- `PASS_CANDIDATE_FOR_CONFIRMATION`;
- 18 reducciones ejecutadas;
- reach 6/6 cohortes;
- deltas `-86,75 / -5,70 / +92,16 / +144,76 / +305,84 / +286,16 EUR`;
- 4/6 cohortes positivas;
- mediana +118,46 EUR;
- agregado +736,47 EUR;
- leave-best-out +430,63 EUR;
- guardrails preregistrados PASS.

## Confirmación temporal — consumida / FAIL

La confirmación reutilizó exactamente los mismos 18 activos, las mismas seis cohortes, la misma política, sizing y gates. No hubo reselección por outcomes.

Ventana final pre-open:

- warm-up/data start `2004-01-02`;
- scoring/replay `2005-01-10 -> 2007-12-31`;
- el start se refijó pre-open únicamente por coverage: `REP.MC` tenía 251 barras a 2005-01-03 y 255 a 2005-01-10;
- 252 barras causales mínimas;
- DAILY / MEDIUM / 13.000 EUR;
- NEXT_OPEN;
- cash BCE histórico;
- sin external flows;
- current discovery OFF.

El primer intento se detuvo en TypeScript antes de abrir economía por un nombre de variable; se corrigió y resealó sin cambiar policy, muestra ni gates. La ejecución final pasó guards/TypeScript y abrió el runner económico.

El UI reportó timeout durante la persistencia durable, pero la operación GitHub sí creó la evidencia original antes de que expirara el cliente. El JSON durable recuperado es autoritativo; no se repitió el replay.

Resultado autoritativo:

- `sampleState = PHASE5_CONFIRMATION_OPENED_CONSUMED`;
- `verdict = CONFIRMATION_FAIL_NO_PROMOTION`;
- `productionDefault = LEGACY`;
- 63 reducciones winner-protection ejecutadas;
- reach 6/6 cohortes;
- 2/6 cohortes con delta terminal positivo frente a 4/6 requeridas;
- deltas aprox.: `+667,89 / -272,69 / +277,67 / -1.853,00 / -256,69 / -1.216,59 EUR`;
- mediana terminal aprox. `-264,69 EUR`;
- agregado aprox. `-2.653,41 EUR`;
- leave-best-out aprox. `-3.321,30 EUR`;
- mediana de max drawdown mejoró aprox. `-4,42 pp`;
- peor delta individual aprox. `-1.853 EUR`, por debajo del guardrail -650 EUR.

Interpretación obligatoria:

- hubo reach de sobra; no es `INCONCLUSIVE`;
- la política exacta sí redujo drawdown en mediana, pero no generalizó como mejora de riqueza terminal;
- el FAIL económico no implica que toda información de deterioro carezca de valor;
- `TREND_PROTECTION_V2_WINNER_ONLY` queda **retirada para promoción en la forma probada**;
- no se retunean 8%, 6/8 pp, streak 3, worsening 2 pp ni reducción 25% usando ambas muestras;
- no se crea V3 paramétrica reactiva;
- ambas muestras quedan consumidas;
- producción sigue `LEGACY`.

`ResearchValidationCenter`: el one-shot de confirmación queda `ARCHIVED / READ_ONLY`; el POST de jobs archivados devuelve 409 y no puede relanzarlo.

---

# 13. FASE 6 — FORWARD RISK V8 COMO CONTEXTO

Estado: **STAGE A CONTEXT PREREGISTERED / SAMPLE NOT SELECTED / NOT OPENED / RESEARCH ONLY / PRODUCTION LEGACY.**

Documentos/código:

- `docs/phase6_forward_risk_context_preregistration.md`;
- `src/investment/decision/forwardRiskContextV1.ts`;
- `src/investment/decision/phase6ForwardRiskContextProtocol.ts`;
- `tests/phase6ForwardRiskContextReadiness.unit.ts`;
- `docs/forward_risk_research_state.md`.

## Principio

V8 conserva información predictiva de downside. V9/V10/V11 fallaron como políticas económicas y permanecen retiradas. Fase 6 no crea V12/V13 ni vuelve a un ON/OFF diario.

La primera pregunta de Fase 6 es informativa antes de ser económica:

> ¿Dentro del contexto de decisión que ya recorre `PortfolioCandidateGate`, V8 conserva valor incremental para anticipar downside futuro?

Esto responde al hallazgo V11 de que sólo 51/272 decisiones `ELIGIBLE` (18,75%) coincidieron con riesgo >80; aplicar el overlay sólo después del gate dejó poco reach.

## `FORWARD_RISK_CONTEXT_V1`

Stage A congela únicamente un feature research/shadow:

- score continuo = `max(V5 vulnerabilityScorePct, V7 signalScorePct)`;
- contexto alto = score >=80;
- el 80 es el umbral ya congelado en V8, no uno nuevo;
- no hay pesos/coeficientes ajustados;
- se requieren ambas familias; si falta una, `UNAVAILABLE`;
- no existe fallback sintético ni a una sola rama;
- punto conceptual: shadow en la fecha de decisión de `PortfolioCandidateGate`.

Autoridad Stage A:

- `canChangeEligibility=false`;
- `canChangeRanking=false`;
- `canChangeSizing=false`;
- `canSellOrReduce=false`;
- no waiting/reentry state;
- no direct daily ON/OFF;
- no motor paralelo;
- no cambio productivo.

## Diseño en dos etapas

### Stage A — señal/información

Aún no hay política económica. Primero se validará en una muestra fresh si V8 aporta información incremental dentro del flujo de candidatos.

Muestra actual:

**`NOT_SELECTED_NOT_OPENED`**.

Antes de acceder a market/outcomes se debe congelar y sellar:

- regla de selección fresh/OOS y muestra exacta;
- ventana/warm-up;
- outcomes predictivos exactos;
- reach mínimo;
- gates PASS/FAIL/INCONCLUSIVE;
- datos faltantes;
- runner/fingerprint.

La selección sólo puede usar criterios estructurales y coverage REAL. No usar current Yahoo discovery para reconstrucción histórica ni outcomes/retornos/drawdowns/crisis para elegir muestra.

### Stage B — futura política económica

Sólo si Stage A pasa. La muestra Stage A quedará consumida para el diseño de Stage B y **no puede validar económicamente la policy** que se diseñe con sus resultados. Cualquier policy exacta requerirá otra muestra fresh.

Esto impide repetir el patrón de ajustar una política después de mirar su propio holdout.

## Readiness actual

Job CURRENT:

`Fase 6 · Forward Risk V8 como contexto · readiness`

Ejecuta únicamente:

1. guard de preregistro Fase 6;
2. guard arquitectura core;
3. guard `PortfolioCandidateGate`;
4. paridad replay/producto;
5. superficie productiva;
6. TypeScript.

No consulta mercado, no abre outcomes, no selecciona muestra y no consume Stage A.

Siguiente paso si readiness pasa: congelar la muestra y gates predictivos Stage A; **todavía no ejecutar economía**.

---

# 14. FASE 8 — UNIVERSO HISTÓRICO POINT-IN-TIME

Necesario para reducir survivorship y validar de forma más fuerte la selección histórica de mercado.

Instrument master mínimo:

- listings/altas;
- delistings/bajas;
- cambios de ticker/mercado;
- existencia/disponibilidad por fecha.

Hasta disponer de ello, no afirmar que el replay histórico reconstruye “los mejores del mercado completo” de cada fecha.

---

# 15. FASE 9 — CRITERIO DE CIERRE V1

V1 se considera cerrada integralmente cuando estén suficientemente cerrados:

- cadena productiva única;
- usuarios/seguridad/persistencia independientes y estables;
- alertas coherentes con la cadena compartida;
- replay causal;
- cash/flujos/costes/fiscalidad;
- evaluación económica bajo protocolos válidos;
- limitaciones de survivorship explícitas;
- deuda V2 mínima y clasificada.

La app puede ser técnicamente operativa antes de terminar QUALITY Future Forward, pero QUALITY no puede promocionarse antes de su evidencia prospectiva.

---

# 16. DEFERRED / RETIRED

No reabrir ahora:

- Fase 2 salvo bug/regresión reproducible;
- Fase 4 R2/R3 como muestras fresh;
- `EXIT_PROCEEDS_CUSTODY_V1` para retuning retrospectivo sobre R2/R3;
- Fase 5 blind 2001–2003 ni confirmación 2005–2007 como muestras fresh;
- volver a ejecutar el one-shot Fase 5;
- `TREND_PROTECTION_V2_WINNER_ONLY` para retuning usando cualquiera de sus outcomes;
- cambiar retrospectivamente los 18 activos/cohortes de Fase 5;
- V9/V10/V11;
- V12/V13 como tuning retrospectivo;
- diseñar una policy económica Fase 6 mirando primero outcomes de su propia muestra;
- SLOPE_V1;
- QUALITY_V1 retrospectivo;
- QUALITY bridge sobre ventanas consumidas;
- HFG como muestra de promoción;
- replays/motores/pantallas paralelos;
- jobs específicos por activo;
- retuning de Top64/Opportunity con snapshots observados;
- reconstruir Firebase/usuarios/Telegram desde cero;
- unificar o compartir sistema de usuarios con Cubetos/Muros;
- introducir planes/entitlements/monetización SaaS en Trading sin necesidad productiva explícita;
- generalizar alertas a todos los usuarios sin una necesidad productiva explícita.

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

# 17. SIGUIENTE SECUENCIA TÉCNICA EXACTA

1. **Fase 0: DONE.**
2. **Fase 1: congelada.** No tocar motor productivo salvo bug/regresión reproducible.
3. **Fase 2: DONE.** No reabrir salvo bug/regresión reproducible.
4. **Fase 3: DONE / FROZEN.** `ECONOMIC_VALIDATION_PROTOCOL_V1` gobierna Fases 4–6.
5. **Fase 4: CLOSED FOR V1 / INCONCLUSIVE.** R2/R3 consumidas; no R4 reactiva ni retuning.
6. **Fase 5: CLOSED / CONFIRMATION FAIL / NO PROMOTION.** Primer blind + confirmación consumidos; one-shot archivado; producción `LEGACY`.
7. **Fase 6 Stage A: CONTEXT PREREGISTERED / SAMPLE NOT SELECTED / NOT OPENED.** `FORWARD_RISK_CONTEXT_V1` es shadow-only.
8. Sincronizar `main` y ejecutar únicamente **`Fase 6 · Forward Risk V8 como contexto · readiness`**.
9. El readiness debe pasar preregistro + arquitectura + CandidateGate + paridad + superficie + TypeScript. No consulta mercado/outcomes y no consume muestra.
10. Si readiness pasa, congelar después selección fresh, muestra exacta, ventana, outcomes predictivos, reach, gates y seal Stage A **antes de cualquier market/outcome access**.
11. No diseñar todavía sizing/ranking/hurdle económico. Si Stage A pasa, diseñar la policy con esa evidencia y validarla después en otra muestra fresh independiente.
12. **Fase 7:** QUALITY Future Forward continúa sólo por calendario; próxima ventana válida **2026-10-09 22:30–24:00 Europe/Madrid**.
13. No tocar los 25 archivos congelados de Future Forward para avanzar Fase 6.
14. **Fase 8:** instrument master point-in-time antes de afirmar validación histórica completa sin survivorship.
15. **Fase 9:** auditoría end-to-end y cierre V1.
16. **Fase 10:** permanece deferred hasta cierre V1.

Al cerrar cada fase:

- actualizar `PROJECT_STATE.md`;
- actualizar `docs/APP_FLOW_AND_ROADMAP.md`;
- archivar/retirar lo cerrado;
- no dejar tareas cerradas presentadas como CURRENT.

---

# 18. DOCUMENTOS DE REFERENCIA

- `PROJECT_SKILLS_POLICY.md` — uso permanente de skills/plugins útiles para Trading.
- `docs/APP_FLOW_AND_ROADMAP.md` — mapa maestro y roadmap.
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md` — discovery/Top64 normativo.
- `docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md` — protocolo económico común congelado para Fases 4–6.
- `docs/phase4_reentry_cash_custody_v1_preregistration.md` — preregistro R2.
- `docs/phase4_reentry_cash_custody_v1_r3_preregistration.md` — preregistro/seal R3 consumido.
- `docs/phase4_reentry_cash_custody_v1_final_outcome.md` — cierre Fase 4.
- `docs/phase5_winner_protection_v2_preopen_design.md` — política/muestra/gates del primer blind Fase 5.
- `docs/phase5_winner_protection_v2_final_outcome.md` — primer blind Fase 5.
- `docs/phase5_winner_protection_v2_confirmation_preregistration.md` — confirmación temporal Fase 5.
- `docs/phase5_winner_protection_v2_confirmation_final_outcome.md` — confirmación FAIL y cierre Fase 5.
- `docs/phase6_forward_risk_context_preregistration.md` — preregistro Stage A Fase 6.
- `src/investment/decision/forwardRiskContextV1.ts` — feature shadow Fase 6.
- `src/investment/decision/phase6ForwardRiskContextProtocol.ts` — contrato Stage A pre-sample.
- `tests/phase6ForwardRiskContextReadiness.unit.ts` — guard readiness Fase 6.
- `docs/forward_risk_research_state.md` — estado canónico Forward Risk.
- `validation-runs/preregistration/phase5-winner-protection-v2-seal.json` — seal primer blind Fase 5.
- `replay-results/validation-runs/research-validation/phase5-winner-protection-v2.json` — evidencia durable primer blind Fase 5.
- `docs/DECISIONS.md` — decisiones durables alineadas.
- `docs/PRIVATE_USERS_DEPLOYMENT.md` — seguridad/multiusuario/ADMIN.
- `docs/TELEGRAM_ALERTS.md` — notificaciones.
- `docs/V1_PILOT_DEPLOYMENT.md` — piloto/autonomía.
- `docs/DYNAMIC_HISTORICAL_REPLAY.md` — replay.
- `docs/dynamic_market_top64_v1_final_outcome.md` — cierre Top64.
- `docs/replay_explicit_cash_flows_v1_outcome.md` — flujos externos.
- `docs/quality_allocation_dynamic_future_forward_v1_preregistration.md` — protocolo QUALITY.
- `docs/quality_allocation_dynamic_future_forward_v1_status.md` — estado QUALITY.

Referencia externa de diseño, **no dependencia**:

- `fmaranis/Cubetos-y-balsas-sincronizado` — únicamente para estudiar patrones ya probados que puedan reimplementarse de forma independiente en Trading.
