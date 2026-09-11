# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`.
>
> Al retomar trabajo técnico: comprobar primero el HEAD real de `main`, leer este archivo y después `docs/APP_FLOW_AND_ROADMAP.md`. Si un chat antiguo contradice el repositorio actual, manda el repositorio.

Documento maestro de flujo y cierre:

`docs/APP_FLOW_AND_ROADMAP.md`

Documento normativo de selección dinámica:

`docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`

---

# 0. RUTA ACTIVA DEL PROYECTO

La ruta de trabajo queda congelada así hasta decisión explícita del usuario:

```text
FASE 0  MAPA MAESTRO Y ESTADO CANÓNICO        ← ACTIVA / cierre documental actual
FASE 1  BASE PRODUCTIVA V1                    ← DONE salvo regresión material
FASE 2  DESPLIEGUE / SEGURIDAD / AUTONOMÍA    ← NEXT, prioridad muy alta
FASE 3  PROTOCOLO ECONÓMICO FINAL             ← NEXT después de Fase 2
FASE 4  REENTRADA TRAS SALIDA ERRÓNEA         ← research fresh/OOS
FASE 5  PROTECCIÓN DE GRANDES GANADORES       ← research fresh/OOS
FASE 6  FORWARD RISK V8 COMO CONTEXTO         ← research posterior
FASE 7  QUALITY FUTURE FORWARD                ← WAITING/COLLECTING en paralelo
FASE 8  UNIVERSO HISTÓRICO POINT-IN-TIME      ← pendiente para validación definitiva
FASE 9  AUDITORÍA END-TO-END / CIERRE V1      ← final de los carriles anteriores
FASE 10 EXPANSIONES V2                        ← DEFERRED
```

Regla de control:

- no se abre la fase siguiente por aparecer una idea interesante;
- primero se clasifica el hallazgo como `BUG`, `HYPOTHESIS`, `DEFERRED` o `RETIRED`;
- se actualiza este archivo y el roadmap;
- no se crea un nuevo motor/pantalla/job si la capacidad cabe en el flujo existente.

Carriles paralelos permitidos:

- **Producto/operación:** F0 → F1 → F2 → F9.
- **Evidencia económica:** F3 → F4 → F5 → F6 → F9.
- **Prospectivo por calendario:** F7, sin tocar sus fuentes congeladas.
- **Datos históricos:** F8 → F9.
- **V2:** F10 sólo después del cierre V1.

---

# 1. Invariante principal de producto

La aplicación **NO** invierte dentro de una whitelist fija de 64 nombres.

Objetivo:

> buscar dinámicamente el mercado actual, identificar candidatos atractivos y fiables, formar una shortlist dinámica de hasta 64 candidatos y decidir después si merece la pena entrar, mantener, reducir, salir o no hacer nada, cuánto asignar y por qué.

Cadena canónica productiva:

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

La pregunta de producto se divide en:

1. **DÓNDE** — discovery y ranking current/live;
2. **CUÁNDO** — gates, consenso y timing;
3. **CUÁNTO** — portfolio decision y allocation;
4. **POR QUÉ / CÓMO** — evidencia, plan ejecutable, costes, broker, fiscalidad y seguimiento.

---

# 2. Reglas no negociables

