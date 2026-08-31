# Trading — Estado Canónico del Proyecto

> **Leer este archivo primero al retomar el proyecto desde otra conversación, equipo o dispositivo.** El repositorio canónico es `fmaranis/Trading/main`. Este documento es la memoria operativa del proyecto y debe mantenerse actualizado cuando cambien decisiones de arquitectura, hallazgos de validación o próximos pasos.

## Reglas de trabajo no negociables

- **Nunca añadir ni depender de GitHub Actions.** Las validaciones se ejecutan en local/AI Studio.
- ChatGPT inspecciona, desarrolla y corrige directamente sobre GitHub cuando sea posible.
- AI Studio se usa principalmente como entorno de ejecución/Preview/validación local. No delegar en Gemini diagnósticos amplios ni cambios de arquitectura salvo petición expresa.
- El gate local completo sigue siendo `npm run validate:aistudio`. Un resultado verde anterior no valida cambios posteriores.
- No usar datos sintéticos como fallback silencioso. La procedencia REAL / STATIC_REFERENCE / SYNTHETIC debe seguir siendo explícita.
- El replay histórico debe ser causal: solo información disponible hasta la fecha evaluada, ejecución en observación posterior y ningún lookahead.
- Si el usuario dice “terminó, revisa la prueba”, buscar primero el resultado sincronizado en GitHub antes de pedirle que lo adjunte manualmente.

---

# Estado actual — 2026-08-31

HEAD observado al actualizar este documento: `9061b0778d2b02be5a91aad3fc7efd9dcb74a266` (`Assert timing gate before portfolio allocation`).

Stack: React 19 + TypeScript + Vite + Tailwind + Recharts + Motion. Aplicación de soporte a decisiones de inversión con datos REAL, backtesting/replay causal, cartera real, radar de oportunidades, fiscalidad española y ejecución condicionada por broker/costes.

La pregunta de producto que debe ordenar toda la UX sigue siendo:

> **¿Muevo dinero hoy o no?**

Formato deseado de recomendación:

> **ACCIÓN → IMPORTE → ACTIVO → POR QUÉ → DETALLE TÉCNICO**

Acciones operativas objetivo:
- INVERTIR X €
- REDUCIR / SALIR
- ROTAR
- NO MOVER DINERO
- REORDENAR CARTERA

La app no debe convertir “tengo efectivo” en “debo invertirlo”. Mantener liquidez es una decisión válida.

---

# Cartera real de referencia

No relabelar como demo/ejemplo ni sustituir silenciosamente:

- Vanguard Global Stock Index Fund EUR Acc — ISIN `IE00B03HD191` — 12.600 € invertidos — adquisición 2026-08-11 — 196,59 participaciones — MyInvestor — traspasable.
- Vanguard Emerging Markets Stock Index Fund EUR Acc — ISIN `IE0031786696` — 1.400 € invertidos — adquisición 2026-08-12 — 4,61 participaciones — MyInvestor — traspasable.
- Capital pendiente de invertir: 13.000 €.
- Horizonte de despliegue: 12 meses.
- Alternativa de efectivo / hurdle: 2,5% anual salvo cambio explícito.

Constantes canónicas: `USER_REAL_FUND_POSITIONS`, `USER_REAL_STAGED_CAPITAL_PLAN`.

Política operativa MyInvestor:

> **Asumir disponibilidad salvo que el usuario marque expresamente un instrumento como no disponible.**

Debe seguir diferenciándose de una confirmación oficial del broker.

---

# Arquitectura de producto

Solo dos workspaces principales:

## 1. Mi cartera real

Objetivo: posiciones reales, liquidez real y decisiones accionables.

Superficies principales:
1. Alertas importantes de entrada ahora.
2. Mi cartera real y salud independiente de cada posición.
3. Qué haría hoy / plan operativo.
4. Explicación técnica secundaria.

## 2. Estudio y señales

Objetivo: investigar sin mutar la cartera real.

