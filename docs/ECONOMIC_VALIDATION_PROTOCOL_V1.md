# ECONOMIC_VALIDATION_PROTOCOL_V1 — protocolo económico común

Fecha de congelación: **2026-09-12**  
Estado: **FROZEN / PHASE 3 DONE / RESEARCH GOVERNANCE ONLY**

## 1. Objetivo

Este protocolo fija, antes de abrir nuevas muestras, las reglas comunes de validación económica para las Fases 4, 5 y 6 del proyecto Trading:

- Fase 4 — reentrada después de una salida errónea;
- Fase 5 — protección de grandes ganadores;
- Fase 6 — Forward Risk V8 como contexto.

No introduce una política nueva, no modifica producción y no crea un motor paralelo. Su función es impedir que una política candidata se diseñe o retunee después de observar el resultado de la misma muestra.

Producción permanece bajo `CORE_ARCHITECTURE_V1`, allocation `LEGACY` y los defaults productivos vigentes hasta que exista evidencia suficiente para una promoción explícita.

---

## 2. Principio rector

Se separan siempre dos preguntas:

1. **¿La señal contiene información útil?**
2. **¿Una política económica concreta monetiza esa información sin introducir un daño inaceptable?**

Una política puede fallar aunque la señal sea útil. Un FAIL económico no elimina automáticamente el valor informativo de la señal.

Esto es especialmente vinculante para Forward Risk V8: su valor predictivo retenido se conserva, mientras V9/V10/V11 permanecen retiradas en las formas ya probadas.

---

## 3. Regla de muestra: fresh / blind / out-of-sample

Una muestra sólo puede utilizarse para promoción si cumple simultáneamente:

### FRESH

Los resultados de esa muestra no se han utilizado para diseñar, interpretar, ajustar o seleccionar la política candidata.

### BLIND

Antes de abrir los resultados deben estar congelados y documentados:

- hipótesis;
- política exacta;
- parámetros y thresholds;
- sample-selection rule;
- baseline/control;
- métricas;
- PASS/FAIL;
- tratamiento de datos faltantes;
- costes, fiscalidad y cash;
- criterio de promoción/retirada.

### OUT-OF-SAMPLE

La muestra no puede ser una ventana o conjunto de activos ya consumido durante el diseño o interpretación de esa misma política.

Pueden ser válidos dos tipos de OOS:

- **holdout histórico realmente reservado**, seleccionado antes de abrir sus resultados y sin utilizar current discovery para reconstruir retrospectivamente el universo;
- **future-forward**, donde la observación se fija antes de que exista el outcome.

Si existe duda razonable sobre contaminación, la muestra se considera **consumida** y no sirve para promoción.

---

## 4. Registro de muestras consumidas

Quedan excluidas de promoción futura, aunque pueden seguir usándose para diagnóstico arquitectónico:

- ventanas históricas de Opportunity/Allocation 10y, 6y y 3y hasta 2026-09-01;
- muestras utilizadas en `QUALITY_V1`, `SLOPE_V1`, `QUALITY_ALLOCATION_BRIDGE_V1` y el audit de reach/capital;
- las mismas ventanas usadas para validar `externalCashFlows`;
- HFG y sus casos de enero de 2019 / trayectoria hasta 2022–2023;
- todos los holdouts abiertos en Forward Risk V8, V9, V10 y V11;
- cualquier muestra cuyo resultado se haya utilizado para discutir thresholds, waiting periods, confirmaciones, sizing, giveback, MFE o reglas de reentrada.

Los documentos históricos conservan detalle fino de cada muestra. Este protocolo no reabre ninguna de ellas.

---

## 5. Baseline y comparación obligatoria

Toda política candidata se compara de forma emparejada contra el baseline canónico que habría operado con exactamente la misma información y estado inicial.

Reglas:

- misma cartera inicial;
- mismo cash inicial;
- mismos `externalCashFlows`;
- mismas fechas de decisión;
- misma procedencia de datos;
- misma ejecución causal;
- mismos costes;
- misma fiscalidad;
- mismo tratamiento de cash;
- misma arquitectura productiva excepto por el único mecanismo experimental preregistrado.

El brazo control por defecto es la política canónica sin la modificación experimental.

No se permite cambiar a posteriori el benchmark porque otro resulte más favorable.

Benchmarks externos sólo se muestran cuando pueden recibir de forma causal los mismos flujos. Si no pueden, se muestran como **N/D** y no se inventa una comparación.

