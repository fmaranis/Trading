# Forward Risk V11 — preregistro congelado

Fecha de sellado: **2026-09-07**  
Protocolo: `V11_PREREG_2026_09_07`  
Política: `V11_POLICY_1`  
Estado: **POLICY_FROZEN / LOCAL_GUARDS_PASS / HOLDOUT_SEALED_READY_FOR_ONE_SHOT_OPEN / RESEARCH_ONLY**

Fingerprint congelado:

`sha256:945f39501b58c40735eeb9fc7dbd7ea128985e45b991f3c947c925cbc5cb94c1`

## 1. Motivo del cambio

V8 confirmó información anticipativa pero falló como interruptor de venta/recompra. V9 redujo fragmentación con una máquina de estados, pero el blind falló. V10 evitó vender posiciones existentes y usó Forward Risk para aplazar dinero nuevo, pero volvió a fallar porque la liberación del cash tendía a llegar después de parte de la recuperación.

La única lección reutilizable para V11 es arquitectónica:

**una señal probabilística de riesgo no debe convertirse en una orden binaria de vender o de esperar al 100%.**

No se permite usar los resultados V9/V10 para ajustar el mapa de sizing V11 ni sus gates.

## 2. Hipótesis V11

El motor existente continúa decidiendo **si** un activo merece dinero nuevo:

`PortfolioCandidateGate.status === ELIGIBLE`

Forward Risk sólo modifica **cuánto** cash se despliega cuando el gate ya es ELIGIBLE.

V11 no puede:
- convertir un `REJECTED` en compra;
- vender o reducir posiciones existentes;
- crear una espera diaria con liberación cuando desaparezca el riesgo;
- usar un threshold de oportunidad específico V11.

## 3. Score de riesgo continuo congelado

`riskScore = max(V5 vulnerability score, V7 options score)`

Ambos inputs mantienen sus definiciones de V8. El score se limita a `[0,100]`.

Mapa de sizing:

- score <= 80 -> desplegar 100%;
- score > 80 -> reducción lineal;
- score 90 -> desplegar 75%;
- score 100 -> desplegar 50%;
- nunca menos de 50% si el activo ya es ELIGIBLE.

Fórmula congelada:

`score<=80 ? 1 : 1 - 0.5*((score-80)/20)`

La parte no desplegada queda en cash remunerado. No existe un timer V11, ni 63 sesiones, ni una señal de liberación diaria. En la siguiente revisión mensual ordinaria, el motor vuelve a decidir con la información disponible entonces.

## 4. Semántica económica congelada

- aportación de investigación: 1.000 €;
- calendario: primera sesión de mercado de cada mes;
- ejecución: `NEXT_OPEN`;
- títulos enteros;
- broker/comisiones MyInvestor existentes;
- cash: `HISTORICAL_ECB_DFR_FLOOR_0_AFTER_TAX`;
- sin ventas por V11 y, por tanto, sin plusvalías realizadas causadas por V11;
- sólo fiscalidad del interés del cash.

### Baseline
Cada mes recibe la misma aportación. Si `PortfolioCandidateGate` es `ELIGIBLE`, despliega el 100% del cash disponible en la siguiente apertura. Si es `REJECTED`, conserva el cash.

### V11
Recibe exactamente los mismos flujos y usa el mismo gate. Si es `ELIGIBLE`, despliega la fracción V11 del cash disponible según el score continuo; si es `REJECTED`, conserva el cash igual que baseline.

Así el único cambio experimental es el **sizing incremental de Forward Risk**.

## 5. Holdout V11 sellado

Selección exclusivamente estructural antes de cualquier descarga histórica V11. Los seis son UCITS de renta variable, con cotización EUR en Deutsche Börse/Xetra, antigüedad estructural suficiente y **clases acumulativas**. Esta última condición evita sesgar a favor del cash cuando el histórico causal usa `Close` split-adjusted y no modela distribuciones de dividendos como flujos separados.

No aparecen en `EUR_ASSET_UNIVERSE`, `EUR_VALIDATION_HOLDOUT_UNIVERSE` ni en los blind V9/V10.

- `V11_BLIND_IUSQ` — `IUSQ.DE` — IE00B6R52259 — MSCI ACWI — Xetra desde 2012-04-02.
- `V11_BLIND_SXR4` — `SXR4.DE` — IE00B52SFT06 — MSCI USA — Xetra desde 2010-03-10.
- `V11_BLIND_EUNM` — `EUNM.DE` — IE00B4L5YC18 — MSCI Emerging Markets — Xetra desde 2009-10-20.
- `V11_BLIND_EUNK` — `EUNK.DE` — IE00B4K48X80 — MSCI Europe — Xetra desde 2009-10-20.
- `V11_BLIND_SXR1` — `SXR1.DE` — IE00B52MJY50 — MSCI Pacific ex Japan — Xetra desde 2010-03-10.
- `V11_BLIND_SXRZ` — `SXRZ.DE` — IE00B52MJD48 — Nikkei 225 — Xetra desde 2010-03-10.

