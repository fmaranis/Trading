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
- Cubetos/Muros puede servir como referencia técnica, nunca como dependencia ni plataforma compartida.

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
FASE 2  USUARIOS / SEGURIDAD / AUTONOMÍA      ← ACTIVA · 2A RUNTIME PARCIAL PASS · SESIÓN/ESTADO + QUICK CLOSURE FINAL PENDIENTES
FASE 3  PROTOCOLO ECONÓMICO FINAL             ← NEXT después de cerrar Fase 2
FASE 4  REENTRADA TRAS SALIDA ERRÓNEA         ← research fresh/blind/OOS
FASE 5  PROTECCIÓN DE GRANDES GANADORES       ← research fresh/blind/OOS
FASE 6  FORWARD RISK V8 COMO CONTEXTO         ← research posterior
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

Último quick closure completo anterior al ajuste final de confirmación interna ADMIN, ejecutado por el usuario el 2026-09-11:

- Guard cierre de superficie: **33/33 PASS**;
- Guard usuarios privados: **PRIVATE_USER_SECURITY_PASS**;
- Guard decisión productiva única: **20/20 PASS**;
- Guard plan de ejecución: **29/29 PASS**;
- Guard cartera: **24/24 PASS**;
- Guard salud de posiciones: **27/27 PASS**;
- Guard disponibilidad broker: **7/7 PASS**;
- Guard fiscalidad de ejecución: **7/7 PASS**;
- TypeScript `tsc --noEmit`: **PASS**.

Después de ese PASS se modificó sólo `AdminUsersPanel` y sus dos guards para eliminar la dependencia funcional de `window.confirm`/clipboard. Por ello se hará **un único quick closure final** cuando termine el smoke runtime de 2A; no se repite entre cada paso del smoke.

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

# 9. FASE 2 — USUARIOS, SEGURIDAD Y AUTONOMÍA

Estado general:

**MUY AVANZADA / OPERATIVA EN GRAN PARTE / 2A RUNTIME PARCIAL PASS; PENDIENTES INVALIDACIÓN DE SESIÓN, RESTAURACIÓN DE ESTADO Y QUICK CLOSURE FINAL.**

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

Se revisó el sistema real de Trading contra patrones probados en Cubetos/Muros.

Conclusión:

> Trading ya dispone de una base de identidad/autorización suficiente. No se sustituye `SecureAppGate`, no se migra a un `AuthContext` genérico y no se importan planes/entitlements/monetización de Cubetos/Muros porque actualmente añadirían complejidad sin resolver una necesidad real de Trading.

Patrones seleccionados por aportar valor objetivo:

- auditoría de operaciones administrativas;
- búsqueda de usuarios;
- visibilidad de correo verificado;
- confirmación explícita de acciones administrativas sensibles;
- rollback best-effort para no dejar una cuenta parcial si falla el alta administrada.

Patrones descartados/deferred para Trading actual:

- planes `free/premium/pro/empresa`;
- entitlements genéricos;
- créditos de informes;
- anuncios;
- permisos de PDF/DXF/proyectos;
- `PermissionContext` genérico sin necesidad productiva actual.

## 9.4 Primera implementación 2A y quick closure

Sin añadir dependencias, nueva pantalla, nuevo job ni tocar motor financiero se añadió:

- `admin_audit_log` propio de Trading, escrito sólo por backend/Admin SDK;
- endpoint ADMIN `/admin/audit-log`;
- auditoría de `USER_CREATED`, `USER_UPDATED`, `PASSWORD_RESET_LINK_CREATED`, `USER_DELETED`;
- snapshot before/after de metadatos de cuenta, nunca cartera privada;
- `emailVerified` en la lista administrativa;
- rollback best-effort de Auth user + `users/{uid}` si el alta administrada falla parcialmente;
- búsqueda por correo/nombre/UID;
- confirmaciones de acceso/ADMIN/bloqueo;
- actividad administrativa reciente en el mismo `AdminUsersPanel`;
- guards integrados en el cierre existente.

Decisión de seguridad sobre audit log:

- `firestore.rules` es deny-by-default para colecciones no declaradas;
- `admin_audit_log` no es legible/escribible por clientes;
- sólo backend/Admin SDK lo usa;
- un ADMIN sigue sin endpoint para abrir la cartera privada de otro usuario.

