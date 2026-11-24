# Auditoría independiente del replay histórico de Custodia — 24/11/2026

**Estado: LEDGER_RECONCILED / CORE_UNDERPERFORMED / CAUSAL_PRICE_PROOF_INCOMPLETE / CONSUMED_SAMPLE.**
Verificación ejecutada por ChatGPT directamente sobre evidencia ya archivada; **no es un nuevo backtest**, ni una muestra fresh, ni un candidato para promocionar producción.

## Fuente exacta e identidad

- Repositorio: `fmaranis/Trading`, rama de evidencia `replay-results`, exportación `validation-runs/latest-chatgpt-full.json`, blob Git **`5cdb13dbf4bf83fc4b92a6045f361ae5474c4050`**.
- Exportación de 2026-09-11T17:21:50.517Z, `TRADING_HISTORICAL_REPLAY_AUDIT`, esquema 1.
- Configuración declarada en el archivo: `CUSTODIA_ENGINE`, `MONTHLY`, `MANUAL` con cartera inicial 100 % efectivo, **13.000 EUR**, arranque 2019-01-01 y fin 2022-12-30; cash histórico `HISTORICAL_ECB_DFR_FLOOR_0`.
- **Código vigente distinto:** el replay fue exportado en septiembre, mientras que el `main` auditado es de noviembre. Por tanto, este archivo no demuestra que el motor **actual** produzca esas mismas operaciones. No reenviar el mismo archivo como prueba de esta versión.

## Comprobaciones recomputadas desde las series de evidencia

Ejecutado mediante `scripts/auditHistoricalReplayEvidence.mjs`, implementación independiente de los módulos de selección/replay. Se obtuvo:

| Invariante | Verificación |
| --- | --- |
| Trayectoria | **1.029** fechas de patrimonio estrictamente crecientes, sin duplicados |
| Decisiones | **48** fechas de señal y **1.024** registros de señales |
| Operaciones | **18** ejecuciones: 7 BUY, 7 ADD, 4 EXIT |
| Señal y ejecución | **18/18** ejecuciones ligadas a la señal exacta: mismo ID, activo, acción, fecha e importes |
| Posterioridad | **18/18** posteriores a su señal y **18/18** en la siguiente sesión *registrada por la cartera* |
| Patrimonio | Máxima diferencia de `equity - cash - invested`: **1,82 × 10⁻¹² EUR** |
| Valor invertido | Suma de posiciones frente a invertido: desviación máxima **0 EUR** |
| Efectivo | Mínimo diario **648,55 EUR**; ningún saldo negativo |
| Comisiones | **10,00 EUR**, concuerdan con las ejecuciones |
| Impuesto estimado por operaciones | **81,62 EUR**, concuerda con las ejecuciones |
| Drawdown | **30,8019 %**, recomputado sobre los 1.029 valores y coincidente con la salida archivada |
| Valor final | **17.572,29 EUR**, coincide con trayectoria, resumen y checkpoint final |

La fecha de ejecución del siguiente día **no confirma por sí sola** que el precio de ejecución fuera el `NEXT_OPEN` real de ese instrumento. Falta la serie OHLC original de cada activo y la evidencia del proveedor *point-in-time*.

## Resultados económicos (misma cartera inicial)

| 2019–2022 | Motor Custodia | Núcleo indexado global archivado |
| --- | ---: | ---: |
| Patrimonio inicial | 13.000 EUR | 13.000 EUR |
| Patrimonio final | **17.572,29 EUR** | **20.365,50 EUR** |
| Rentabilidad acumulada | **+35,171 %** | **+56,658 %** |
| Drawdown máximo | **30,802 %** | **33,757 %** |
| Ventaja frente a core | **−2.793,21 EUR** | Referencia |

El **valor final y el drawdown del motor** se recalcularon a partir de su propia trayectoria diaria. La cifra del **núcleo global** procede del bloque `structuralCoreBenchmark` de la exportación: se comprobó su **aritmética de totales/porcentajes**; no hay una trayectoria diaria independiente del núcleo ni OHLCV primario dentro de esta exportación para volver a calcular sus fills, impuestos, dividendos o drawdown.

Rendimiento anual del motor obtenido de su trayectoria (no comparables anuales del core):

| Año | Patrimonio final | Rentabilidad del año | Cash medio / equity | Ejecuciones |
| --- | ---: | ---: | ---: | ---: |
| 2019 | 15.112,53 EUR | +16,250 % | 20,68 % | 10 |
| 2020 | 16.093,91 EUR | +6,494 % | 4,90 % | 4 |
| 2021 | 19.991,97 EUR | +24,221 % | 3,97 % | 4 |
| 2022 | 17.572,29 EUR | −12,103 % | 3,50 % | 0 |