- Arquitectura productiva: `CORE_ARCHITECTURE_V1`.
- Una sola cadena de decisión coherente entre scanner, selección, decisión, allocation, replay y seguimiento.
- Producción mantiene `LEGACY` hasta evidencia fresh suficiente.
- `CORE_ELIGIBILITY_V2` permanece shadow.
- Forward Risk no modifica producción actualmente.
- Nunca usar GitHub Actions para replays o validaciones largas.
- Los cálculos largos los ejecuta el motor local/backend de la app.
- Guards/unit tests/TypeScript deben pasar antes de cálculo largo.
- Procedencia: `REAL / STATIC_REFERENCE / SYNTHETIC`.
- Una validación REAL falla si aparece información sintética.
- Replay causal y ejecución posterior a señal; `NEXT_OPEN` cuando corresponde.
- `DAILY/WEEKLY/MONTHLY/QUARTERLY` = frecuencia de revisión, nunca creación automática de dinero.
- `stagedCapitalPlan` = capital ya disponible.
- Aportaciones/retiradas = `externalCashFlows` explícitos y fechados.
- Aportaciones externas no son rentabilidad.
- Benchmarks no inventan flujos que no puedan recibir.
- No retunear thresholds/coeficientes/confirmaciones después de observar la misma muestra.
- Muestra utilizada para diseñar o interpretar política = consumida para promoción.
- Promoción requiere política congelada + evidencia fresh/blind/OOS.
- No crear motores, pantallas o módulos paralelos inconexos.
- Ningún dato financiero privado del usuario se embebe en código público.
- El usuario no dispone de terminal operativo; no pedir ejecución manual de comandos.

---

# 3. Motor productivo vigente — FASE 1 CERRADA

Arquitectura:

`CORE_ARCHITECTURE_V1`

Producción:

- allocation/opportunity: **LEGACY**;
- `CORE_ELIGIBILITY_V2`: shadow;
- Forward Risk: research only;
- replay causal / `NEXT_OPEN`;
- modos de estado inicial: `Desde cero / manual / cartera actual`;
- modos de política: `Motor Custodia / mantener cartera`;
- cash BCE histórico y fiscalidad causalmente integrados.

Entrada productiva de cartera:

`evaluatePortfolioDecision(...)`

Cadena:

`PortfolioDecisionEngine.evaluate -> applyCoreGateV1 -> applyCoreArchitectureV1`.

La UI construye después un único plan:

`buildPortfolioExecutionPlan -> applyTaxAwareExecutionOverlay`.

Un plan puede convertirse en `REVIEW` por títulos enteros, cash, broker, costes, datos o fiscalidad, pero no se vuelve a seleccionar activos aguas abajo.

---

# 4. Superficie productiva y cierre técnico

Ruta web normal:

`index.html -> src/decisionMain.tsx -> InteractiveInvestmentDecisionCenter + ResearchValidationCenter`

Estado:

- `/legacy.html` no es una superficie accionable alternativa; redirige a `/`;
- `/portfolio.html` queda como laboratorio cuantitativo sin autoridad productiva;
- una sola superficie emite la decisión accionable;
- `MarketUtilityDashboard` calcula una sola `portfolioDecision`;
- el mismo dashboard crea un solo `executionPlan`;
- `CurrentOpportunityAlertsPanel`, registro de compra y panel de ejecución consumen esos mismos objetos;
- las propuestas teóricas suprimidas por ejecución/fiscalidad son `REVIEW`, no órdenes;
- capital desplegable real 0 EUR permanece 0 EUR;
- la app bloquea la decisión operativa hasta finalizar salud de posiciones;
- `DecisionGuardrailsPanel` no lanza replay paralelo.

Validación:

- `Producto · cierre rápido`: **PASS** tras las correcciones de identidad dinámica y worker;
- TypeScript: **PASS** en la ejecución reportada por el usuario;
- móvil físico: **PASS** el 2026-09-11;
- exportación JSON móvil: **PASS**.

Baseline funcional validado antes de los commits documentales de Fase 0:

`a4b15eaf72960aef51f0e9e7691b487f9f46bf51`

No repetir `Producto · cierre rápido` salvo cambio material posterior.

---

# 5. Datos y discovery current/live

`OPEN_MARKET_DISCOVERY_V1` está integrado en `AssetUniverseScanner`.

Top64:

- 64 = máximo/target dinámico, no nombres permanentes;
- `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` = seed/bootstrap/fallback;
- ranking productivo: `MARKET_SHORTLIST_LEGACY_SCORE_V1`;
- Top64 no autoriza compra;
- `PortfolioCandidateGate`, cash hurdle, consenso, timing y allocation conservan autoridad.