Incluye radar, catálogo, análisis por ticker/ISIN, gráfica de precio/NAV, señales históricas y replay auditado.

Las ideas de research no se convierten en operaciones reales hasta superar filtros de datos, cash, consenso, timing, costes, broker, fiscalidad y disponibilidad de capital.

---

# Pipeline de nueva inversión

Cadena conceptual deseada:

> **REAL discovery → calidad / cash hurdle → consenso → Entry Timing → selección diversificada → target estratégico → tramo ejecutable hoy → costes/broker/fiscalidad**

El selector responde principalmente **DÓNDE** invertir. El nuevo timing debe responder **CUÁNDO**. El sizing debe responder **CUÁNTO HOY**, sin confundirlo con el target estratégico final.

## Entry Timing — ya implementado parcialmente

Archivos principales:
- `src/investment/decision/entryTiming.ts`
- integración en `portfolioCandidateGate.ts`
- integración en `currentOpportunityAlerts.ts`

Commits principales del 2026-08-31:
- `1952fb07...` — Add causal entry timing gate
- `7ea0e87c...` — Gate current opportunities by entry timing
- `53805ade...` — Export entry timing engine
- `6b3b7223...` — Assert causal entry timing on alerts
- `5a577907...` — Apply entry timing before new-money allocation
- `9061b077...` — Assert timing gate before portfolio allocation

Estados implementados:
- `WAIT`
- `ENTRY_READY`
- `ENTRY_STRONG`

Setups implementados:
- `BREAKOUT_CONFIRMATION`
- `PULLBACK_RECOVERY`
- `TREND_CONTINUATION`
- `NONE`

Variables usadas de forma causal:
- SMA20 / SMA50 / SMA200
- distancia a medias
- retorno 5 sesiones
- máximo previo de 20 sesiones
- drawdown desde máximo de 60 sesiones
- momentum 20/60/120
- volatilidad
- tendencia estructural
- consenso y votos favorables/adversos

Reglas actuales destacables:
- un activo de buena calidad puede quedar en `WAIT` aunque pase cash + consenso;
- activos demasiado extendidos o con riesgo alto no deben perseguirse;
- `ENTRY_READY` propone una fracción inicial de 0,25 del target;
- `ENTRY_STRONG` propone 0,50;
- el timing nunca autoriza completar el 100% del target en la primera orden;
- el allocator ya no debe recibir un candidato mientras el timing esté en `WAIT`.

**Importante:** esta implementación es reciente y todavía debe ser validada con replay histórico amplio antes de considerar correctos sus umbrales. No optimizar sobre los mismos periodos usados para descubrir el problema.

---

# Problema estructural detectado en los replays históricos

La evidencia acumulada hasta hoy muestra que el motor antiguo se comportaba demasiado parecido a:

> **seleccionar → invertir casi todo al inicio → HOLD casi indefinido**

La sensación del usuario está respaldada por los casos estudiados: casi independientemente de la fecha inicial, el sistema encontraba rápidamente varias posiciones aceptables, desplegaba gran parte del efectivo y luego apenas gestionaba las posiciones.

Conclusión conceptual:

- El análisis/selector de activos parece razonablemente prometedor.
- Faltaba una capa explícita de **timing de entrada**.
- Sigue faltando mejorar de forma importante la **gestión posterior de posiciones**.
- El motor no debe intentar adivinar techos/suelos ni usar stops rígidos simples.

Arquitectura objetivo de estado:

> **CANDIDATE → WAIT → ENTER → BUILD → HOLD → WATCH → REDUCE → EXIT**

La intención es separar claramente:

1. **DÓNDE** — calidad/ranking/consenso.
2. **CUÁNDO** — timing causal de entrada.
3. **CUÁNTO** — target estratégico vs tramo ejecutable hoy.
4. **CÓMO GESTIONAR** — HOLD/ADD/WATCH/REDUCE/EXIT.

---