La sustitución estructural de las dos clases distributivas inicialmente consideradas por `SXR4.DE` y `SXRZ.DE` se hizo **antes de cualquier apertura histórica V11**, exclusivamente para eliminar el sesgo de dividendos no modelados. No se consultaron resultados, rentabilidades, drawdowns ni volatilidades V11 para esa decisión.

Contaminados y prohibidos como sucesores:
- V9: `SPPW.DE`, `SPY5.DE`, `SPYM.DE`, `ZPRS.DE`, `VGEU.DE`, `ZPDJ.DE`;
- V10: `VGVF.DE`, `VNRA.DE`, `VFEM.DE`, `VERE.DE`, `VGEK.DE`, `VJPN.DE`.

Después de abrir V11 no se permite sustituir ningún activo, tampoco por datos insuficientes o problemas de proveedor.

## 6. Gate de calidad predeclarado

Cada activo necesita:
- >=756 barras;
- >=36 decisiones mensuales;
- >=12 decisiones mensuales `ELIGIBLE`;
- >=4 decisiones `ELIGIBLE` realmente moduladas por riesgo >80;
- fechas únicas;
- open/close positivos;
- ninguna variación absoluta close-to-close de una sesión >40%.

Fallo -> `INVALID_DATA`. Menos de 6 casos válidos -> `INCONCLUSIVE`. Sin reemplazos.

## 7. Drawdown ajustado por aportaciones

El drawdown no se calcula directamente sobre el saldo en euros porque una aportación externa puede crear un pico artificial. El runner usa **unitización de cartera**:

1. antes de cada aportación calcula el NAV por unidad a la apertura;
2. emite nuevas unidades por el importe externo;
3. ejecuta la compra sin alterar artificialmente el NAV por el flujo;
4. calcula el drawdown sobre la serie de NAV al cierre.

Métrica:

`FLOW_ADJUSTED_UNIT_NAV_MAX_DRAWDOWN`

## 8. Gate retorno/riesgo congelado

Para cada activo:

- `drawdownReductionPctPoints = baselineMaxDD - v11MaxDD`;
- `finalDeltaPctOfContributions = (V11 final - baseline final) / aportaciones totales * 100`;
- `wealthEfficiency = (finalValue / aportacionesTotales) / (1 + maxDrawdownPct/100)`;
- `wealthEfficiencyRatio = V11 wealthEfficiency / baseline wealthEfficiency`.

PASS individual:

`drawdownReductionPctPoints >= 0.5 AND finalDeltaPctOfContributions >= -0.5 AND wealthEfficiencyRatio >= 1`

Interpretación: V11 puede sacrificar como máximo 0,5% del capital aportado, pero sólo si reduce al menos 0,5 puntos de drawdown y la eficiencia terminal por unidad de drawdown no empeora.

PASS agregado:
- 6/6 activos válidos;
- >=4/6 PASS individuales;
- mediana de reducción de drawdown >=0,5 pp;
- mediana `finalDeltaPctOfContributions >= -0,5%`;
- mediana `wealthEfficiencyRatio >=1`.

No hay grid ni tuning posterior.

## 9. Causalidad

- V5/V7: sólo último `informationDate <= decisionDate`;
- score V11: máximo de ambos scores disponibles hasta esa fecha;
- oportunidad: `PortfolioCandidateGate.apply` reconstruido con el prefijo de precios disponible hasta la fecha;
- ejecución: siguiente apertura;
- los activos blind no participan en la construcción de V5/V7;
- el runner llama primero al unlock de protocolo y sólo después descarga el catálogo blind.

## 10. Guard local — PASS

Ejecutado localmente el **2026-09-07**, antes de abrir el holdout:

- `forwardRiskV11SizingOverlay.unit: PASS`;
- `forwardRiskV11ValidationProtocol.unit: PASS`;
- `forwardRiskV11BlindValidation.unit: PASS`;
- `npm run lint` / `tsc --noEmit: PASS`.

El PASS se registró sin modificar política, fingerprint, sample ni gates.

## 11. Secuencia vigente

1. **COMPLETADO:** guard local V11 PASS.
2. **COMPLETADO:** registrar `localImplementationGates.status = PASS` sin cambiar fingerprint, política, muestra ni gates.
3. Ejecutar desde la app **Forward Risk · V11 · validación blind**.
4. El job vuelve a ejecutar los tres guards + TypeScript antes de abrir los seis históricos.
5. Ejecutar una sola vez el blind histórico local.
6. Registrar PASS / FAIL / INCONCLUSIVE sin retuning; los seis activos quedan consumidos al abrirse.
7. Sólo si PASS, usar confirmación future-forward reservada desde 2026-09-08 antes de cualquier integración productiva.

Nunca usar GitHub Actions, Gemini ni agentes para el cálculo largo.