Run current/live final 2026-09-09:

- raw candidates: 180;
- EUR aceptados: 113;
- ETF: 50;
- EQUITY: 63;
- promovidos fuera del seed: 98;
- scanner pool: 162;
- REAL aceptados: 157;
- Top64: 64;
- `OPEN_*` en Top64: 29;
- gate LEGACY: 11/11;
- leak elegible fuera de Top64: 0.

Estado: **CERRADO / PASS**.

Limitación: Yahoo current discovery no es un instrument master exhaustivo ni puede reconstruir retrospectivamente el mercado histórico.

---

# 6. Replay histórico

El replay utiliza la misma arquitectura conceptual, no un motor alternativo.

Modos integrados:

- estado inicial: `Desde cero / manual / cartera actual`;
- política: `Motor Custodia / mantener cartera`;
- frecuencia: `DAILY / WEEKLY / MONTHLY / QUARTERLY`.

Incluye:

- causalidad por `decisionDate`;
- ejecución después de señal;
- cash histórico BCE con suelo nominal 0% cuando corresponde;
- fiscalidad del portfolio y del cash;
- `externalCashFlows` explícitos;
- métricas ajustadas por flujos;
- benchmarks independientes;
- JSON auditable.

Limitación vigente:

- survivorship/catalog bias mientras no exista instrument master histórico point-in-time.

---

# 7. External cash flows — CERRADO

Resultado:

`PASS_EXPLICIT_CASH_FLOW_INTEGRATION`

Comprobado:

- `MONTHLY` no crea aportaciones;
- `externalCashFlows` son explícitos y causales;
- aportaciones no cuentan como rentabilidad;
- benchmark cash recibe los mismos flujos mediante contabilidad independiente;
- no se duplica interés/fiscalidad;
- retirada inicial implementada como `CASH_ONLY`, fallando explícitamente si no hay cash suficiente;
- QUALITY alcanzó más planes cuando hubo capital nuevo, pero el efecto económico retrospectivo siguió siendo insuficiente para promoción.

Muestras de esta investigación: consumidas para promoción.

---

# 8. Opportunity / allocation

Producción continúa:

`LEGACY`

Historial:

- `QUALITY_V1`: información útil, efecto/reach insuficiente;
- `SLOPE_V1`: no justificó promoción;
- `QUALITY_ALLOCATION_BRIDGE_V1`: research-only, integrado dentro de `PortfolioDecisionEngine`, no motor paralelo.

Fórmula congelada del bridge:

`candidateQualityAdjustment = (reliability - 50)*0.10 + (opportunity - 50)*0.20`