# Evidencia histórica revisada

## Caso 1 — 2022-04-13 → 2023-04-12

Capital inicial: 9.000 €.

Resultado:
- motor: 8.528,55 € / -5,2383%
- comprar primeras posiciones y mantener: 8.526,77 € / -5,2581%
- ventaja mostrada: +1,78 € / +0,0198 pp
- drawdown máximo: -10,479%
- 5 compras ejecutadas
- 0 REDUCE / 0 EXIT

Posiciones reveladoras:
- AIGC: MFE +7,73%, MAE -18,55%, final aprox. -16,29% neto.
- WCOA: MFE +7,16%, MAE -17,07%, final aprox. -14,36% neto.
- Sanofi: MAE aprox. -21,70% y acaba positiva (~+2,98% neto), demostrando que un stop fijo simple puede destruir recuperaciones válidas.

Interpretación: la gestión dinámica añadió prácticamente cero valor y toleró reversión de ganancias a pérdidas fuertes sin reducción.

## Caso 2 — 2023-04-13 → 2024-04-12

Resultado:
- motor: +7,1278%
- hold inicial exacto: +7,1208%
- ventaja: +0,62 € / +0,0069 pp
- drawdown máximo: -7,283%
- 4 compras iniciales
- 0 REDUCE / 0 EXIT

Ejemplos:
- Air Liquide: MFE +24,59%, final +19,56% neto.
- Deutsche Telekom: MAE -17,02%, final ~-1,95% neto.
- Iberdrola: MAE -13,13%, final ~+0,49% neto.
- Vanguard Eurozone: MFE +15,42%, final +13,09%.

Interpretación: aguantar algunos drawdowns fue correcto; por tanto no debe implantarse un stop-loss porcentual universal.

## Caso 3 — 2024-07-12 → 2025-07-11

Resultado:
- motor: +7,7268%
- hold inicial exacto: +3,7679%
- ventaja mostrada: +356,30 € / +3,9588 pp
- drawdown máximo: -17,863%
- 5 compras
- 0 REDUCE / 0 EXIT

Punto clave:
- en febrero de 2025 la cartera llegó a ~+12,79%; dos meses después estaba ~-3,21%; el motor no redujo nada.
- EQQQ: MFE +13,50%, MAE -16,81%, final ~+4,13% neto.
- SXRV: MFE +13,46%, MAE -16,82%, final ~+4,08%.
- VUSA: MFE +14,33%, MAE -12,24%, final ~+4,42%.
- Xetra-Gold entró dos días después de las compras iniciales y terminó ~+26,81% neto.

**Interpretación crítica de “valor aportado por mover la cartera”:**

Ese indicador es actualmente, en esencia:

> `engineFinalEur - exactHoldFinalEur`

Por tanto un valor positivo **no significa necesariamente que la gestión activa de ventas/reducciones haya añadido valor**. Puede ser positivo simplemente porque el motor añadió más tarde un activo que el comparador “primeras compras y mantener” no contiene. En este caso, gran parte de la ventaja aparente proviene de la entrada posterior de Xetra-Gold, no de una mejor gestión de salidas.

La etiqueta debe revisarse porque puede inducir a interpretar “alpha de trading” donde solo existe diferencia de composición inicial/posterior.

## Caso 4 — 2025-03-27 → 2026-03-26

Se observó finalmente un EXIT (Deutsche Börse) y varios movimientos posteriores, pero existe una anomalía temporal: el replay solicitado desde 2025-03-27 contiene señal/operaciones anteriores a esa fecha. No usar este caso para calibrar estrategia hasta corregir el límite temporal.

Comportamiento útil para diagnóstico:
- Deutsche Börse llegó aproximadamente a MFE +8,23% y terminó saliendo alrededor de -23% tras deterioro estructural fuerte.

Esto sugiere que el mecanismo EXIT existe pero históricamente estaba demasiado tardío.

## Caso largo pendiente

