# QUALITY_ALLOCATION_FUTURE_FORWARD_V1 — VOID BEFORE START

Fecha: **2026-09-09**

Estado: **ANULADO ANTES DE PRIMER OUTCOME / NO CONSUME MUESTRA**

HEAD previo al primer preregistro: `479b1a1efa2576caf2be11790d9fc9a6cd2fb10c`.

## Motivo de anulación

El primer diseño de `QUALITY_ALLOCATION_FUTURE_FORWARD_V1` congelaba nominalmente los 64 instrumentos que componían `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` el 2026-09-09.

Eso contradice la arquitectura productiva del proyecto.

La app no debe operar sobre una whitelist permanente de 64 nombres. Su objetivo es descubrir de forma dinámica el mercado actual, rankear candidatos mediante reglas explícitas y formar una shortlist dinámica de hasta 64 instrumentos antes de aplicar gates, timing y allocation.

Documento normativo:

`docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`

## Consecuencia metodológica

Este protocolo se anula **antes de disponer de resultados elegibles y antes de ejecutar el baseline prospectivo**.

Por tanto:

- no existe resultado económico;
- no existe PASS/FAIL;
- no se consume muestra future-forward;
- no puede citarse como evidencia de QUALITY;
- no puede relanzarse desde `ResearchValidationCenter`;
- producción permanece `LEGACY`.

## Qué debe sustituirlo

Una validación future-forward correcta deberá congelar:

- reglas de discovery current/live;
- mercados/tipos de instrumento elegibles;
- filtros de datos y operatividad;
- fórmula de ranking;
- regla de shortlist dinámica `Top N`, con objetivo/máximo 64;
- gates, timing y allocation;
- reglas de continuidad prospectiva.

No deberá congelar de antemano las identidades de los activos.

En cada fecha de decisión deberá registrar el snapshot real de candidatos disponibles y la shortlist que habría resultado ese día. Esos snapshots y decisiones ya observados sí deberán quedar inmutables para impedir reescritura retrospectiva.

## Elementos del diseño anterior que sí pueden reutilizarse

Sin considerarlos evidencia, pueden conservarse como ideas de infraestructura para el protocolo correcto:

- `LEGACY` como control productivo;
- `QUALITY_ALLOCATION_BRIDGE_V1` como candidato shadow/research-only;
- misma arquitectura `CORE_ARCHITECTURE_V1`;
- datos REAL-only;
- `MONTHLY` como frecuencia de decisión, no de aportación;
- externalCashFlows explícitos e iguales entre brazos cuando se use fixture de reach;
- ejecución causal / `NEXT_OPEN` donde corresponda;
- huellas/hash de observaciones ya cerradas para evitar reescritura;
- ninguna promoción directa desde una primera fase prospectiva.

## Regla permanente derivada

**En investigación de selección de activos se congelan las reglas que generan la shortlist, no los nombres futuros que deben aparecer en ella.**
