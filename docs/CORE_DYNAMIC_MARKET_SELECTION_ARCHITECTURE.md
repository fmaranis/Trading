# CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE

Estado: **NORMATIVO / INVARIANTE DE PRODUCTO**

Fecha de formalización: **2026-09-09**

Este documento define una regla estructural de la aplicación. No es una hipótesis de research ni un detalle de una validación concreta. Cualquier desarrollo futuro debe respetarlo salvo decisión explícita del usuario documentada como cambio de arquitectura.

## 1. Objetivo de producto

La app no tiene como objetivo elegir inversiones dentro de una lista fija de 64 instrumentos.

El objetivo es:

> **buscar de forma dinámica en el mercado actual, identificar los activos más atractivos y fiables disponibles en ese momento, formar una shortlist operativa dinámica y decidir después si merece la pena entrar, añadir, mantener, reducir o no hacer nada.**

La pregunta de producto es siempre:

1. **DÓNDE**: qué activos son hoy los candidatos más atractivos/fiables del mercado accesible;
2. **CUÁNDO**: si alguno de esos candidatos tiene timing y condiciones suficientes para actuar;
3. **CUÁNTO**: cuánto capital debe asignarse, si procede;
4. **POR QUÉ**: qué evidencia respalda la decisión;
5. **NO HACER NADA** debe seguir siendo una salida válida.

## 2. Los 64 son una shortlist dinámica, no un universo fijo

Cuando se utilice el número 64, significa **máximo/objetivo de candidatos operativos del momento**, no una whitelist permanente de nombres.

La identidad de los activos puede y debe cambiar entre evaluaciones.

Ejemplo conceptual:

`mercado actual -> discovery amplio -> filtros de operatividad/calidad de datos -> ranking causal -> Top 64 dinámico -> gates -> timing -> allocation -> decisión`

Un activo puede entrar hoy y salir en la siguiente revisión si deja de ser competitivo. Un activo nuevo puede entrar si pasa las mismas reglas.

Si existen menos de 64 candidatos válidos, se utilizan únicamente los válidos. Nunca se rellena la shortlist con activos de peor calidad sólo para alcanzar 64.

## 3. Qué se congela y qué no se congela

En producción y en validación prospectiva deben congelarse, cuando proceda:

- las reglas de discovery;
- los mercados/tipos de instrumento admitidos;
- los filtros de operatividad y calidad de datos;
- la fórmula de ranking;
- las variables usadas para rentabilidad potencial, fiabilidad y riesgo;
- el tamaño máximo de shortlist;
- los hard gates;
- las reglas de timing;
- las reglas de allocation;
- la semántica de ejecución y costes.

**No se congelan por defecto los nombres de los activos.**

Congelar una lista nominal de instrumentos sólo es admisible en un estudio controlado específico y debe etiquetarse expresamente como tal. Nunca puede confundirse con la arquitectura productiva de selección de mercado.

## 4. Significado de “más rentables/fiables”

No significa ordenar únicamente por rentabilidad pasada.

La shortlist debe resultar de reglas causalmente definidas que combinen, según las versiones validadas de la app:

- potencial de retorno / momentum / oportunidad;
- fiabilidad y persistencia de la señal;
- riesgo, volatilidad y drawdown;
- calidad y suficiencia de datos;
- liquidez/operatividad cuando exista esa evidencia;
- divisa y compatibilidad con el motor;
- diversificación cuando corresponda;
- cualquier filtro estructural productivo vigente.

El score de discovery/ranking selecciona **candidatos para estudiar**. No autoriza una compra por sí mismo.

## 5. Cadena productiva canónica

La arquitectura productiva continúa siendo `CORE_ARCHITECTURE_V1` y debe mantenerse integrada.

Conceptualmente:

`AssetUniverseScanner [current/live discovery + filtros + ranking/shortlist dinámica]`
`-> PortfolioCandidateGate`
`-> InvestmentDecisionEngine`
`-> PortfolioDecisionEngine/evaluatePortfolioDecision`
`-> ejecución y seguimiento`

No crear un segundo motor de discovery, ranking, decisión o replay.

El discovery amplía/renueva candidatos; no puede saltarse `PortfolioCandidateGate`, cash hurdle, timing, allocation, fiscalidad ni reglas de ejecución.

## 6. Papel del catálogo actual

`EUR_PORTFOLIO_DISCOVERY_UNIVERSE` es una **base operativa/seed/fallback validada**, no la definición conceptual del mercado disponible.