Archivo recibido para estudiar:
- `trading-replay-2022-07-11-2025-07-10.zip`

Debe usarse como prueba extensa antes de fijar reglas definitivas de WATCH/REDUCE/EXIT y para revisar la métrica “valor aportado por mover la cartera”.

---

# Gestión de posiciones — siguiente gran fase pendiente

No implantar un simple:
- stop -X%
- take-profit +Y%

La evidencia de Sanofi, Deutsche Telekom, Air Liquide y Xetra-Gold demuestra que esas reglas simples pueden cortar recuperaciones o ganadores de largo recorrido.

La dirección acordada es una gestión dinámica basada en:

## High-water mark / memoria de beneficio

Cada posición debe recordar el máximo favorable alcanzado desde su entrada (MFE / high-water mark).

Una posición que estuvo +15% no debe tratarse igual que una que nunca pasó de +1%.

El motor debe evaluar cuánto beneficio acumulado está devolviendo y si esa devolución coincide con deterioro técnico/estructural.

## Estados de salud objetivo

- `HOLD`
- `ADD`
- `WATCH`
- `REDUCE`
- `EXIT`
- `DATA_MISSING`

Transición conceptual deseada:

> ganador sano → HOLD / ADD
>
> pérdida de momentum o beneficio devuelto → WATCH
>
> deterioro confirmado + devolución relevante → REDUCE
>
> ruptura estructural fuerte → EXIT

No vender solo por estar “overweight”. No vender solo por perder contra cash. No vender automáticamente por un drawdown porcentual aislado.

## Factores a combinar

- tendencia de largo plazo
- momentum 20/60/120
- ruptura/recuperación de SMA
- volatilidad y régimen
- consenso
- número de señales adversas
- MFE desde entrada
- drawdown desde máximo de posición
- drawdown desde coste de adquisición
- velocidad del deterioro
- ventaja fiscal/costes de rotación

Objetivo: permitir que los ganadores corran, pero impedir que una posición pase de +10/+15% a -15/-20% sin atravesar al menos WATCH/REDUCE si además la evidencia se deteriora.

---

# Sizing / construcción progresiva de posición

Principio acordado:

> **Target estratégico ≠ orden de hoy.**

Ejemplo conceptual:
- target final 20%
- entrada inicial autorizada 5%
- confirmación posterior +5%
- nueva confirmación +5%
- completar solo cuando la evidencia lo justifique

El Entry Timing actual ya expone `suggestedInitialFraction` 0,25 / 0,50, pero debe comprobarse de extremo a extremo que el motor de asignación y ejecución realmente respete esa fracción y no vuelva a convertir un target en una compra inmediata completa.

Debe evitarse promediar a la baja automáticamente. Los ADD deben responder a tesis confirmada, no simplemente a que el precio haya caído.

---

# Técnicas/teorías adoptadas como marco conceptual

No existe ningún método que garantice comprar abajo y vender arriba. El diseño busca robustez, no predicción perfecta.

Familias usadas como referencia conceptual:
- trend following / time-series momentum para confirmar si una tendencia merece exposición;
- cross-sectional / relative momentum para ayudar a decidir dónde concentrar atención;
- breakout confirmation, pullback recovery y trend continuation para timing;
- volatility-aware sizing para decidir cuánto riesgo asumir;
- scaling-in / construcción progresiva de posición;
- high-water mark y trailing defensivo condicionado por deterioro, no take-profit fijo;
- salida estructural basada en múltiples señales, no stop-loss rígido universal.

Garantías de diseño deseadas:
- no invertir todo solo porque haya efectivo;
- no confundir target con orden inmediata;
- no comprar nueva exposición con timing `WAIT`;
- mantener cash cuando no hay setup suficiente;
- reducir tamaño con riesgo alto;
- recordar máximo beneficio alcanzado;
- no cortar automáticamente un ganador sano;
- no mantener indefinidamente una posición severamente deteriorada sin transición WATCH/REDUCE/EXIT.

