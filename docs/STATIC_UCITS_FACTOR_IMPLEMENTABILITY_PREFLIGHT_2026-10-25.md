# Custodia — comprobación de ejecutabilidad de una cartera UCITS factorial

**25 de octubre de 2026 — PRE-FLIGHT PARCIAL / NO APTO AÚN PARA BACKTEST ECONÓMICO NI PROMOCIÓN**

**Objetivo:** responder si una construcción *estática y operable* de ETFs globales Quality, Momentum y Value merece enfrentarse a mantener EUNL, con el mismo capital y flujos, costes, fiscalidad y riesgo. No estudiar otra señal/ranking de acciones. Mantener producción `LEGACY`, aplicación web y motor/replay únicos `CORE_ARCHITECTURE_V1`.

Manifest reproducible de hechos, fuentes y gates: `validation-runs/diagnostics/static-ucits-factor-implementability-preflight-2026-10-25.json`. Expedientes ya consumidos: `docs/INVESTMENT_EDGE_RESEARCH_LEDGER_AND_NEXT_GATE_2026-10-25.md` y `PROJECT_STATE.md`.

## 1. Identidades verificadas con páginas públicas

| Papel | ISIN / cotización Xetra EUR | Método económico actual | Lanzamiento / TER |
| --- | --- | --- | --- |
| Indexación control | EUNL.DE · IE00B4L5Y983 | MSCI World (iShares Core, acumulación) | 2009-09-25 · 0,20% |
| Momentum | XDEM.DE · IE00BL25JP72 | MSCI World Momentum (Xtrackers, acumulación) | 2014-09-05 · 0,25% |
| Quality | XDEQ.DE · IE00BL25JL35 | **MSCI World Sector Neutral Quality**, no MSCI World Quality estándar | 2014-09-11 · 0,25% |
| Value | XDEV.DE · IE00BL25JM42 | **MSCI World Enhanced Value**, no factor value genérico | 2014-09-11 · 0,25% |

