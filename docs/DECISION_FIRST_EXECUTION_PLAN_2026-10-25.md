# Custodia — hoja de ruta de ejecución «decision-first» y coste adicional objetivo 0 €

Fecha: 2026-10-25  
Repositorio: `fmaranis/Trading`, rama canónica `main`  
Fuente de estado: `PROJECT_STATE.md`; reglas de producto: `docs/APP_FLOW_AND_ROADMAP.md`.

## Objetivo
Convertir Custodia en una aplicación web accesible desde móvil y ordenador que muestre qué hacer, importe, razones, oportunidades y riesgos; y en un laboratorio causal capaz de localizar decisiones erróneas, probar alternativas y admitir cambios productivos sólo con evidencia independiente. **No crear otra app, otro motor de decisión o múltiples replays.** La app web y el Centro de validación siguen siendo las superficies visibles.

## Condiciones no negociables
- Producción continúa `LEGACY`; `CORE_ARCHITECTURE_V1` y `PortfolioCandidateGate -> InvestmentDecisionEngine -> PortfolioDecisionEngine` permanecen únicos.
- `NEXT_OPEN`, información point-in-time, cash BCE, costes, fiscalidad y `externalCashFlows` no se relajan.
- Sin Yahoo current discovery como universo histórico; respetar cobertura incompleta y muestras consumidas.
- Ningún job grande arranca si fallan guards/tests específicos o `tsc --noEmit`.
- No GitHub Actions para cálculos largos; cálculo en el backend local o worker duradero de la aplicación, no en procesos de ChatGPT.
- Coste adicional objetivo: 0 EUR. Un servicio gratuito es candidato, no garantía de CPU permanente, de alta disponibilidad ni de cuotas suficientes. No desplegar migración ni introducir servicios de pago sin necesidad acreditada y decisión del usuario.
- No reescribir retrospectivamente resultados ni fingir PASS económico al completar una comprobación técnica.
- Cambios pequeños directamente en `main`, con verificaciones rápidas y actualización de `PROJECT_STATE.md`. No avanzar al hito siguiente mientras haya regresión grave.

## Orden de ejecución y condiciones de salida

### H0 · Control del bloqueo, preservar evidencia
**Estado inicial comprobado:** 2026-10-25, checkpoint GitHub `replay-results/validation-runs/kronos-stage-b-v1-progress.json` con 680/5580 trayectorias (2018Q1-Q3 completos y 2018Q4 parcial); el estado vivo del proceso/servidor sigue desconocido.

**Implementación:** auditar en el código real runner, estado durable, UI y coordinación del proceso; introducir ejecución acotada por unidad conservando metodología y checkpoint, y estado explícito `PAUSED/INCOMPLETE`, nunca `PASSED` mientras falten trayectorias. No presuponer que cuatro paths/minibatch ya evitan bloqueos; esa protección ya existe. Al interrumpir, finalizar unidad coherente, guardar y liberar CPU. La app debe poder mostrar progreso y seguir operando; la continuación se hace tras nueva ejecución o con un worker persistente si existe infraestructura comprobada. No convertir el cierre de la pestaña móvil en terminación del cálculo cuando el servidor persista.

**Pruebas de salida:** test sin inferencia real con checkpoint, reanudación, no pérdida o mutación de paths, guard de concurrencia, fallos de red/token y error de estado (sin falso PASS). Medición de recursos y estabilidad del backend en un smoke corto. Antes de tocar archivos sellados, analizar impacto y reseal técnico sólo si está permitido metodológicamente; conservar intactas muestras, anchors, assets, seed, temperatura, horizonte y outcomes. El job completo permanece no recomendado hasta superar estas pruebas.

### H1 · Auditoría de decisiones ya registradas (sin modelos caros)
**Primera evidencia disponible:** `replay-results/validation-runs/diagnostics/decision-audit-pilot-2019-2022-v1.json` (read-only, consumida). Engine: 17.572,29 EUR vs structural core 20.365,50 EUR; diferencia -2.793,21 EUR, sin causa atribuida todavía.

**Implementación:** informe integrado en el resultado/auditoría del replay existente, sin motor paralelo ni pantalla nueva. Para cada decisión: universo PIT disponible, candidatos, gate, ranking, cash desplegable, sizing, timing, orden ejecutada, costes/impuestos y alternativas `HOLD`/core cuando la evidencia lo permite. Capturar eventos bloqueados y distinguir `NO_SIGNAL` de `NO_CAPITAL` y de `NOT_ELIGIBLE`. Si falta trazabilidad, reportar `NOT_AUDITABLE` antes que inferir causas.