---

# Replay histórico auditado

UI principal: `HistoricalReplayProgressivePanel.tsx`.
Worker: `src/workers/historicalReplayAudit.worker.ts`.
Storage actual: `historical_progressive_audit_v3`.

Controles:
- fecha inicial
- frecuencia DAILY/WEEKLY/MONTHLY/QUARTERLY
- duración total
- tamaño de tramo
- modo MANUAL/AUTO
- capital inicial

Características actuales:
- cálculo por worker para no bloquear la UI;
- checkpoints y reanudación;
- trayectoria completa `equityPath`;
- señales cronológicas;
- operaciones ejecutadas;
- selección visual de activos;
- comparador exacto de primeras compras y mantener;
- análisis por posición con MFE/MAE, entrada/salida, bruto/neto, comisiones y fiscalidad;
- invariant de auditoría: operaciones pasadas no pueden desaparecer/cambiar silenciosamente entre chunks.

## Export/import JSON

`HistoricalAuditJsonControls.tsx` permite:
- Exportar prueba JSON
- Importar prueba JSON

Formato:
- metadata
- config/session
- checkpoints
- executions
- path
- signals
- summary
- positions

## Guardado al proyecto / GitHub

Se añadió backend local para guardar:
- `validation-runs/latest.json`
- `validation-runs/archive/<timestamp>-historical-replay.json`

Commits:
- `67530eb7...` — Persist historical replay audits into project files
- `146910c8...` — Add project persistence for historical audit runs
- `2472f49e...` — Lock project-saved historical audit contract

Flujo deseado definitivo:

> **App ejecuta → guarda resultado en workspace → usuario sincroniza workspace con GitHub → ChatGPT lee directamente GitHub**

No implementar autenticación GitHub/token en frontend salvo petición expresa.

Problema actual observado: AI Studio puede no detectar los archivos generados en runtime como “cambio de la web” y no ofrecer sincronización. Este punto sigue abierto. Hasta resolverlo, los JSON/ZIP adjuntos por el usuario pueden analizarse directamente, pero el objetivo sigue siendo cero adjuntos manuales.

Cuando el flujo funcione, al recibir “terminó, revisa la prueba”, leer primero `validation-runs/latest.json` desde GitHub.

---

# Fiscalidad española

Archivos principales:
- `spanishTaxModel.ts`
- `taxAwareExecutionOverlay.ts`

Escala de ahorro implementada:
- 0–6.000 €: 19%
- 6.000–50.000 €: 21%
- 50.000–200.000 €: 23%
- 200.000–300.000 €: 27%
- >300.000 €: 30%

Si la base previa no está confirmada, reservar conservadoramente 30% de ganancia positiva estimada para análisis de fricción.

Regla importante:
- una rotación no estructural debe compensar impuestos + costes;
- un EXIT estructural puede ejecutarse por control de riesgo aunque tenga coste fiscal;
- para fondos traspasables, preferir traspaso fiscalmente diferido cuando sea operacionalmente elegible;
- el impuesto estimado no debe restarse automáticamente del cash del broker en cada venta como si se pagase inmediatamente.

Tema aún pendiente del replay histórico: modelar pago fiscal anual de forma temporalmente realista y separar `tax paid` de `pending tax liability`. No considerar este punto cerrado.

---

# Invariantes de backtesting

- datos causales / no lookahead;
- `NEXT_OPEN` por defecto;
- `SAME_CLOSE` solo experimental;
- políticas intrabar: CONSERVATIVE / STOP_FIRST / TAKE_PROFIT_FIRST;
- no fallback sintético silencioso;
- WFO requiere `stepBars >= testWindowBars`;
- métricas con periodicidad dinámica: CAGR, Sharpe, Sortino, Calmar;
- cualquier `executedFallbackSignals > 0` en replay debe tratarse como bug de corrección.