Fuentes: emisores [XDEM](https://etf.dws.com/en-gb/IE00BL25JP72-msci-world-momentum-ucits-etf-1c/), [XDEQ](https://etf.dws.com/en/IE00BL25JL35-msci-world-quality-ucits-etf-1c/), [XDEV](https://etf.dws.com/en/IE00BL25JM42-msci-world-value-ucits-etf-1c/), [ficha EUNL](https://www.justetf.com/en/etf-profile.html?isin=IE00B4L5Y983), [cotización XDEM](https://www.justetf.com/es/etf-profile.html?isin=IE00BL25JP72), [XDEQ](https://www.justetf.com/en-es/etf-profile.html?isin=IE00BL25JL35), [XDEV](https://www.justetf.com/en/etf-profile.html?isin=IE00BL25JM42). El catálogo del proyecto ya registra los cuatro tickers/roles; **no crear otro universo ni cambiar producción**.

Los fondos subyacentes tienen divisa base USD; la **cotización Xetra EUR** no elimina exposición cambiaria. Las cuatro posiciones están expuestas a **renta variable desarrollada**, con riesgo de caída conjunta; cuatro ISINs no equivalen a diversificación de clases de activo.

### Hallazgo crítico: tres cambios de benchmark simultáneos

El **3 de noviembre de 2016**, DWS cambió el índice seguido por **los tres**, no sólo Value:
- XDEM: DB Equity Momentum Factor -> MSCI World Momentum;
- XDEQ: DB Equity Quality Factor -> MSCI World Sector Neutral Quality;
- XDEV: DB Equity Value Factor -> MSCI World Enhanced Value.

Esto aparece explícitamente en las páginas/fichas del **emisor** anteriores. La afirmación anterior del proyecto de que únicamente XDEV había cambiado estaba incompleta.

**Regla causal de admisibilidad:** para probar los índices *actuales*, tomar como comienzo **la primera sesión común real de Xetra estrictamente posterior a 2016-11-03**, tras verificar que existe `REAL` ajustada para los cuatro instrumentos. Pre-2016 no tiene la misma metodología aunque el ETF existiera; sin backfill retrospectivo de índices actuales. No asumir automáticamente que 2016-11-04 fue una sesión negociable común sin leer el calendario/series. La comparación exploratoria 2014–2025 de índices Quality+Momentum al 50/50 ya inspeccionada no es el resultado de estos vehículos ni la política de tres factores.

## 2. Costes, negociación y fiscalidad verificables

**MyInvestor, página pública del bróker (consulta 2026-10-25):**

- Mercados soportados incluyen **XTR / Xetra Alemania**. Eso NO confirma aún la **habilitación de los cuatro ISINs concretos**, existencia de KID para el cliente o que estén operables ahora en su catálogo.
- Comisión publicada ETF: **0,12%** por compraventa, **mínimo 1 EUR / máximo 25 EUR por orden**, más cánones ajenos y spread efectivo; custodia y mantenimiento publicados 0 EUR.
- Conversión divisa publicada **0,30%**, sólo si la operación requiere cambio de divisa. Comprar una cotización Xetra en EUR no autoriza cargar un 0,30% automático; sin embargo, el subyacente conserva riesgo de tipo de cambio.
- La política del repo `MYINVESTOR_BROKER_PROFILE` coincide en 0,12%, 1/25 EUR, FX 0,30% y títulos enteros. El replay tiene comisiones y filtros de órdenes, pero no equivale por sí solo a verificar acceso individual a ISIN, spreads históricos ni cargos completos de terceros.

Fuente [MyInvestor — bróker](https://myinvestor.es/inversion/broker/) y [preguntas frecuentes](https://myinvestor.es/ayuda/preguntas-frecuentes/inversion/).

Costes orientativos **únicamente para explicar el impacto del mínimo**, si cada ETF recibiese un tercio del capital, sin spread, acciones fraccionarias ni ajuste de títulos:

- Con **500 EUR**: tres órdenes factoriales de 1 EUR = 3 EUR; una orden EUNL de 1 EUR; **2 EUR adicionales de comisión inicial** (0,40% del capital). Puede que alguno de los tres títulos no sea comprable con su asignación: pendientes precios reales.
- Con **13.000 EUR**: las tres órdenes factoriales al 0,12% sumarían ~15,60 EUR; comprar sólo EUNL al 0,12% también ~15,60 EUR. **No hay una penalización fija de 2 EUR en este tamaño**; sí spreads, redondeo a títulos enteros, posibles comisiones ajenas y mayor complejidad.

TER anual 0,25% frente a 0,20% EUNL: en rentabilidades/NAV realizados **los gastos internos ya se reflejan**; no descontar nuevamente TER al calcular rentabilidad ni confundir diferencia de coste con exceso de retorno esperado.

**España (CNMV, guía enero 2026):** las ganancias al vender ETFs tributan como ganancias patrimoniales y **los ETFs no acceden al diferimiento fiscal por traspaso** de fondos tradicionales elegibles. Buy-and-hold sin ventas periódicas minimiza hechos imponibles intermedios, pero una liquidación final y los flujos retirados deben tratarse en ambos brazos de modo compatible. Comparador principal **EUNL ETF**, no simular sin ajustes los privilegios fiscales de traspasos de un fondo mutualista como Vanguard. Fuente oficial [CNMV fiscalidad IRPF 2026](https://www.cnmv.es/DocPortal/Publicaciones/Guias/FiscalidadFondosDeInversionEnElIRPF.pdf).

## 3. Resultado del preflight y criterio de parada

| Guard | Estado | Motivo |
| --- | --- | --- |
| Identidad UCITS, cuatro ISIN, índice vigente, comisión de gestión | **PASS documental** | Gestoras, fichas, listado Xetra |
| Mercado Xetra y comisión general MyInvestor | **PASS documental** | Publicado por el bróker |
| Histórico 2014–2016 comparable con índices actuales | **FAIL** | Los tres factores cambiaron benchmark el 2016-11-03 |
| Acceso concreto al broker por los 4 ISIN | **NO VERIFICADO** | Mercados genéricos no garantizan catálogo |
| Serie diaria `REAL` común Xetra EUR con adjusted/raw, eventos corporativos, reconciliación NAV | **NO VERIFICADO** | No se ha descargado/auditado la serie original en el backend de Custodia |
| Capital/títulos enteros, spread y solapamiento accionarial real | **NO VERIFICADO** | Requiere precios/holdings y capital definido |
| Rentabilidad superior a EUNL, riesgos, fiscalidad y frecuencia de éxito | **NO CALCULADO** | No abrir economía antes de superar los guards |

**Veredicto: `PARTIAL_PREFLIGHT_BLOCKED_BEFORE_ECONOMIC_DATA`**. La idea parece operable *en principio* a través de ETFs UCITS disponibles en Xetra, pero **NO está demostrado que pueda comprarse esta cesta en concreto en MyInvestor ni que supere una indexación global**. Tampoco permite afirmar que proteja frente a un desplome.

## 4. Siguiente tarea técnica precisa, sin crear otro motor ni pantalla

En el **backend de datos real ya existente** de la app, obtener una **única captura limitada y auditada** de `EUNL.DE`, `XDEM.DE`, `XDEQ.DE`, `XDEV.DE`, sin mirar todavía rentabilidades agregadas para seleccionar retrospectivamente otra cartera:

1. Confirmar ISIN y cambio de benchmark, primera sesión Xetra común tras 2016-11-03, `REAL` por símbolo/fecha y `rawOpen/rawClose/adjustedClose` consistentes, huecos, splits y NAV issuer. Hacer fail-closed si falta historia/identidad/currency; **nunca synthetic fallback**. Preservar provenance y versión/hash raw.
2. Verificar si el bróker permite operar **estos cuatro ISINs**. Si no puede verificarse mediante datos disponibles en la app o fuente pública, dejarlo `UNVERIFIED`, sin pedir claves al usuario.
3. Comprobar solapamiento real: exposición USA/mega-caps, sectores y 100% equities; no atribuir diversificación anticrash sin prueba.
4. **Sólo si PASS** congelar **una sola** propuesta de cartera estática, pesos y convenio de ejecución antes de abrir outcomes económicos, sin grid ni rescate paramétrico. Benchmark: EUNL 100% con mismos `externalCashFlows`, costes, cash e impuestos; ambos en euros y `NEXT_OPEN`/compras causales. No usar una muestra ya consumida para promoción.
5. Ejecutar el estudio de implementación neta **en el replay canónico** desde el `ResearchValidationCenter`, tras pasar guards/TypeScript. Capitales pequeños y medianos deben valorar si se pueden adquirir títulos enteros; el 80% de años ganadores es objetivo informativo, no conclusión. Identificar una ventana fresh o continuar prospectivo/shadow tras congelar la política.

**Alcance de esta entrega:** investigación documental + preflight machine-readable guardado. Ningún job largo, Yahoo histórico, benchmark económico, tests Node/tsc o cambio a `LEGACY` ejecutado. No se creó menú, motor paralelo, parámetro de trading ni tarjeta nueva. Se preservan íntegramente los FAIL de investigaciones previas y se evita refit sobre ventanas consumidas.
