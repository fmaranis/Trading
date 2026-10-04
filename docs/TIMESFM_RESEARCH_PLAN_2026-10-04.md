# TimesFM Research Plan — 2026-10-04

## Estado
PRIORITY / READY TO EXECUTE / RESEARCH-ONLY

## Propósito
Determinar si Google TimesFM aporta capacidad predictiva incremental, causal y económicamente útil a la arquitectura de trading existente sin contaminar producción ni retunear retrospectivamente.

## Licencias
- Contexto: la aplicación es privada/personal, no se vende ni se presta como servicio a terceros.
- TimesFM 3.0: benchmark/research únicamente mientras la licencia de los pesos mantenga la restricción explícita de `non-production use`. La ausencia de comercialización no elimina por sí sola esa restricción; no se conectarán sus outputs a decisiones reales de inversión sin una licencia compatible o una aclaración oficial que lo permita.
- TimesFM 2.5: pesos Apache-2.0; candidato para reproducir cualquier hallazgo y, si supera validación independiente, para una integración de uso real.

## Reglas no negociables
1. Producción sigue LEGACY.
2. No cambiar PortfolioCandidateGate, eligibility, sizing u órdenes productivas.
3. No usar outcomes para seleccionar parámetros después de abrir la muestra.
4. Señal en fecha T sólo usa datos disponibles <= T.
5. Entrada económica, cuando se evalúe, usa NEXT_OPEN.
6. Cero fallback sintético silencioso.
7. Registrar versión exacta del modelo, checkpoint, inputs, fechas y hashes de evidencia.

## Stage A — smoke técnico
- Integrar un runner Python local/backend separado del frontend.
- Cargar TimesFM 3.0 sin modificar producción.
- Probar inferencia determinista/repetible sobre una pequeña cesta de activos.
- Validar que no existe lookahead y que los cutoffs terminan en informationDate.
- Persistir forecasts y cuantiles, no recomendaciones.

Criterio de parada: si instalación/inferencia o causalidad no son reproducibles, bloquear antes de outcomes económicos.

## Stage B — benchmark predictivo congelado
Predicciones: 1, 5, 20 y 60 sesiones.

Targets primarios:
- retorno forward;
- retorno relativo al benchmark;
- downside/max drawdown futuro;
- calibración/incertidumbre mediante cuantiles.

Baselines obligatorios:
- cero/naive;
- Buy & Hold cuando aplique;
- momentum simple congelado;
- LEGACY actual.

Métricas mínimas:
- directional accuracy;
- Spearman/rank IC;
- MAE/RMSE para forecast continuo cuando proceda;
- cobertura/calibración de cuantiles;
- lift frente a baselines;
- estabilidad por activo y régimen.

## Stage C — traducción económica
Sólo si Stage B muestra señal fresh útil.

Comparar:
- LEGACY;
- TimesFM puro;
- LEGACY + TimesFM como contexto/filtro.

Métricas:
- CAGR;
- Sharpe/Sortino;
- max drawdown;
- hit rate;
- turnover/costes;
- alpha relativo;
- estabilidad por submuestras.

No optimizar thresholds sobre la misma muestra que decide PASS/FAIL.

## Stage D — licencia/portabilidad
Si 3.0 aporta valor:
1. reproducir el protocolo con TimesFM 2.5 Apache-2.0;
2. medir degradación/mejora frente a 3.0;
3. sólo considerar una integración productiva si existe evidencia independiente y una vía de licencia compatible.

## Resultado esperado
Uno de:
- NO_SIGNAL: cerrar sin tocar producción;
- RESEARCH_SIGNAL_ONLY: 3.0 útil pero no portable/productivo;
- PORTABLE_CANDIDATE: 2.5 reproduce señal suficiente y pasa a confirmación fresh independiente;
- PROMOTION_CANDIDATE: únicamente tras confirmación separada posterior.

## Siguiente paso exacto
Implementar Stage A y congelar antes de abrir outcomes el universo/muestra, inputs, horizons, targets, baselines y criterios PASS/FAIL.


## Stage A — implementación congelada
- Job canónico: `timesfm-stage-a-smoke-v1` en `ResearchValidationCenter`.
- TimesFM package pin: `timesfm==3.0.2`; PyTorch se instala por separado desde el índice oficial CPU para evitar descargar dependencias CUDA innecesarias en este smoke CPU-only.
- Checkpoint: `google/timesfm-3.0-pytorch`.
- Revisión HF: `24701cec1b1ea47232c0766e888855c9976ef62b`.
- SHA-256 conocido de `model.safetensors`: `a7592b0a8432baee54483254e5647856911ce69e09d09a9bb65904b2d98f17da`.
- Entorno aislado: `.research-venv/timesfm3`; no modifica `backend/requirements.txt`.
- Primer arranque puede descargar aproximadamente 1,32 GB del checkpoint oficial a la caché de Hugging Face.
- Fixture Stage A: `SYNTHETIC`, determinista, 3 variates + 1 past-only covariate, contexto 128, horizonte 16, cuantiles P10–P90.
- Gate técnico simultáneo: shape correcto, outputs finitos, cuantiles monótonos, mediana coherente, repetibilidad <=1e-5 y prueba de future-tail excluido del prefix causal.
- Stage A no descarga mercado, no abre outcomes, no genera señal económica y no tiene autoridad productiva.
- Para no multiplicar acciones visibles, PEAD R3 queda `PARKED` durante este smoke; su protocolo no cambia ni se consume.

- Integridad adicional: el runner descarga/resuelve `model.safetensors` en la revisión congelada y verifica su SHA-256 byte a byte antes de instanciar TimesFM; cualquier discrepancia bloquea Stage A.

## Estado de implementación
`RUNNER_INTEGRATION_PASS_REAL_CHECKPOINT_PENDING`.

Guards/wiring/sintaxis y el runner exacto han sido auto-verificados, incluidos casos positivos y fail-closed negativos. La única comprobación pendiente es cargar el peso oficial de 1,32 GB en un runtime con egress binario; no se pide al usuario que la ejecute. No se abre Stage B ni ningún outcome antes de un PASS técnico real del checkpoint.


## Corrección de bootstrap — 2026-10-04 12:33 CEST
- La evidencia válida más reciente quedó en `BLOCKED_ENVIRONMENT / TIMESFM_DEPENDENCY_INSTALL_FAILED` antes de importar TimesFM o abrir mercado/outcomes.
- Se cerró una regresión del bootstrap: un `venv` incompleto podía conservar `bin/python` pero carecer de un `pip` funcional; la existencia del ejecutable ya no se considera suficiente.
- El bootstrap valida ahora Python **y** `python -m pip --version`; un entorno parcial se elimina y cae al target local `.research-python/timesfm3`.
- El smoke es CPU-only: instala PyTorch desde `https://download.pytorch.org/whl/cpu` y TimesFM base `3.0.2` por separado.
- Todo fallo de instalación conserva ahora `stdout`, `stderr`, código de salida, modo y Python seleccionado en la evidencia JSON.
- No se modifica el protocolo de investigación ni producción; Stage B continúa bloqueado hasta un PASS técnico real.