El usuario ejecutó un primer `Producto · cierre rápido` y obtuvo 32/32 + resto de guards + TypeScript PASS, pero el smoke posterior detectó un bug real. Después de la segunda auditoría se incorporó `Guard usuarios privados`; el quick closure actualizado posterior también pasó completo antes del último ajuste de confirmación interna de UI.

## 9.5 Smoke real 2026-09-11 — BUG “REVOCAR ACCESO NO VA”

El usuario comprobó que **“Revocar acceso” no funcionaba**.

Clasificación: `BUG`.

No se considera Fase 2A cerrada por el PASS automático anterior.

Primera revisión del camino real detectó:

1. **ADMIN no-op silencioso.** La UI permitía intentar revocar acceso a una cuenta ADMIN, pero la semántica del backend es que ADMIN implica acceso. La acción podía parecer aceptada sin cambiar el estado efectivo.
2. **Sesión ya abierta sin revalidación activa.** Un usuario normal podía tener claims/tokens revocados, pero la app ya abierta conservaba la cartera renderizada hasta una nueva verificación.

## 9.6 Segunda auditoría completa posterior al bug

A petición expresa del usuario se volvió a revisar de nuevo el flujo completo:

`AdminUsersPanel -> accountApi -> accountRoutes -> Firebase Auth/claims -> token revocation -> SecureAppGate -> local private cache/cloud sync -> quick closure -> documentación`.

La segunda revisión encontró además:

3. **Lista ADMIN acoplada al audit log.** `AdminUsersPanel.refresh()` usaba `Promise.all`. Si fallaba sólo la lectura del audit log, también se descartaba la lista fresca de usuarios. Una revocación efectiva podía seguir viéndose como `CONCEDIDO`, aparentando un no-op.
4. **Riesgo de carrera entre limpieza local y autosync.** La sesión revocada limpiaba `localStorage` sin garantizar primero que el sincronizador privado estuviese parado. Se endureció el orden para impedir que una caché vaciada pueda intentar sustituir el estado durable.
5. **Fallo transitorio de revalidación tratado demasiado agresivamente.** Un error de red/servidor durante la comprobación periódica no debe confundirse con revocación. Ahora la UI falla cerrada, detiene autosync y conserva la caché local; sólo una revocación/disabled confirmada limpia y cierra sesión.
6. **Mutación Auth correcta podía parecer fallida por el espejo Firestore.** Si Firebase Auth ya había aplicado la revocación pero luego fallaba `writeProfile`, el endpoint podía devolver error aunque la autoridad real hubiera cambiado. Ahora Auth es la autoridad de la mutación; el perfil es un mirror best-effort y la respuesta indica `profileSynced`.
7. **`privateUserSecurity.unit.ts` no estaba realmente dentro de `Producto · cierre rápido`.** Se estaba usando como evidencia estática sin que el job que pulsaba el usuario lo ejecutase. Ahora se ha integrado como un paso del mismo job existente; no se creó otro job.
8. **Los guards eran principalmente textuales.** Se añadió una política pura `resolveManagedUserPatch(...)` y aserciones de comportamiento para normal revoke, ADMIN direct revoke, demotion y demotion+revoke.
9. **Error documental propio.** Al registrar el primer fix se compactó demasiado `PROJECT_STATE.md`, eliminando detalle histórico/metodológico útil. Se restauró la memoria canónica completa y los nuevos hallazgos se añaden sin sustituirla por un resumen.

## 9.7 Fix 2A backend/gate vigente

### Backend — `server/accountRoutes.ts`

- `resolveManagedUserPatch(...)` centraliza semántica de acceso/ADMIN/disabled.
- usuario normal + `accessGranted:false` => acceso efectivo false.
- ADMIN + revocación directa sin retirar ADMIN => `ADMIN_ACCESS_REQUIRES_DEMOTION_FIRST`.
- retirar ADMIN sin pedir revocación conserva acceso como usuario normal.
- retirar ADMIN + revocar en la misma mutación deja ambos false.
- `/session-status` devuelve estado real actual de `disabled/isAdmin/accessGranted`.
- revocar acceso, deshabilitar o retirar privilegios relevantes revoca refresh tokens.
- Auth es autoridad del cambio; si falla el mirror de perfil tras una mutación Auth correcta:
  - no se devuelve un falso fallo de la revocación;
  - se registra `ADMIN_USER_PROFILE_SYNC_FAILED`;
  - respuesta `profileSynced:false`;
  - audit metadata registra ese estado.

