# QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 — preregistro prospectivo

Fecha de congelación: **2026-09-09**

Estado al crear este documento: **ARMED / NO OUTCOME OBSERVED / PRODUCTION LEGACY**

Este protocolo sustituye metodológicamente al antiguo `QUALITY_ALLOCATION_FUTURE_FORWARD_V1`, que fue **VOID BEFORE START** porque congelaba 64 nombres. El protocolo antiguo continúa archivado y no se reactiva.

---

## 1. Pregunta que se quiere responder

La pregunta no es si `QUALITY_V1` contiene información ni si puede cambiar un ranking. Eso ya se estudió en ventanas históricas consumidas.

La pregunta prospectiva es:

> **Con el mercado current/live descubierto dinámicamente y con capital realmente disponible para asignar, ¿el bridge congelado `QUALITY_ALLOCATION_BRIDGE_V1` distribuye el mismo capital mejor que `LEGACY` en datos futuros no observados?**

Producción continúa usando `LEGACY` durante toda esta fase.

---

## 2. Arquitectura obligatoria

No se crea scanner, candidate gate, decision engine ni allocator paralelo.

Cada checkpoint usa exactamente la cadena existente:

`Yahoo Search + Lookup current/live`
`-> AssetUniverseScanner`
`-> Top64 dinámico`
`-> PortfolioCandidateGate [LEGACY]`
`-> InvestmentDecisionEngine`
`-> PortfolioDecisionEngine`

El `PortfolioDecisionEngine` se evalúa dos veces sobre **la misma foto de mercado, el mismo decision result y el mismo capital de investigación**:

1. control: `opportunityAllocationPolicy = LEGACY`;
2. candidato shadow: `opportunityAllocationPolicy = QUALITY_ALLOCATION_BRIDGE_V1`.

La única diferencia permitida entre ambos brazos es esa opción de allocation ya existente.

---

## 3. Política QUALITY congelada

No se cambian coeficientes ni límites respecto al bridge ya consumido:

`candidateQualityAdjustment = (reliability - 50)*0.10 + (opportunity - 50)*0.20`

