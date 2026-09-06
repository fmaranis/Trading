# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`. Leer este archivo primero al retomar el proyecto. El detalle histórico permanece en Git; este documento contiene sólo el estado vigente.

## Reglas no negociables
- Nunca usar GitHub Actions para replays o validaciones largas.
- ChatGPT modifica `main`; los cálculos pesados los ejecuta el motor de la propia app/backend, no un agente consumiendo tokens.
- AI Studio se usa como entorno/preview, no como terminal asistida para lanzar cálculos repetitivos.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; sin lookahead.
- No recalibrar thresholds sobre ventanas ya usadas para decidir si una arquitectura pasa o falla.
- No crear motores paralelos: decisión actual, replay y alertas deben compartir scanner, gates y políticas productivas.
- Ningún dato financiero privado de un usuario se embebe en código público.

---

# Estado vigente — 2026-09-07

## Motor productivo
La arquitectura productiva cerrada sigue siendo `CORE_ARCHITECTURE_V1`.

Flujo live principal:
`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> evaluatePortfolioDecision -> ejecución/seguimiento`.

Replay auditado:
- usa el mismo `PortfolioCandidateGate` e `InvestmentDecisionEngine`;
- usa `classifyPositionHealth` compartido con cartera real;
- `Desde cero / manual / cartera actual` y `Motor Custodia / mantener cartera` pertenecen al mismo replay;
- cash histórico y fiscalidad siguen integrados;
- Forward Risk no modifica el replay productivo.

No reintroducir la salida reactiva tardía del core: la regresión COVID mostró que eliminarla restauró aproximadamente +7,04% frente a +7,52% del hold exacto y mejoró drawdown frente al core.

## Forward Risk — decisiones congeladas
- **V3.1: RETIRADO.** Adversarial holdout: mediana AUC20 ≈0,486, orientación DIRECT ≈33%, falsos positivos ≈91,9%. No V3.2 ni tuning de las mismas ventanas.
- **V4: RESEARCH_ONLY.** Mejor dirección (mediana AUC ≈0,599; DIRECT ≈66,7%) pero sólo 2/45 episodios anticipados. Es confirmación/reactividad, no predictor temprano.
- **V5: RETIRADO como arquitectura autónoma.** 2011–2026: 7/19 episodios anticipados = 36,84%; lead mediano 58 sesiones; falsa vulnerabilidad 14,62%. Falló el gate congelado de anticipación >=40%. Sus señales congeladas se conservan sólo para diagnóstico de complementariedad V8.
- **V6: RETIRADO.** Rolling anual 2011–2026: 2/19 episodios anticipados = 10,53%; lead mediano 43,5 sesiones; falsa divergencia 5,51%. Veredicto `RETIRE_V6_CROSS_ASSET_ARCHITECTURE`. No V6.1.
- **V7: RETIRADO.** Rolling anual 2011–2026 con Cboe VIX/VIX9D/VVIX: 6/19 episodios anticipados = 31,58%; lead mediano 43 sesiones; falsa señal 7,35%; 5 años pasan el gate individual. Sí anticipó COVID 2020 con 17 sesiones, pero falló el gate agregado de anticipación >=50%. Veredicto `RETIRE_V7_OPTIONS_IMPLIED_ARCHITECTURE`. No V7.1.
- **V8: DIAGNÓSTICO DE COMPLEMENTARIEDAD ACTIVO.** No ajusta un predictor nuevo. Une únicamente las señales ya congeladas `V5 >=80 OR V7 >=80` para comprobar si cubren episodios distintos. Gate diagnóstico: anticipación >=50%, lead mediano >=10 sesiones, falsa señal <=35%.

V1/V2/V3/V3.1 están retirados del worker automático. V4/V5/V6/V7/V8 no alimentan decisiones productivas. El worker debe registrar `RETIRED_FROM_REPLAY_V3_1_ADVERSARIAL_HOLDOUT_FAILED` y no volver a ejecutar esos predictores.

## V8 · complementariedad V5 + V7
Archivos principales:
- `src/investment/decision/forwardRiskComplementarityV8.ts`
- `scripts/forwardRiskComplementarityV8RollingLive.ts`
- `tests/forwardRiskComplementarityV8.unit.ts`
- `tests/forwardRiskComplementarityV8Rolling.unit.ts`

Reglas congeladas:
- señal V5: vulnerabilidad >=80, sin modificar V5;
- señal V7: options-implied score >=80, sin modificar V7;
- V8 = OR de ambas señales, sin pesos ni fitted coefficients;
- ventana pre-pico 63 sesiones;
- gate diagnóstico igual al de V7: anticipación >=50%, lead >=10, falsa señal <=35%.

Importante: V8 se diseñó **después** de observar V5 y V7 sobre 2011–2026. Por tanto, aunque pasara el gate, no puede avanzar directamente a un gate económico ni producción. Necesita confirmación independiente; además V5 usa FRED current-vintage y exigiría reconstrucción point-in-time/vintage-safe.

---

# Validaciones sin tokens de IA
La pantalla principal incluye `ResearchValidationCenter`.

Ruta backend: `/api/alerts/research-validation/*`.

Job automático vigente: `forward-risk-v8`.
Ejecuta en el backend Node de la propia app:
1. guard arquitectura V8;
2. guard rolling V8;
3. TypeScript (`npm run lint`);
4. rolling anual 2011–2026.