Puede proporcionar candidatos conocidos y robustos cuando el discovery abierto falle temporalmente, pero no debe convertirse en una whitelist que impida considerar activos nuevos.

`OPEN_MARKET_DISCOVERY_V1` demostró que el discovery current/live puede integrarse de forma aditiva en el mismo scanner.

El estado actual todavía no completa la arquitectura objetivo porque:

- el scanner limita actualmente `selected` a un máximo de 10;
- el automatic current discovery V1 promociona automáticamente sólo ETF EUR;
- por tanto todavía no existe un verdadero **Top 64 dinámico de mercado amplio**.

Esto es deuda arquitectónica explícita y debe resolverse antes de considerar cerrada la selección de activos de producto.

## 7. Regla para futuras validaciones prospectivas

Una validación future-forward de selección/ranking debe congelar **las reglas**, no los nombres.

En cada fecha de decisión debe registrar de forma auditable:

- snapshot de candidatos descubiertos ese día;
- procedencia y timestamp del discovery;
- candidatos rechazados y motivo;
- ranking completo o suficiente para reproducir la shortlist;
- Top 64 dinámico resultante;
- decisiones posteriores de gates/timing/allocation;
- huella/hash que impida reescribir retrospectivamente una observación ya cerrada.

Si una futura versión de código cambia una decisión ya observada, esa evidencia prospectiva no puede sobrescribirse silenciosamente.

## 8. Replay histórico y survivorship

El discovery actual de Yahoo es current/live y **no puede utilizarse para inventar retrospectivamente el mercado disponible en 2018, 2020, etc.**

Para reconstruir históricamente un universo dinámico de mercado completo hace falta un instrument master point-in-time con, como mínimo:

- altas/listings;
- bajas/delistings;
- cambios de ticker/mercado cuando proceda;
- disponibilidad histórica por fecha.

Hasta disponer de ello:

- los replays históricos pueden usar catálogos conocidos con disponibilidad causal de barras;
- deben declarar la limitación de survivorship;
- no deben presentarse como prueba completa de “elegir los mejores del mercado de cada fecha”.

Esta limitación histórica **no cambia el objetivo productivo actual**, que sí es discovery dinámico current/live.

## 9. QUALITY, LEGACY y allocation

El universo/shortlist dinámico responde a **DÓNDE**.

`LEGACY` vs `QUALITY_ALLOCATION_BRIDGE_V1` responde principalmente a cómo priorizar/asignar capital **después** de que existan candidatos válidos.

No deben mezclarse ambos problemas metodológicos.

Producción permanece `LEGACY` mientras QUALITY no tenga evidencia fresh suficiente.

Una validación de QUALITY no debe convertir una lista fija de activos en arquitectura de producto.

## 10. Invariantes que futuros cambios no pueden violar

1. **No whitelist fija como universo productivo.**
2. **64 = shortlist dinámica máxima/objetivo, no 64 nombres permanentes.**
3. **Discovery actual debe poder incorporar candidatos nuevos bajo reglas explícitas.**
4. **Ranking sólo crea candidatos; los gates/timing/allocation conservan autoridad.**
5. **La app puede concluir “no comprar nada”.**
6. **No usar Yahoo current discovery para reconstrucción histórica retrospectiva.**
7. **Las validaciones prospectivas congelan reglas y snapshots observados, no identidades futuras.**
8. **No crear motores paralelos para resolver discovery/ranking.**
9. **Producción y replay deben compartir la misma cadena conceptual, respetando las limitaciones de datos de cada modo.**
10. **Cualquier desviación de estas reglas debe documentarse como cambio explícito de arquitectura antes de implementarse.**

## 11. Criterio de cierre de esta parte de la app

La selección de mercado no se considerará arquitectónicamente cerrada hasta que el flujo current/live pueda:

1. explorar un conjunto suficientemente amplio de instrumentos elegibles;
2. cargar datos REAL y rechazar fallos de procedencia/calidad;
3. rankear de forma reproducible según reglas congelables;
4. generar una shortlist dinámica de hasta 64 candidatos;
5. entregar esos candidatos a la cadena productiva existente;
6. registrar por qué un activo entra, sale o queda fuera;
7. permitir que ningún activo supere los gates cuando no exista oportunidad suficiente.

Hasta entonces, los 64 instrumentos del catálogo actual deben tratarse como **bootstrap operativo**, no como el universo final de inversión.