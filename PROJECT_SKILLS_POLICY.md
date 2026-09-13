# Trading — Política permanente de skills y herramientas

Fecha: 2026-09-13

Esta regla forma parte del contexto operativo permanente de `fmaranis/Trading/main`.

## Regla principal

En cualquier tarea de esta app, ChatGPT debe revisar las skills, plugins y herramientas disponibles y **usar activamente todas las que aporten valor real a la tarea concreta**. No debe limitarse al flujo manual/genérico si existe una skill especializada que pueda mejorar precisión, validación, calidad de datos, diseño, investigación o implementación.

Esto no significa invocar herramientas por rutina. Una skill sólo se usa cuando sea pertinente y compatible con las reglas arquitectónicas, metodológicas y de seguridad del proyecto.

## Prioridades para Trading

### Desarrollo y repositorio

- GitHub es la vía canónica para inspeccionar y modificar `fmaranis/Trading/main` cuando esté disponible.
- Context7 debe utilizarse cuando una decisión dependa de APIs, librerías, frameworks o documentación técnica actualizada.
- No crear soluciones paralelas por usar una skill; cualquier resultado debe integrarse en `CORE_ARCHITECTURE_V1` y en los flujos ya existentes.

### Datos, replay e investigación cuantitativa

Usar las skills de Data Analytics cuando correspondan, en especial:

- `analyze-data-quality` para procedencia, cobertura, missingness, duplicados, joins, freshness, integridad y conflictos de datos;
- `validate-data` para revisar metodología, cálculos, conclusiones, visualizaciones y evidencia antes de aceptar un resultado;
- `product-business-analysis` para decisiones respaldadas por métricas;
- `metric-diagnostics` para investigar anomalías o movimientos de métricas;
- `design-kpis` para congelar métricas, gates, guardrails y criterios de éxito antes de abrir muestras;
- `jupyter-notebooks` cuando haga falta un análisis reproducible o auditable;
- `build-report` / `visualize-data` / `build-dashboard` cuando el entregable requiera evidencia cuantitativa durable o monitorización.

Estas skills no sustituyen el motor local de replay. Los backtests/replays largos siguen ejecutándose en la propia app, normalmente desde `ResearchValidationCenter`.

### Producto y UX

Usar Product Design cuando la tarea sea realmente de UX/producto, por ejemplo:

- `audit` para revisar flujos, pantallas, accesibilidad o fricción de uso;
- `research` para investigar problemas UX actuales;
- `get-context` / `ideate` cuando se diseñe o rediseñe una experiencia;
- `design-qa` cuando exista un prototipo/implementación visual que deba compararse con un objetivo.

No usar Product Design para modificar por sí mismo lógica financiera o crear otra arquitectura de decisión.

### Integraciones y servicios externos

- Usar skills de Stripe sólo si el proyecto incorpora pagos, suscripciones, infraestructura o servicios donde realmente apliquen.
- Usar `plugin-management` cuando una tarea pueda beneficiarse materialmente de una conexión externa no disponible todavía.
- No instalar, conectar o autorizar un servicio sin la acción/consentimiento explícito del usuario cuando el producto lo requiera.

## Compatibilidad con las reglas permanentes del proyecto

El uso de skills nunca puede vulnerar estas reglas:

- repositorio y `PROJECT_STATE.md` son la fuente de verdad técnica;
- `CORE_ARCHITECTURE_V1` permanece como arquitectura productiva única;
- no crear motores, replays, jobs o pantallas paralelos si la capacidad cabe en los existentes;
- replays y validaciones largas se ejecutan localmente en la app, no en GitHub Actions;
- no retunear políticas con muestras consumidas;
- respetar causalidad, `NEXT_OPEN`, `REAL / STATIC_REFERENCE / SYNTHETIC`, fiscalidad y cash;
- no tocar archivos congelados de validaciones prospectivas salvo decisión metodológica explícita;
- actualizar `PROJECT_STATE.md` después de cambios relevantes.

## Regla práctica para cada tarea

Antes de empezar una tarea relevante:

1. comprobar el estado real de `main` y `PROJECT_STATE.md`;
2. identificar si alguna skill/plugin disponible es materialmente útil;
3. leer la skill aplicable antes de usarla cuando exista una guía específica;
4. combinar varias skills si cubren partes distintas del problema;
5. ejecutar sólo las que mejoren realmente el resultado;
6. integrar la salida en la arquitectura y metodología existentes;
7. verificar el resultado con los guards/tests/datos apropiados.

La ausencia de una invocación de skill en una tarea debe significar que ninguna aportaba valor material, no que se ignoró el catálogo disponible.