### Cliente API — `src/auth/accountApi.ts`

- `loadAccountSessionStatus(...)`.
- respuesta de `updateManagedUser(...)` tipada con `ManagedUserUpdateResult`, incluyendo `profileSynced` y `auditLogged`.

### ADMIN — `src/components/AdminUsersPanel.tsx`

- ADMIN muestra acceso `POR ADMIN`.
- no se ofrece botón de revocación directa mientras conserve ADMIN.
- explicación: primero retirar ADMIN y después revocar.
- carga de usuarios y audit log desacoplada mediante `Promise.allSettled`:
  - si audit falla, la lista de usuarios se actualiza igualmente;
  - se muestra un warning separado de auditoría;
  - una lista stale ya no puede ocultar una revocación por culpa del audit log.
- si Auth se actualiza pero el profile mirror falla, el panel lo comunica sin presentar el cambio como inexistente.

### Gate — `src/auth/SecureAppGate.tsx`

- revalida acceso cada 15 s;
- revalida también al recuperar foco/visibilidad;
- una revocación/disabled confirmada:
  - para autosync primero;
  - limpia estado privado local después;
  - cierra sesión;
  - deja de renderizar la cartera.
- un token revocado se trata como pérdida real de acceso.
- un fallo genérico de red/servidor:
  - para autosync;
  - falla cerrado en UI;
  - **no borra** la caché privada local como si fuera una revocación.
- reintentar verificación para autosync antes de rehidratar/rearrancar sincronización, evitando carreras.

### Guards y Centro de validación

- `tests/productSurfaceClosureV1.unit.ts`: 33 invariantes antes del ajuste final de UI; guard actualizado después para la confirmación interna.
- `tests/privateUserSecurity.unit.ts`:
  - invariantes estructurales;
  - aserciones reales de `resolveManagedUserPatch`;
  - stop-sync-before-clear;
  - audit failure independiente de lista;
  - profile mirror best-effort.
- `Producto · cierre rápido` incorpora **`Guard usuarios privados`** ejecutando `tests/privateUserSecurity.unit.ts`.
- no se creó otro job/panel.

## 9.7.1 Tercer hallazgo runtime — botones ADMIN bloqueados por APIs nativas

Después del quick closure actualizado PASS, el usuario comprobó que no sólo `Revocar acceso`, sino **las demás acciones sensibles del ADMIN tampoco respondían**.

Revisión del camino común encontró:

- `revocar/conceder acceso`, `hacer/quitar ADMIN`, `bloquear/reactivar` y `borrar` dependían de `window.confirm(...)`;
- el preview/iframe donde se usa la app puede bloquear ese diálogo nativo;
- en ese caso la acción se corta **antes** de llamar al backend, por lo que todos los botones parecen muertos aunque las rutas API estén correctas;
- los enlaces de contraseña dependían además de `navigator.clipboard`, que también puede estar restringido en previews/iframes.

Corrección en `a22c4de9940d974a32045e2f10adf21731a1f3eb`:

- eliminado `window.confirm` como dependencia funcional;
- confirmación sensible renderizada dentro del propio `AdminUsersPanel`;
- botones `type="button"` explícitos;
- enlaces de configuración/reset visibles en el panel aunque clipboard falle;
- clipboard queda como mejora opcional;
- guards prohíben reintroducir `window.confirm` y exigen confirmación interna/fallback visible.

Evidencia runtime:

- el usuario confirmó que la nueva confirmación interna aparece;
- al utilizar el nuevo botón de confirmación, la acción ADMIN vuelve a funcionar;
- el fallo común de “botones muertos” queda **confirmado y corregido en runtime** para la acción probada.

Revisión de alcance del ajuste final:

- sólo `src/components/AdminUsersPanel.tsx`;
- `tests/privateUserSecurity.unit.ts`;
- `tests/productSurfaceClosureV1.unit.ts`;
- ningún motor financiero;
- ningún replay;
- ninguna lógica de alertas/Telegram;
- ningún archivo congelado de Future Forward;
- ninguna dependencia nueva.

**Estado 2A: RUNTIME PARCIAL PASS. NO DONE todavía.**

## 9.8 Validación exacta restante de Fase 2A

