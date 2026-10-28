# Custodia — resultado real del diagnóstico económico UCITS R1

**2026-10-28 · `FAIL_DIAGNOSTIC` · investigación histórica consumida, sin autoridad productiva.**

## Evidencia real recibida (export del Centro de validación)

Archivo entregado por el usuario: `static-ucits-factor-economic-diagnostic-r1-2026-10-28T22-12-36-413Z.json` (export resumen del job, **no** JSON completo de los `capitals` ni precios/órdenes históricos).

- `jobId=static-ucits-factor-economic-diagnostic-r1`
- `status=PASSED`; `exitCode=0`; `error=null`; ejecutado `2026-10-28T22:12:06.910Z` a `2026-10-28T22:12:36.413Z`.
- **Resultado científico** `status=FAIL_DIAGNOSTIC`.
- **Capital primario**: 13.000 EUR.
- **Exceso patrimonial NETO de la cartera B frente a A**: **−464,1056 EUR**, esto es **−3,570043% del capital inicial acumulado**, **NO anualizado**.
- **Frecuencia de años ganadores de B**: **4/9 = 44,4444%** (objetivo orientativo del usuario cercano a 80%, NO alcanzado).
- `sourceResolution=EXPLICIT_RECAPTURE_EXISTING` (reutilizó la recaptura Yahoo v2 ya identificada).
- Ruta declarada por el backend: `validation-runs/diagnostics/static-ucits-factor-economic-diagnostic-r1-result.json`, **no encontrado en `main` ni `replay-results` al revisar el 28-10**. El export resumen no identifica valor final A/B individual, detalle fees/taxes por brazo, años concretos, sensibilidades 2500/30000, flujos diarios, hashes fuente ni órdenes. **No afirmar esos datos a partir del resumen**.
- `productionAuthority=false`; `LEGACY` sigue por defecto.

Política preregistrada e inalterada en `docs/STATIC_UCITS_FACTOR_ECONOMIC_DIAGNOSTIC_R1_PREREGISTRATION_2026-10-28.md`: A = 100% EUNL; B = 50% EUNL + 1/6 XDEM + 1/6 XDEQ + 1/6 XDEV; buy-and-hold sin rebalancear; compras NEXT_OPEN, títulos enteros, tasas, cash BCE y salida terminal fiscal. 2017–2025 **consumido**, no dato fresco.

## Comprobación independiente de dirección — NAV oficial congelado

Se reproduce una referencia **distinta del backtest** para comprobar plausibilidad, utilizando exclusivamente los 9 rendimientos anuales USD 2017–2025 de las propias clases ETF transcritos de iShares/DWS en `scripts/staticUcitsFactorIssuerAnnualReconciliationV1.mjs`. Cada título empieza a **1 unidad de riqueza por unidad de capital al cierre de 2016**, se capitalizan multiplicativamente los retornos 2017…2025 y se mantienen los **pesos iniciales congelados sin rebalanceo** (50%, 16⅔%, 16⅔%, 16⅔%).

- Factores acumulados **2017–2025 (USD, NAV publicado, gastos corrientes del fondo ya incluidos)**: EUNL ×**2,9493933537**, XDEM ×**3,4789199685**, XDEQ ×**2,8936624116**, XDEV ×**2,2835474068**.
- Control A ×**2,9493933537**; construcción B = 0,5×EUNL + (XDEM+XDEQ+XDEV)/6 = ×**2,9173849746**.
- Diferencia de riqueza simulada a un capital nominal de referencia 13.000: **aprox. −416,11 EUR**, **antes de comisiones de negociación, deslizamiento, impuestos y diferencias de fecha/divisa**; no confundir con el R1 real de **−464,11 EUR netos**.
- La comprobación anual no rebalanceada indicativa gana vs EUNL en **2017, 2018, 2022 y 2025**, 4/9; **el export R1 no da los años exactos**, así que no atribuirle automáticamente esas mismas victorias.

**Límites decisivos:** la referencia NAV parte del **cierre de 2016** y usa **USD**, mientras R1 compró en Xetra EUR en NEXT_OPEN tras 2016-11-04, gestionó cash EUR, ejecución entera, comisiones y fiscalidad. El ajuste oficial es una comprobación de **signo/magnitud aproximada y plausibilidad**, NO una conciliación exacta del replay ni una prueba fuera de muestra. No sumar/sustraer ~48 EUR como si fueran sólo comisiones.

## Lectura científica y económica

- El candidato congelado **fracasa frente a 100% EUNL en la comparación neta ejecutada**. La comprobación independiente NAV también apunta en dirección negativa; no hay indicio en este resumen de que el FAIL sea únicamente coste de trading o un bug.
- **No promocionar**, cambiar `LEGACY`, añadir este blend como recomendación, ni lanzar `R1b` quitando Value, aumentando Momentum, retocando límites, fiscalidad o slippage según quién ganara: 2017–2025 ha quedado consumida para rediseñar/promocionar.
- El resultado **no refuta predicción Forward Risk V8**, la información de quality/momentum, ni otras hipótesis científicas. Separa señal de política económica y capacidad de monetización real.
- El ROI objetivo de ~80% de años frente al benchmark no se ha demostrado. Que una política haya ganado 4/9 años históricos no implica 44,4% como probabilidad futura.

## Siguiente paso responsable

**Cerrar R1 como `FAIL_DIAGNOSTIC` y no reabrir sus outcomes para optimizar pesos.** Antes de probar un nuevo enfoque económico, hacer **auditoría descriptiva, no paramétrica**, del resultado completo si el runtime lo conserva: verificar semántica de impuestos y pérdidas compensables, descomposición bruta→costes→tributos, fricción de títulos enteros, consistencia de equityPath/finalValueEur, perfil de drawdown y sensibilidad capital 2.500/30.000. No prometer que esta auditoría rescatará la política.

De acuerdo con el histórico de `PROJECT_STATE.md`, ya fracasaron diversas formas de monetizar Forward Risk V8, ranking Quality/Slope y otros modelos; los fallos económicos no borran señales predictivas útiles. **Siguiente hipótesis distinta sólo tras diseñar mecánica económica y congelarla prospectivamente**, evitando optimizar sobre muestras consumidas. Una alternativa indexada simple sigue siendo la referencia justificada mientras no exista evidencia neta independiente a favor de otra.

**Estado de ejecución:** R1 efectivamente completado en la aplicación con científico FAIL. Este documento únicamente analiza y registra evidencia; no lanza replay, job, tests o nuevas operaciones.