`qualityMultiplier = clamp(1 + adjustment/100, 0.85, 1.15)`

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`

No retunear esos coeficientes usando las ventanas ya observadas.

Hallazgo estructural importante:

> el cuello de botella no era sólo ordenar candidatos; el allocator disponía de poco capital nuevo que repartir.

---

# 9. QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 — EN PARALELO

Estado:

**COLLECTING / 1 DE 12 OBSERVACIONES / 0 OUTCOMES MADUROS / PRODUCTION LEGACY / NO PROMOTION FROM PHASE A**

Primer checkpoint válido:

**2026-09-09 23:37 Europe/Madrid**.

Persistencia autoritativa:

- branch `replay-results`;
- path `validation-runs/quality-allocation-dynamic-future-forward-v1-state.json`;
- 25 archivos metodológicos congelados.

La comprobación del 2026-09-10 terminó:

- `PROSPECTIVE_STATE_VERIFIED_NO_REWRITE`;
- `observationRecordedThisRun = false`;
- `ALREADY_RECORDED`;
- 1/12 observaciones;
- sin reescribir septiembre.

Siguiente observación nueva válida:

**2026-10-09 22:30–24:00 Europe/Madrid**.

No repetir septiembre. No tocar los 25 archivos congelados para avanzar otras fases.

---

# 10. Forward Risk

Forward Risk V8 conserva valor predictivo de downside.

Hallazgo histórico retenido:

- anticipó una parte importante de episodios de caída;
- la señal estaba fragmentada;
- el uso directo ON/OFF destruyó demasiado upside.

Políticas económicas:

- V9: RETIRED;
- V10: RETIRED;
- V11: RETIRED.

Interpretación correcta:

`signal quality != economic policy quality`.

No crear V12/V13 como parameter chasing.

Uso futuro sólo bajo protocolo nuevo como contexto de riesgo, sizing, ranking, alertas, stress o priorización.

---

# 11. HFG / grandes ganadores — DIAGNÓSTICO CONSUMIDO Y CERRADO

## Caso A — inicio 2019-01-01

Configuración:

- 26.000 EUR;
- 13.000 EUR HFG.DE + 13.000 EUR cash;
- MONTHLY;
- Motor Custodia;
- BCE histórico.

Hallazgos:

- salida muy temprana por deterioro estructural fuerte;
- el streak no causó el EXIT completo;
- HFG recuperó tendencia y más tarde llegó a `ENTRY_READY`;
- no hubo reentrada financiada porque el cash disponible era insuficiente y el core sano absorbía capital;
- separa señal de salida, latencia de reentrada y reach del allocator.

## Caso B — HFG dentro durante tendencia sana

Hallazgos:

- Custodia mantuvo HFG durante gran parte del multibagger;
- MFE aproximado > +700%;
- `TREND_PROTECTION_V1` detectó deterioro antes que la política ejecutiva;
- EXIT económico real llegó en febrero de 2022, aproximadamente a 59,20 EUR;
- Custodia terminó claramente por encima de mantener HFG+cash hasta 2023.

## Bug de identidad dinámica

Se detectó `positionIsDiversifiedCore=true` para `DYNAMIC_HFG_DE`.

Primer arreglo cubrió el navegador pero no el replay real porque el Web Worker no tenía el registro local.

Corrección final:

- el worker hidrata identidades dinámicas desde el catálogo del propio replay;
- acciones `DYNAMIC_*`/`OPEN_*` no heredan protección de core por una categoría amplia;
- ETFs dinámicos conservan tratamiento diversificado cuando procede.

Verificación final con replay REAL:

- HFG exporta `positionIsDiversifiedCore=false` mientras está en cartera;
- no cambia ninguna de las 6 ejecuciones;
- EXIT sigue en 02/02/2022 a ~59,20 EUR;
- la diferencia observable está en la protección diagnóstica: al ser satélite, `TREND_PROTECTION_V1` propone 50% en lugar de 25% en episodios correspondientes;
- esa protección no tenía autoridad ejecutiva, por lo que no cambia la trayectoria económica del replay.

Conclusión:

**BUG CONFIRMADO → CORREGIDO → QUICK CLOSURE PASS → REPLAY REAL PASS.**

La muestra HFG está consumida. No utilizarla para fijar nuevos thresholds de MFE/giveback/streak/timing/allocation/protección.

Hipótesis que deja abiertas, para muestras fresh posteriores:

1. reentrada después de una salida errónea;
2. monetización causal de protección de grandes ganadores.

---

# 12. Usuarios privados, administrador y persistencia — FASE 2

Documento:

`docs/PRIVATE_USERS_DEPLOYMENT.md`

Implementado/documentado:

- Firebase Authentication email/password;
- Cloud Run/Express verifica Firebase ID token;
- Firebase Admin SDK para administración;
- custom claims `accessGranted` / `isAdmin`;
- Firestore privado por UID;
- reglas deny-by-default;
- caché local aislada por propietario;
- migración segura del estado histórico local;
- panel ADMIN para alta, acceso, bloqueo, roles, reset y borrado;
- un admin no puede leer la cartera de otro usuario desde la UI cliente;
- persistencia durable de estado de alertas en Firestore;
- validación manual multiusuario ya realizada.

Estado:

**IMPLEMENTADO + MANUAL MULTIUSER PASS, pero el checklist de publicación debe cerrarse explícitamente en el entorno desplegado antes de considerar V1 operativa/publicable.**

Checklist prioritario de Fase 2A:

- Firebase configurado en producción;
- `FIREBASE_AUTH_REQUIRED=true`;
- primer ADMIN comprobado;
- reglas Firestore desplegadas;
- test de seguridad + TypeScript PASS;
- usuario normal sin ADMIN;
- ADMIN puede alta/bloqueo/borrado de prueba;
- aislamiento de carteras;
- error de carga privada = fail-closed;
- `/api/alerts/status` con `persistence: FIRESTORE`;
- scheduler persistente probado manualmente.

---

# 13. Alertas y autonomía — FASE 2

Entradas:

- backend de oportunidades existente;
- deduplicado de `GOOD_ENTRY / HIGH_CONVICTION`;
- estado durable en Firestore cuando Firebase está configurado;
- webhook/Telegram documentado.

Regla de dedupe:

- nuevo GOOD_ENTRY;
- escalada a HIGH_CONVICTION;
- reaparición después de dejar de ser accionable;
- fallo de entrega no marca el evento como entregado.

Pendiente de cierre operativo:

- verificar canal de entrada end-to-end en despliegue persistente;
- completar autonomía `WATCH / REDUCE / EXIT` con la app cerrada.

Para salidas 24/7 el backend debe:

1. enumerar sólo usuarios `ACTIVE`;
2. leer su estado privado por UID;
3. reconstruir cartera/contexto;
4. ejecutar el MISMO clasificador de salud con datos REAL;
5. guardar dedupe por UID;
6. enviar sólo eventos nuevos.

No se crea una segunda lógica de trading backend.

No existe ejecución automática en broker. La ejecución sigue siendo manual/asistida.

---

# 14. Limitaciones y deuda que NO bloquean la Fase 2 inmediata

- Yahoo current discovery no elimina survivorship histórico.
- Taxonomía sectorial de algunos `OPEN_*` todavía es limitada.
- No existe instrument master point-in-time.
- No existe broker API de ejecución automática.
- No existe expansión USD/Nasdaq/NYSE con FX explícito.
- Listings jóvenes/IPO/fundamentales/revisiones de beneficios/volumen avanzado están deferred.
- RL/FinRL permanece deferred.

---

# 15. Fases de investigación económica después del cierre operativo

## FASE 3 — protocolo económico final

Antes de abrir muestras nuevas:

- métricas PASS/FAIL;
- definición fresh/blind/OOS;
- registro de muestras consumidas;
- benchmarks comparables;
- costes/fiscalidad;
- criterios de materialidad;
- política congelada antes del resultado.

## FASE 4 — reentrada

Hipótesis general a diseñar sin derivar thresholds de HFG.

Debe distinguir:

- error de señal de salida;
- latencia de timing;
- ausencia de capital desplegable;
- healthy-incumbent inertia.

Promoción sólo con evidencia fresh/OOS.

## FASE 5 — protección de ganadores

No convertir el `REDUCE 50%` observado en HFG en política.

Diseñar primero la política, separar detección de ejecución y abrir después la muestra fresh.

## FASE 6 — Forward Risk V8

Sólo como feature contextual bajo protocolo nuevo, no ON/OFF diario directo.

---

# 16. FASE 8 — universo histórico point-in-time

Necesario para validar de forma más fuerte la capacidad histórica de elegir activos sin depender de supervivientes actuales.

Instrument master mínimo:

- altas/listings;
- bajas/delistings;
- cambios de ticker/mercado;
- existencia/disponibilidad histórica por fecha.

Hasta entonces, todos los resultados históricos de selección de universo completo deben declarar la limitación de survivorship.

---

# 17. FASE 9 — criterio de cierre V1

La V1 sólo se considera cerrada integralmente cuando exista evidencia suficiente de:

- cadena productiva única y estable;
- seguridad/persistencia/despliegue operativo;
- alertas coherentes con el motor compartido;
- replay causal y reproducible;
- costes/fiscalidad/cash/flujos correctos;
- comportamiento evaluado en distintos regímenes;
- políticas research promovidas o rechazadas con protocolo válido;
- limitaciones históricas explícitas;
- lista mínima y controlada de deuda V2.

La app puede ser técnicamente operativa antes de que finalice QUALITY Future Forward, pero una conclusión de superioridad económica de QUALITY no puede adelantarse a la evidencia prospectiva.

---

# 18. Qué NO es trabajo pendiente

No reabrir como tareas activas:

- V9/V10/V11 en sus formas probadas;
- V12/V13 como tuning retrospectivo;
- SLOPE_V1;
- QUALITY_V1 retrospectivo;
- QUALITY_ALLOCATION_BRIDGE_V1 sobre ventanas consumidas;
- HFG como muestra de promoción;
- antiguos motores/pantallas productivos duplicados;
- replay independiente por cada variante;
- nuevos jobs por activo concreto;
- retuning de Top64/Opportunity con snapshots ya observados.

---

# 19. Próxima secuencia técnica EXACTA

1. **Cerrar Fase 0:** revisar este `PROJECT_STATE.md` junto con `docs/APP_FLOW_AND_ROADMAP.md` y mantenerlos como guía de continuidad.
2. **Fase 1 permanece congelada:** no tocar motor productivo salvo bug reproducible.
3. **Entrar en Fase 2A:** auditoría del checklist real de publicación/seguridad/persistencia, sin cambiar la estrategia financiera.
4. **Continuar Fase 2B:** cerrar alertas persistentes de entrada y después WATCH/REDUCE/EXIT por UID reutilizando el clasificador compartido.
5. **Preparar Fase 3 documentalmente** antes de abrir nuevas muestras económicas.
6. **No iniciar Fase 4 ni Fase 5** hasta que Fase 3 esté congelada.
7. **QUALITY Future Forward sigue sólo por calendario.** Próxima ventana válida: 2026-10-09 22:30–24:00 Europe/Madrid.
8. **No tocar los 25 archivos congelados** de Future Forward para avanzar Fases 2–6.
9. **Fase 8** se aborda antes del cierre definitivo de validación histórica, no como excusa para reabrir la arquitectura current/live.
10. **Fase 10** queda deferred hasta cierre V1.

Cuando se cierre cada fase:

- actualizar este archivo;
- actualizar `docs/APP_FLOW_AND_ROADMAP.md`;
- archivar/retirar investigaciones cerradas;
- no dejar una tarea cerrada presentada como CURRENT.

---

# 20. Documentos de referencia

- `docs/APP_FLOW_AND_ROADMAP.md` — mapa maestro y roadmap.
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md` — invariante de discovery/Top64.
- `docs/PRIVATE_USERS_DEPLOYMENT.md` — seguridad, multiusuario y despliegue.
- `docs/TELEGRAM_ALERTS.md` — canal de alertas.
- `docs/V1_PILOT_DEPLOYMENT.md` — operación persistente/piloto.
- `docs/DYNAMIC_HISTORICAL_REPLAY.md` — replay integrado.
- `docs/dynamic_market_top64_v1_final_outcome.md` — cierre Top64.
- `docs/replay_explicit_cash_flows_v1_outcome.md` — flujos externos.
- `docs/quality_allocation_dynamic_future_forward_v1_preregistration.md` — protocolo QUALITY prospectivo.
- `docs/quality_allocation_dynamic_future_forward_v1_status.md` — estado QUALITY.
- `docs/forward_risk_research_state.md` — estado Forward Risk.
- `docs/DECISIONS.md` — decisiones históricas durables; si un punto antiguo contradice este estado y el código actual, debe corregirse/actualizarse y no utilizarse para reabrir una arquitectura retirada.