Completar primero el smoke real con una cuenta de prueba **normal, NO-ADMIN y NO-bootstrap**:

1. revocar acceso y confirmar que la lista pasa a `PENDIENTE`;
2. si esa cuenta tiene otra sesión abierta, volver a esa ventana: debe perder acceso al recuperar foco o en ≤15 s;
3. confirmar que el estado durable/Firestore del usuario no se ha borrado;
4. volver a conceder acceso;
5. debido a la revocación de refresh tokens, la recuperación normal puede requerir **volver a iniciar sesión**;
6. confirmar que recupera exactamente su propio estado privado;
7. confirmar que la cartera del usuario principal sigue intacta;
8. comprobar de forma mínima que `ADMIN` y `bloquear/reactivar` usan la misma confirmación interna y responden; no hace falta borrar una cuenta para demostrar el flujo común.

Después del smoke, ejecutar **una sola vez `Producto · cierre rápido`** sobre el HEAD final de 2A.

Esperado:

- Guard cierre de superficie: PASS;
- Guard usuarios privados: `PRIVATE_USER_SECURITY_PASS`;
- decisión productiva única: PASS;
- plan de ejecución: PASS;
- cartera: PASS;
- salud de posiciones: PASS;
- broker: PASS;
- fiscalidad: PASS;
- TypeScript: PASS.

No ejecutar replay largo ni Future Forward.

Si smoke + quick closure final pasan, **Fase 2A = DONE**.

## 9.9 Alertas y autonomía — Fase 2B

Las alarmas **ya están funcionando en operación real para la configuración actual del usuario**. No tratarlas como funcionalidad por construir desde cero.

Ya existe:

- backend de oportunidades de entrada;
- dedupe `GOOD_ENTRY / HIGH_CONVICTION`;
- persistencia Firestore;
- webhook/Telegram;
- `server/portfolioManagementAlerts.ts`;
- lectura de `users/{uid}/private/state`;
- reconstrucción de cartera, historial de ejecución, tax lots y cash benchmark;
- reutilización de `PortfolioPositionHealthService` / `classifyPositionHealth`;
- dedupe por UID;
- capacidad de enviar `ADD / WATCH / REDUCE / EXIT` por Telegram.

Estado correcto:

**OPERATIVO PARA LA CONFIGURACIÓN ACTUAL / CIERRE RESIDUAL SEGÚN ALCANCE V1.**

Pendiente real, antes de tocar código:

1. decidir si V1 necesita alertas para todos los usuarios ACTIVE/autorizados o basta el alcance actual;
2. si se generaliza, mantener dedupe independiente por UID;
3. auditar el uso residual de `PortfolioRotationReviewEngine`/`ROTATE_NOW`: no debe adquirir autoridad paralela a `portfolioDecision`/`executionPlan`;
4. modificar este flujo sólo después de decidir alcance y con guard específico;
5. verificar que las alarmas actuales siguen llegando tras cualquier cambio.

No existe ni se debe introducir ahora ejecución automática de órdenes de broker.

Criterio de cierre Fase 2:

- sistema de usuarios de Trading sigue independiente;
- 2A pasa smoke manual real + quick closure final;
- login/ADMIN/Firestore/aislamiento/cartera siguen funcionando;
- alarmas actuales siguen funcionando;
- se decide y documenta el alcance V1 de 2B;
- no aparece una segunda cadena de decisión.

---

# 10. FASE 3 — PROTOCOLO ECONÓMICO FINAL

Estado: **NEXT después de cerrar Fase 2.**

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

# 11. FASE 4 — REENTRADA TRAS SALIDA ERRÓNEA

HFG sólo aporta diagnóstico consumido: `EXIT temprano → recuperación → oportunidad posterior → timing/capital pueden impedir reentrada`.

Objetivo fresh/OOS:

- separar fallo de señal de salida;
- latencia de timing;
- falta de capital desplegable;
- healthy-incumbent inertia;
- diseñar hipótesis general sin thresholds derivados de HFG;
- congelarla antes de abrir resultados.

---

# 12. FASE 5 — PROTECCIÓN DE GRANDES GANADORES

HFG mostró que `TREND_PROTECTION_V1` detectó deterioro antes del EXIT económico, pero la muestra está consumida.

No convertir retrospectivamente el `REDUCE 50%` observado en HFG en política productiva.