Diagnóstico de reach: **329** señales `AVOID` con timing `ENTRY_READY/ENTRY_STRONG` en **33** fechas; en **30/33** fechas el cash de la trayectoria era como máximo el 5 % del patrimonio. **No** equivalen a 329 operaciones posibles ni permiten atribuir retrospectivamente su no ejecución a un gate específico. La escasez de capital disponible es un condicionante relevante y distinto de la calidad predictiva de la señal.

## Qué NO queda validado con este archivo

1. **Origen REAL y disponibilidad temporal** de cada OHLCV: la exportación tiene decisiones, posiciones y trayectoria, pero carece de las barras brutas y de un manifest de procedencia por instrumento/fecha que permita recalcular señales desde información disponible entonces.
2. **Fill exacto NEXT_OPEN**: sólo se comprueba cronología y fecha de sesión, no precio abierto negociable ni slippage del día.
3. **Sesgo de supervivencia**: carecemos del instrument master con altas, bajas y exclusiones PIT. El descubrimiento Yahoo current/live no puede convertirse en universo retrospectivo.
4. **Benchmark estructural de forma independiente**: se audita la aritmética del total comunicado, no su trayectoria diaria ni equivalencia completa de costes.
5. **Superioridad económica y generalización**: el motor **no batió** al núcleo global en la muestra, aunque mostró una caída máxima algo inferior. Se usaron resultados de 2019–2022 en investigación y diseño; este bloque es **CONSUMED**, no fresh/blind/OOS.
6. **Flujos externos**: el archivo concreto declara una cartera inicial fija sin nuevas aportaciones. Para exportaciones con flujos externos, el auditor marca la rentabilidad y la comparación con core **N/D** hasta disponer de contabilidad ajustada por flujos y benchmark replicable; nunca calcula beneficio como `final/initial-1`.

## Automatización incorporada

- `scripts/auditHistoricalReplayEvidence.mjs`: verifica exportaciones de replay **sin llamar a Yahoo, sin ejecutar el motor, sin modificar cartera ni resultados guardados**. Uso local cuando exista un JSON del backend: `node scripts/auditHistoricalReplayEvidence.mjs <archivo_exportado.json>`.
- `tests/historicalReplayEvidenceAudit.unit.mjs`: pruebas rápidas adversarias con mini-ejemplos sintéticos **sólo para verificar el auditor** (efectivo negativo, falso patrimonio, posición inconsistente, cronología falsa, transacciones duplicadas, costes, drawdown, benchmark y aportaciones externas). Ni los ejemplos sintéticos ni esta auditoría se usan para afirmar alpha.
- `.github/workflows/product-quick-closure.yml` incluye **sólo** esas pruebas unitarias de milisegundos; **no ejecuta ningún replay en GitHub Actions**. El replay REAL largo se reserva al backend/`ResearchValidationCenter` de la app.

## Puerta concreta para la versión actual

1. Congelar SHA de `main`, configuración operativa y control (`LEGACY` y núcleo indexado), sin optimizaciones retrospectivas.
2. En el backend real de la app, producir un replay causal con datos `REAL`, universo histórico PIT verificable donde exista y salida `NEXT_OPEN`. Exigir `sourceType`, `informationDate`, dataset fingerprints y trazas, y bloquear el job si falla guard o `tsc`.
3. **Comprobar por separado** (a) integridad contable/temporal; (b) calidad predictiva; (c) riqueza neta frente a inversión pasiva con idénticos flujos, exposición y costos. Casos de 2020 y 2022 **pueden utilizarse como diagnóstico** pero **no** como holdout de promoción.
4. Sólo un holdout realmente reservado/future-forward con política congelada sirve para afirmaciones de ventaja económica. Si faltan OHLC o master PIT, publicar `INCONCLUSIVE`, no un PASS ficticio.
5. Ejecutar estos trabajos desde el backend ya integrado, no inventar un nuevo motor/pantalla/job ni pedir repetidas pruebas al usuario.

**Veredicto:** la contabilidad archivada es internamente coherente y la ejecución tiene cronología posterior a la señal; **el motor no ha demostrado ser económicamente mejor que mantener el núcleo global**, ni la evidencia archivada basta para acreditar causalidad completa o el HEAD actual. Ése es el bloqueo metodológico real que todavía debemos cerrar.