**Salida:** clasificación reproducible de errores con reach económico: cuántas decisiones potencialmente mejorables, cuántas alteraron órdenes, impacto estimado y límites de causalidad. No calcular alfa ni promover con este diagnóstico histórico consumido.

### H2 · Un experimento económico A/B mínimo
**Elección:** seleccionar una sola clase de decisión con reach real en H1. A=`LEGACY`; B=una regla candidata definida y congelada antes de ejecutar los outcomes del test pertinente. Ambas usan el **mismo** `DynamicHistoricalReplayEngine`, universo, precios, fechas, capital, `externalCashFlows`, `NEXT_OPEN`, fiscalidad, costes, benchmarks compatibles y estado inicial.

**Salida:** logs pareados de diferencia efectiva de órdenes, ventaja neta en EUR y pp frente a A y al structural core, max drawdown, exposición, concentración, consistencia temporal, costes e impuestos. Una política sin reach se etiqueta `INCONCLUSIVE`, no PASS ni FAIL económico. Una política evaluada en muestra utilizada para diseñarla sigue `CONSUMED`.

### H3 · Contraste independiente de eficacia
**Implementación:** congelar implementación, parámetros, muestra y gates antes de abrir datos fresh/blind point-in-time; persistir sello, procedimiento y resultados; confirmar en bloque/ventana independiente según la hipótesis. Evitar leakage entre selección de muestras, tuning y confirmación.

**Salida:** sólo evidencia suficientemente sólida puede justificar la propuesta de pasar de research/shadow a decisión productiva. En caso contrario `LEGACY` se mantiene.

### H4 · Infraestructura web independiente de AI Studio
**Implementación:** evaluar opciones gratuitas reales para frontend web HTTPS y backend/worker persistente; mantener desarrollo en GitHub. Probar compatibilidad Node/Python/Torch, secretos, disco durable, reinicios, cuotas, privacidad, logs, exposición pública, restablecimiento y coste. Comparar con ejecución CPU local opcional. Usar un piloto no productivo antes de migración. No aceptar solución que dependa del móvil abierto para completar jobs ni que convierta la app pública en un endpoint de ejecución arbitraria.

**Salida:** decisión documentada `KEEP_CURRENT` o `MIGRATE` con smoke end-to-end, coste medido, reversión disponible y acceso web/móvil confirmado. Evitar despliegue disruptivo.

### H5 · IA que añada valor incremental
**Implementación:** modelos baratos y reproducibles primero (ranking relativo al structural core, calidad fundamental PIT, momentum/régimen, LightGBM si hay datos adecuados); comparar con reglas simples y con `LEGACY`. TimesFM y Kronos se conservan como fuentes **research-only** que deben justificar señal incremental y reach; no recomendación automática basada en forecasts históricos con cutoff de entrenamiento desconocido.

**Salida:** primero calidad de señal fuera de muestra; luego utilidad económica mediante H2-H3, sin tuning sobre samples consumidas. No ampliar a ML si H1-H3 no identifican una pregunta accionable.

## Responsabilidades y mínima participación del usuario
ChatGPT: investigar el repositorio, decidir la solución menos invasiva, implementar cambios cuando haya herramienta disponible, añadir guards/tests rápidos, auditar resultados, actualizar roadmap/estado y comunicar SHA + un resumen de evidencias/limitaciones; no relegar el trabajo a Work ni GitHub Actions.

Usuario: sólo cuando sea inevitable, realizar una acción que ChatGPT no puede hacer desde GitHub (autorizar/cargar un secreto en el runtime, crear cuenta gratuita de infraestructura, sincronizar/deplegar la web, o iniciar/verificar un cálculo en su backend). Reducir a **una instrucción operativa inequívoca** por entrega; no pedir decisiones ya documentadas. No solicitar copiar claves al chat. No pedir seguimiento diario ni encender un PC por la noche.

## Secuencia práctica
- Primero H0: detener el patrón de reinicios y perder progreso de Kronos.
- H1 ya puede avanzar independientemente de H0 usando auditorías existentes; no bloquear diagnóstico de decisiones por una inferencia de horas.
- H2 se alimenta de un hallazgo verificable de H1, no de ideas abstractas.
- H4 avanza sólo tras verificar costes y viabilidad; la app actual permanece operativa.
- H5 es posterior a demostrar valor en la cadena económica, no un requisito inicial.

## Registro de avance por entrega
Cada entrega debe describir: HEAD/commit, archivos modificados, pruebas ejecutadas/no ejecutadas, evidencia fuente (PIT/REAL/STATIC_REFERENCE/SYNTHETIC), estado `DONE/PENDING/BLOCKED`, y la única intervención humana imprescindible si la hay. No afirmar trabajo en segundo plano entre conversaciones.