Diseñar previamente una política de monetización, separar detección de ejecución y validar fresh/OOS.

---

# 13. FASE 6 — FORWARD RISK V8 COMO CONTEXTO

V8 mantiene información predictiva de downside.

Investigar sólo bajo protocolo nuevo usos como:

- contexto de riesgo;
- sizing;
- ranking/priorización;
- alertas;
- stress;
- margen de seguridad.

No volver a un ON/OFF diario directo ni crear V12/V13 por tuning retrospectivo.

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

- V9/V10/V11;
- V12/V13 como tuning retrospectivo;
- SLOPE_V1;
- QUALITY_V1 retrospectivo;
- QUALITY bridge sobre ventanas consumidas;
- HFG como muestra de promoción;
- replays/motores/pantallas paralelos;
- jobs específicos por activo;
- retuning de Top64/Opportunity con snapshots observados;
- reconstruir Firebase/usuarios/Telegram desde cero;
- unificar o compartir sistema de usuarios con Cubetos/Muros;
- introducir planes/entitlements/monetización SaaS en Trading sin necesidad productiva explícita.

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
3. **Fase 2A: runtime parcial PASS.** El fallo común de botones ADMIN quedó corregido con confirmación interna en `a22c4de...`.
4. Completar el smoke de §9.8: invalidación de sesión abierta, preservación/restauración de estado y cartera principal intacta.
5. Si el smoke pasa, ejecutar **una sola vez `Producto · cierre rápido`** sobre el HEAD final de 2A.
6. Si falla, corregir la causa exacta. No lanzar replay ni Future Forward.
7. Si smoke + quick closure pasan, marcar **Fase 2A DONE** y actualizar este archivo/roadmap.
8. Antes de modificar alertas, decidir explícitamente el alcance **Fase 2B**: configuración actual versus generalización multiusuario, y auditar `ROTATE_NOW`/autoridad canónica.
9. **Fase 3:** congelar protocolo económico antes de abrir nuevas muestras.
10. **Fase 4:** reentrada fresh/OOS.
11. **Fase 5:** protección de ganadores fresh/OOS.
12. **Fase 6:** Forward Risk V8 como contexto bajo protocolo nuevo.
13. **Fase 7:** QUALITY Future Forward continúa sólo por calendario; próxima ventana válida **2026-10-09 22:30–24:00 Europe/Madrid**.
14. No tocar los 25 archivos congelados de Future Forward para avanzar Fases 2–6.
15. **Fase 8:** instrument master point-in-time antes de afirmar validación histórica completa sin survivorship.
16. **Fase 9:** auditoría end-to-end y cierre V1.
17. **Fase 10:** permanece deferred hasta cierre V1.

Al cerrar cada fase:

- actualizar `PROJECT_STATE.md`;
- actualizar `docs/APP_FLOW_AND_ROADMAP.md`;
- archivar/retirar lo cerrado;
- no dejar tareas cerradas presentadas como CURRENT.

---

# 18. DOCUMENTOS DE REFERENCIA

- `docs/APP_FLOW_AND_ROADMAP.md` — mapa maestro y roadmap.
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md` — discovery/Top64 normativo.
- `docs/DECISIONS.md` — decisiones durables alineadas.
- `docs/PRIVATE_USERS_DEPLOYMENT.md` — seguridad, multiusuario, ADMIN y validación Fase 2A de Trading.
- `docs/TELEGRAM_ALERTS.md` — canal de notificación de Trading.
- `docs/V1_PILOT_DEPLOYMENT.md` — piloto/autonomía.
- `docs/DYNAMIC_HISTORICAL_REPLAY.md` — replay.
- `docs/dynamic_market_top64_v1_final_outcome.md` — cierre Top64.
- `docs/replay_explicit_cash_flows_v1_outcome.md` — flujos externos.
- `docs/quality_allocation_dynamic_future_forward_v1_preregistration.md` — protocolo QUALITY.
- `docs/quality_allocation_dynamic_future_forward_v1_status.md` — estado QUALITY.
- `docs/forward_risk_research_state.md` — estado Forward Risk.

Referencia externa de diseño, **no dependencia**:

- `fmaranis/Cubetos-y-balsas-sincronizado` — únicamente para estudiar patrones ya probados que puedan reimplementarse de forma independiente en Trading.