V6 y V7 ya no aparecen como jobs ejecutables para evitar repetir arquitecturas retiradas. Sus scripts permanecen en Git sólo para reproducibilidad histórica.

No llama a Gemini ni usa GitHub Actions. La UI consulta el estado por polling y muestra el JSON final.

---

# Datos de mercado y descubrimiento

## Proveedores
- **Yahoo Finance**: proveedor primario para acciones/ETF y búsqueda abierta. Integración no oficial; el backend usa chart/search endpoints con validación y timeouts.
- **EODHD**: secundario para contraste y NAV de fondos por ISIN (`<ISIN>.EUFUND`) cuando `EODHD_API_KEY` está configurada.
- **Alpha Vantage**: contraste secundario cuando `ALPHA_VANTAGE_API_KEY` está configurada.
- **Cboe**: fuente oficial de históricos VIX/VIX9D/VVIX usados por V7 y reutilizados congelados en V8.
- **FRED current-vintage**: V5; no es point-in-time safe y no puede sustentar promoción sin retest vintage-safe.
- La pantalla de validaciones muestra en runtime si EODHD/Alpha tienen API key configurada.

## Replay manual abierto
El replay manual puede:
- buscar primero catálogo/descubrimientos previos;
- consultar Yahoo LIVE por nombre, ticker o ISIN;
- validar histórico REAL;
- aceptar sólo instrumentos EUR mientras no exista FX causal explícito;
- registrar el instrumento descubierto localmente y pasarlo al mismo scanner/replay.

El estudio individual acepta ticker directo por Yahoo y fondos/ISIN mediante `FundMarketDataService`, que intenta EODHD y resolución Yahoo.

### Pendiente estructural de descubrimiento
La **decisión automática actual y las alarmas backend todavía parten de un catálogo finito** (`EUR_PORTFOLIO_DISCOVERY_UNIVERSE`). No afirmar que se escanea “todo Yahoo”.

Hace falta `OPEN_MARKET_DISCOVERY_V1` server-side compartido por decisión actual, alarmas, replay y estudio/ranking. No resolver añadiendo cientos de tickers hardcodeados.

## CORE
`STRATEGIC_GROWTH_CORE_ASSET_IDS` sigue siendo una lista explícita de cinco IDs broad-market/globales. El selector es dinámico entre los elegibles, pero la elegibilidad no lo es.

Pendiente: `CORE_ELIGIBILITY_V2` con criterios auditables de índice amplio/diversificado, no sectorial, cobertura/histórico suficiente y divisa controlada; después el selector dinámico elige. No promover cualquier ETF sectorial por seguir un índice.

---

# Producto / web — auditoría vigente

## Mantener como núcleo
- **Decisión de hoy**: usa la arquitectura actual y debe seguir siendo la respuesta principal.
- **Registrar compra ejecutada**: reconstruye `evaluatePortfolioDecision`, genera `buildPortfolioExecutionPlan` y ejecuta mediante `PortfolioStateExecutionService`.
- **Mi cartera real / salud de posiciones**: usa `PortfolioPositionHealthService` y clasificación compartida con replay.
- **Estudio individual**: útil para ticker/ISIN; conservar.
- **Replay histórico auditado**: herramienta histórica principal para validación causal/económica.
- **Alarmas backend**: comparten `PortfolioCandidateGate`, consenso/Entry Timing y dedupe; su universo automático aún debe abrirse.

## Reorganizado
`MarketUtilityDashboard` prioriza:
1. Decisión de hoy.
2. Registrar ejecución si existe compra pendiente.
3. Cartera real.
4. Seguimiento operativo e historial (plegado).
5. Explicación/consenso/plan operativo (plegado).

El antiguo panel `Forward Risk Forecast V1` fue retirado y sustituido por `ResearchValidationCenter`.

## Útil pero secundario / candidato a simplificación
- “V1 PILOT · control operativo”: lógica vigente pero presentación secundaria; queda como historial/seguimiento.
- “Ranking técnico completo y métricas auxiliares”: se solapa con el ranking del estudio; candidato a fusión.
- “Cobertura y proveedores” + “Datos y controles técnicos”: útiles para diagnóstico; consolidar en un bloque avanzado.

---

# Alertas / persistencia
- Dedupe durable en Firestore cuando Firebase está configurado.
- Webhook/Telegram fallido no marca evento como entregado.
- EODHD/Alpha son secundarios y no bloquean Yahoo.
- Para autonomía real WATCH/REDUCE/EXIT con app cerrada, backend debe reconstruir cartera privada por UID y usar clasificación compartida; no crear otro motor.

---

# Próxima secuencia
1. Sincronizar/recargar `main` y ejecutar **Forward Risk V8** desde `Validaciones de investigación -> Ejecutar sin IA`.
2. Si V8 falla, retirar definitivamente la vía V5+V7 y cambiar de familia de información. Si V8 pasa, no ejecutar todavía contrafactual económico: primero diseñar confirmación independiente y resolver vintage-safe de V5.
3. Completar `OPEN_MARKET_DISCOVERY_V1` server-side.
4. Diseñar `CORE_ELIGIBILITY_V2` auditable.
5. Fusionar ranking técnico/cobertura/controles y continuar simplificación visual.