---

## 6. Causalidad y ejecución

Para cualquier validación económica:

- una decisión sólo usa información disponible hasta `decisionDate`;
- la ejecución ocurre después de la señal;
- se usa `NEXT_OPEN` cuando corresponda al motor/replay estándar;
- no hay lookahead;
- no se usa current Yahoo discovery para reconstruir un universo histórico;
- una validación que requiera REAL falla si aparece `SYNTHETIC`;
- las aportaciones y retiradas son `externalCashFlows` explícitos y fechados;
- `stagedCapitalPlan` nunca se interpreta como aportación recurrente;
- la frecuencia de decisión no crea dinero.

---

## 7. Cash, costes y fiscalidad

Salvo que una hipótesis preregistrada exija otra cosa por razones metodológicas, la comparación utiliza las reglas ya integradas en el motor:

- cash histórico: facilidad de depósito BCE con suelo nominal del 0% cuando corresponda;
- intereses y fiscalidad de cash: causales;
- broker/comisiones: iguales en control y candidato;
- títulos enteros cuando el activo lo requiera;
- fiscalidad de operaciones: misma semántica del replay/producto;
- benchmarks de cash: contabilidad independiente;
- aportaciones externas: no forman parte de la rentabilidad.

Cuando existen flujos externos, las métricas de rentabilidad deben ser ajustadas por flujos.

---

## 8. Métricas comunes

Toda política económica debe reportar como mínimo, cuando apliquen:

- valor final;
- retorno ajustado por flujos;
- CAGR si el horizonte lo permite;
- max drawdown;
- comisiones/costes;
- fiscalidad estimada;
- cash interest;
- número de operaciones;
- turnover o rotación equivalente;
- diferencia emparejada frente al baseline en EUR y puntos porcentuales;
- número de casos ganadores/perdedores/empates;
- mediana de la diferencia emparejada;
- peor diferencia emparejada;
- evidencia de que el mecanismo experimental tuvo reach real.

Una política que casi nunca cambia una decisión económica no puede declararse mejor por una diferencia irrelevante o accidental.

---

## 9. Materialidad económica común

Para evitar promover mejoras triviales, una política candidata necesita simultáneamente:

1. **reach suficiente**: el mecanismo experimental debe modificar realmente decisiones económicas en la muestra;
2. **dirección consistente**: al menos el 60% de los casos evaluables deben ser favorables frente al baseline;
3. **mediana favorable**: la mediana de la métrica económica primaria emparejada debe ser mejor que el baseline;
4. **materialidad**: la mejora mediana debe superar el mayor de:
   - los costes incrementales atribuibles a la política; o
   - **0,5% del capital económico expuesto** en la comparación, expresado de forma equivalente en la métrica primaria;
5. **guardrail de daño**: ningún beneficio medio/mediano puede justificar un deterioro material no preregistrado en riesgo, drawdown, fiscalidad, turnover o pérdida terminal.

El 0,5% se fija ahora como umbral de gobernanza y no se deriva de ninguna muestra observada.

Si una fase necesita una métrica primaria diferente de riqueza terminal —por ejemplo giveback, captura de MFE o downside evitado— deberá congelar su traducción exacta a materialidad **antes** de abrir la muestra, manteniendo el mismo principio: mejora económicamente visible y no sólo numéricamente positiva.

---

## 10. PASS / FAIL / INCONCLUSIVE

Una validación económica sólo puede terminar en uno de estos estados:

### PASS_CANDIDATE_FOR_CONFIRMATION

Se cumplen:

- integridad técnica y causal;
- muestra fresh/blind/OOS;
- reach suficiente;
- criterio direccional;
- materialidad;
- guardrails de daño;
- no existe dependencia dominante de un único caso extremo.

Este estado **no promociona producción por sí solo**. Habilita una confirmación separada.

### FAIL_RETIRED_AS_TESTED

La política no cumple los criterios congelados. Se retira **en la forma probada**.

No se permite convertir el FAIL en una nueva versión paramétrica optimizada sobre la misma muestra.

### INCONCLUSIVE

Se utiliza cuando no existe evidencia evaluable suficiente por razones como:

- muy poco reach;
- datos reales insuficientes;
- número de casos insuficiente;
- outcomes aún inmaduros;
- fallo de proveedor/infraestructura que invalida la comparación.

`INCONCLUSIVE` no es PASS ni autorización para retunear sobre esa muestra.