Ruta REAL histórica:
- `/api/market-data/history`
- Yahoo Finance / proveedores de fondos
- cache 6h
- timeout 10s
- retry/backoff
- no intradía

Aliases Yahoo importantes:
- IE00B03HD191 → `0P00000WLG.F`
- IE0031786696 → `0P00012I6A.F`
- ES0174115065 → `0P0001PBAK.F`

---

# Próximo plan de implementación

No volver a tocar el selector general hasta validar el nuevo Entry Timing sobre periodos amplios.

Orden recomendado:

## Fase 1 — validar Entry Timing recién implementado

1. Ejecutar replay histórico causal con varias fechas y periodos largos.
2. Medir porcentaje de días `WAIT`, `ENTRY_READY`, `ENTRY_STRONG`.
3. Confirmar que ya no invierte sistemáticamente 80–90% al inicio de cualquier fecha arbitraria.
4. Confirmar que `suggestedInitialFraction` realmente limita el importe ejecutado, no solo aparece como metadata.
5. Mantener un conjunto holdout separado para no ajustar y evaluar sobre los mismos periodos.

## Fase 2 — máquina de estados de posiciones

1. Añadir high-water mark persistente / MFE por posición.
2. Calcular drawdown desde máximo de posición.
3. Introducir `WATCH` como estado intermedio real.
4. Definir `REDUCE` por deterioro combinado, no por stop fijo.
5. Mantener `EXIT` para ruptura estructural fuerte, pero evitar que llegue siempre demasiado tarde.
6. Definir `ADD` solo sobre confirmación favorable y riesgo aceptable.

## Fase 3 — sizing / capital deployment

1. Separar target estratégico de tramo autorizado hoy.
2. Respetar fracciones 25%/50% del timing o reglas equivalentes calibradas.
3. Incorporar volatilidad al tamaño de la entrada.
4. Permitir explícitamente que gran parte de los 13.000 € permanezca en cash si no hay setups.

## Fase 4 — corregir/redefinir comparador de “valor aportado por mover la cartera”

El comparador actual mezcla:
- diferencias por nuevas entradas posteriores;
- diferencias por gestión activa real;
- diferencias de cash residual.

Separar al menos:
1. **valor por selección/composición posterior**;
2. **valor por gestión de posiciones (ADD/REDUCE/EXIT)**;
3. **valor total vs buy-and-hold inicial**.

La etiqueta actual “valor aportado por mover la cartera” puede ser engañosa y debe cambiarse antes de usarla como KPI de calidad del motor.

## Fase 5 — corregir anomalías del replay

- investigar el caso cuyo replay comienza antes de la fecha seleccionada;
- garantizar truncado estricto a `startDate`;
- no usar un replay con violación temporal para calibrar estrategia;
- mantener test de regresión específico.

## Fase 6 — volver a ejecutar los casos históricos

Comparar antes/después en:
- retorno
- drawdown
- cash medio
- turnover
- nº BUY/ADD/WATCH/REDUCE/EXIT
- MFE cedido antes de salida
- recuperación de posiciones
- valor vs hold
- costes/fiscalidad

Objetivo: no maximizar retorno en los mismos casos, sino demostrar una conducta más racional y robusta.

---

# Criterio de éxito de la siguiente versión

La siguiente versión será mejor si puede hacer de forma natural cosas como:

> “El activo es bueno pero hoy está extendido: WAIT.”

> “Target estratégico 20%, pero hoy solo autorizo 5%.”

> “La posición sigue sana: HOLD aunque lleve una corrección temporal.”

> “Estuvo +15%, ha devuelto gran parte del beneficio y la tendencia se deteriora: WATCH / REDUCE.”

> “La tesis estructural está rota: EXIT.”

> “No hay suficientes oportunidades: mantener 70–100% de la nueva liquidez sin invertir.”

La aplicación debe responder **cuándo, cómo, dónde y cuánto**, sin asumir que estar en cash es un problema que haya que resolver inmediatamente.