`qualityMultiplier = clamp(1 + candidateQualityAdjustment/100, 0.85, 1.15)`

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`

No se permite modificar posteriormente:

- 0.10;
- 0.20;
- 0.85;
- 1.15;
- cash hurdle;
- consenso;
- Entry Timing;
- starter/build caps;
- slots;
- category/asset caps;
- reglas de rotación;
- fórmula productiva del Top64.

Los snapshots observados desde este protocolo quedan consumidos para cualquier retuning de esta política.

---

## 4. Universo: reglas congeladas, nombres NO congelados

Se utiliza la arquitectura ya cerrada de mercado dinámico:

- `PRODUCT_MARKET_UNIVERSE_MODE = DYNAMIC_CURRENT_DISCOVERY`;
- target Top64 = 64;
- Yahoo Search + Lookup current/live;
- seed de 64 sólo bootstrap/fallback;
- EUR-compatible;
- ETF/EQUITY admitidos por el motor actual;
- mínimo 252 barras;
- procedencia REAL;
- antigüedad máxima de datos 7 días;
- dedupe económico vigente;
- ningún candidato fuera del Top64 puede reaparecer downstream.

**No se congela ninguna lista de activos futura.**

Un checkpoint sólo es elegible si:

- current discovery fue realmente intentado;
- no terminó degradado;
- promovió al menos 64 candidatos actuales fuera del bootstrap;
- el Top64 dinámico quedó completo;
- todos los activos de la shortlist utilizados por la cadena tienen provenance REAL.

Si falla cualquiera de estas condiciones, el mes no se consume con un snapshot de fallback.

---

## 5. Cadencia y continuidad

Cadencia: **MONTHLY**.

Primer mes elegible: **2026-09**.

Máximo: **12 checkpoints**.

Regla fundamental:

> **MONTHLY significa una observación mensual prospectiva, no una aportación mensual de dinero.**

Sólo puede existir **una observación inmutable por mes natural**.

Cada observación guarda:

- fecha/hora real del checkpoint;
- pool realmente escaneado;
- aceptados/rechazados y razones;
- Top64 y hash;
- gate y elegibles;
- `InvestmentDecisionResult` compartido y hash;
- plan LEGACY y hash;
- plan QUALITY bridge y hash;
- diferencia absoluta de notional planificado;
- hash de la observación;
- hash encadenado con la observación anterior.

Una segunda ejecución durante el mismo mes puede resolver outcomes ya maduros, pero **no puede sustituir el snapshot de ese mes**.

Si el estado prospectivo desaparece después del primer mes elegible, el runner falla cerrado con `QUALITY_FF_BASELINE_MISSING_AFTER_START_WINDOW`; no puede fabricar retrospectivamente una baseline nueva.

Estado local:

`.runtime/qualityAllocationDynamicFutureForwardV1.json`

`.runtime` permanece fuera del código canónico. El resultado de cada job devuelve además hashes y resumen de continuidad para poder auditar/exportar el estado.

---

## 6. Capital de investigación

Cada checkpoint es una **allocation shot independiente** con:

- notional: **13.000 EUR**;
- riesgo: **MEDIUM**;
- horizonte de decisión: **3 años**;
- cash benchmark congelado para esta comparación: **2,5% anual**;
- cartera inicial de investigación: vacía;
- cash inicial del probe: 13.000 EUR;
- `stagedCapitalPlan.availableEur = 0`.

Los 13.000 EUR:

- no proceden de la cartera privada del usuario;
- no se codifican como aportación externa real;
- no representan una aportación recurrente;
- no se acumulan entre meses;
- existen únicamente para que ambos allocators reciban exactamente el mismo problema de asignación y tengan reach económico medible.

Se conserva esa escala porque los diagnósticos históricos anteriores del bridge utilizaron 13.000 EUR; no se introduce una nueva escala después de observar resultados prospectivos.

---

## 7. Qué se compara en el checkpoint

El scanner, Top64, gate y `InvestmentDecisionEngine` son **comunes** a ambos brazos.

Luego se llama dos veces al mismo `PortfolioDecisionEngine.evaluate(...)`:

### Control

`LEGACY`

### Candidato research-only

`QUALITY_ALLOCATION_BRIDGE_V1`

Se registran, por activo:

- ticker;
- categoría;
- instrument type;
- amount EUR;
- priority score;
- quality multiplier;
- opportunity level;
- timing state;
- suggested initial fraction.

También se registran:

- capital desplegable;
- nueva inversión recomendada;
- cash objetivo;
- cash residual;
- número de contribuciones.

`planChanged` requiere una diferencia absoluta de plan superior a 0,01 EUR.

---

## 8. Ejecución causal para outcomes futuros

No se ejecuta retrospectivamente en el último close disponible del checkpoint.

La entrada económica de cada activo se ancla en:

> **la primera apertura REAL estrictamente posterior a la fecha real de ejecución del checkpoint.**

Así, aunque Yahoo entregue como último dato el día anterior, el protocolo no puede comprar usando un precio que ya era conocido al registrar la observación.

Para instrumentos `ETF_ETC` se aplican:

- unidades enteras;
- `brokerCommission` existente;
- si el amount no permite una unidad económicamente ejecutable, ese importe permanece cash.

Para `MUTUAL_FUND` se permite la inversión fraccionaria según la semántica ya usada por el motor.

No se modela venta al final del horizonte: se marca a mercado.

---

## 9. Outcomes congelados

Horizontes:

- **20 sesiones**;
- **60 sesiones**.

Para cada activo:

- entrada = primera apertura posterior al checkpoint;
- marca N = cierre después de N sesiones subsecuentes desde la sesión de ejecución.

El cash que no se despliega —cash objetivo, importes residuales por unidades enteras o capital no asignado— crece con la regla congelada:

`(1 + 0.025)^(N/252)`

El outcome de cada brazo es el valor final del mismo probe inicial de 13.000 EUR.

Se calcula:

- retorno LEGACY;
- retorno QUALITY;
- `QUALITY - LEGACY` en puntos porcentuales;
- diferencia final en EUR;
- capital realmente invertido al entry;
- comisiones de entrada;
- cash residual.

Si falta información REAL suficiente para cualquiera de los activos necesarios, el outcome no se rellena silenciosamente ni se elimina el activo: permanece **pending/unresolved** hasta que pueda resolverse causalmente.

Cada outcome resuelto recibe un hash inmutable. Una ejecución posterior no puede reescribirlo.

---

## 10. Separación reach / economía

Se separan dos preguntas:

### Reach

¿El bridge cambia realmente el plan?

Métricas:

- checkpoints observados;
- checkpoints con `planChanged`;
- diferencia absoluta de notional planificado.

### Economía futura

Sólo cuando el plan cambió y el horizonte está maduro:

- delta de retorno QUALITY vs LEGACY;
- win/loss/tie;
- mediana de deltas;
- win rate.

Un bridge que no cambia planes suficientes se clasifica como falta de reach, no como evidencia económica positiva o negativa.

---

## 11. Interpretación Phase A congelada

Phase A **nunca puede promover QUALITY a producción**.

Estado inicial:

`COLLECTING`

Lectura direccional a 60 sesiones sólo cuando existan al menos:

**6 outcomes resueltos de checkpoints en los que el plan QUALITY fue distinto de LEGACY.**

Para etiquetar únicamente:

`DIRECTIONALLY_POSITIVE_FOR_SEPARATE_PHASE_B`

se exigen simultáneamente:

- mediana `QUALITY - LEGACY` > 0 pp;
- win rate QUALITY vs LEGACY >= 60%.

Si hay reach suficiente y no se cumplen ambas:

`NO_DIRECTIONAL_EVIDENCE_FOR_PHASE_B`

Si se alcanzan 12 observaciones pero no existen 6 outcomes de 60 sesiones con plan distinto:

`INSUFFICIENT_REACH`

Estas etiquetas **no autorizan producción**. Un resultado direccionalmente positivo sólo permitiría diseñar después un Phase B blind independiente con reglas congeladas antes de abrir su muestra.

---

## 12. Qué NO puede hacerse después de ver resultados

Queda prohibido utilizar los outcomes de Phase A para:

- ampliar 0,85–1,15;
- cambiar pesos Reliability/Opportunity;
- alterar el Top64 productivo;
- modificar cash hurdle;
- cambiar timing;
- cambiar 20/60 por otros horizontes porque den mejor resultado;
- aumentar/reducir 13.000 EUR porque favorezca al bridge;
- eliminar meses negativos;
- sustituir snapshots;
- reetiquetar los activos que fueron descubiertos en cada fecha.

Cualquier nueva política requerirá otro protocolo y otra muestra fresh.

---

## 13. Relación con el replay histórico del usuario

Este future-forward no modifica el replay histórico.

El usuario puede seguir ejecutando replays con el motor productivo existente mientras Phase A recoge observaciones.

El replay sigue teniendo su limitación conocida de universo histórico/survivorship hasta disponer de instrument master point-in-time.

Este protocolo utiliza exclusivamente discovery **current/live prospectivo** y nunca Yahoo actual para reconstruir el pasado.

---

## 14. Criterio de puesta en marcha

Antes del primer checkpoint deben pasar en el mismo job:

1. guard específico de este protocolo;
2. guard del bridge QUALITY congelado;
3. guard Top64 dinámico;
4. guard `CORE_ARCHITECTURE_V1`;
5. guard `PortfolioCandidateGate`;
6. TypeScript / `npm run lint`;
7. checkpoint REAL current/live.

Un fallo previo impide registrar la observación.

No usar GitHub Actions ni agentes para ejecutar esta fase.

---

## 15. Contrato final

Durante toda Phase A:

- **producción = LEGACY**;
- QUALITY = shadow/research-only;
- reglas congeladas, activos dinámicos;
- una foto mensual real, sin backfill;
- observaciones y outcomes inmutables;
- no datos privados del usuario;
- no aportaciones implícitas;
- no promoción directa;
- no retuning sobre datos observados.