---

## 11. Promoción en dos etapas

Ninguna política de Fases 4–6 pasa directamente a producción desde una única validación.

Secuencia mínima:

1. política + protocolo específico congelados;
2. primer holdout fresh/blind/OOS;
3. si `PASS_CANDIDATE_FOR_CONFIRMATION`, congelar sin cambios la misma política;
4. segunda confirmación independiente, preferentemente future-forward o holdout reservado separado;
5. sólo con confirmación consistente puede abrirse una decisión explícita de promoción productiva.

Si la segunda confirmación falla, la política no se promociona y no se retunea con ambas muestras.

---

## 12. Reglas específicas por fase

### Fase 4 — reentrada tras salida errónea

La política deberá definir antes del holdout:

- qué constituye una salida previa elegible para análisis;
- condición exacta de reentrada;
- tratamiento del cash disponible;
- relación con incumbentes sanos;
- métrica primaria de recuperación económica;
- guardrails de drawdown/rotación/coste.

HFG sólo puede aportar la hipótesis general. No puede fijar thresholds de reentrada.

### Fase 5 — protección de grandes ganadores

La política deberá congelar antes del holdout:

- qué señales de deterioro activan protección;
- si la acción es mantener/reducir/otra;
- sizing exacto;
- cómo se mide giveback y MFE de forma causal;
- pérdida de upside tolerable;
- métrica primaria y guardrail de riqueza terminal.

El `REDUCE 50%` observado en HFG no es un default ni una política válida por sí mismo.

### Fase 6 — Forward Risk V8 como contexto

V8 puede probarse como contexto de:

- riesgo;
- sizing;
- ranking/priorización;
- alertas;
- stress;
- margen de seguridad.

No puede volver a usarse como interruptor diario ON/OFF directo sin una hipótesis nueva y justificación independiente.

V9/V10/V11 permanecen retiradas; no se crean V12/V13 como simples ajustes retrospectivos.

En Fase 6 deben reportarse por separado:

- calidad/información de señal;
- reach de la política;
- economía de la política.

---

## 13. Selección de muestra y survivorship

Mientras no exista instrument master point-in-time completo:

- no se afirma que un replay histórico represente el universo total disponible de cada fecha;
- current discovery no se usa retrospectivamente;
- los holdouts históricos se seleccionan mediante reglas congeladas y auditables antes de abrir datos/resultados;
- la limitación de survivorship permanece explícita.

Una mejora económica puede ser válida dentro de una muestra OOS concreta sin justificar todavía una afirmación sobre el mercado completo.

---

## 14. Integración en ResearchValidationCenter

Las validaciones de Fases 4–6 deben integrarse en el flujo existente, no crear motores paralelos.

Antes de cualquier cálculo largo deben pasar:

- guards arquitectónicos aplicables;
- causalidad/invariantes;
- `tsc --noEmit` / TypeScript;
- validación del preregistro y fingerprint cuando exista.

Los cálculos largos se ejecutan en el backend/local de la app, nunca en GitHub Actions ni mediante agentes consumiendo tokens durante horas.

---

## 15. Prohibiciones

Queda prohibido:

- retunear thresholds después de ver el holdout;
- cambiar la métrica primaria después de ver resultados;
- sustituir activos/períodos porque los elegidos hayan salido mal;
- seleccionar sólo crisis, ganadores o episodios favorables retrospectivamente;
- crear una nueva versión paramétrica inmediata sobre la misma muestra;
- mezclar muestras consumidas con fresh para alcanzar PASS;
- promocionar una señal predictiva únicamente porque una política haya ganado dinero;
- descartar una señal predictiva únicamente porque una política económica haya perdido dinero;
- introducir un segundo motor productivo para validar una hipótesis.

---

## 16. Estado de Fase 3

Con este documento quedan congelados antes de nuevas muestras:

- definición fresh/blind/OOS;
- registro de muestras consumidas;
- baseline y benchmarks;
- causalidad;
- cash/costes/fiscalidad;
- métricas comunes;
- materialidad;
- estados PASS/FAIL/INCONCLUSIVE;
- promoción en dos etapas;
- restricciones específicas de Fases 4–6.

**FASE 3: DONE / PROTOCOLO CONGELADO.**

Siguiente fase canónica: **Fase 4 — diseñar la política de reentrada y su preregistro específico antes de abrir una muestra fresh/blind/OOS.**
