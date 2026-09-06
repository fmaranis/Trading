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

No reintroducir la salida reactiva tardía del core.

## Forward Risk — decisiones congeladas
- **V3.1: RETIRADO.** No V3.2 ni tuning de ventanas usadas.
- **V4: RESEARCH_ONLY.** Dirección razonable, anticipación insuficiente.
- **V5: RETIRADO como arquitectura autónoma.** 7/19 episodios = 36,84%; lead 58; falsa vulnerabilidad 14,62%. Se conserva sólo su señal congelada `>=80` para V8.
- **V6: RETIRADO.** 2/19 = 10,53%; lead 43,5; falsa divergencia 5,51%. No V6.1.
- **V7: RETIRADO.** 6/19 = 31,58%; lead 43; falsa señal 7,35%. Sí anticipó COVID con 17 sesiones. Se conserva sólo su señal congelada `>=80` para V8.
- **V8: COMPLEMENTARIEDAD ENCONTRADA, NO PROMOVIDA.** `V5 >=80 OR V7 >=80`, sin pesos ni retuning. Rolling 2011–2026: **11/19 episodios = 57,89%**, lead mediano **52 sesiones**, falsa señal **19,06%**. Desglose: **5 episodios sólo V5, 4 sólo V7, 2 ambos**. Veredicto `V8_COMPLEMENTARITY_SIGNAL_FOUND_REQUIRES_INDEPENDENT_CONFIRMATION`.

V8 supera el gate diagnóstico congelado (anticipación >=50%, lead >=10, falsa señal <=35%), pero se diseñó después de observar V5/V7 sobre 2011–2026. Por tanto no puede pasar directamente a gate económico ni producción.

V1/V2/V3/V3.1 están retirados del worker automático. V4/V5/V6/V7/V8 no alimentan decisiones productivas.

## Confirmación independiente V8 — activa
Se añadió una confirmación **cross-benchmark**, no un nuevo predictor:
- señales V8 congeladas exactamente igual: `V5 >=80 OR V7 >=80`;
- outcomes medidos sobre seis instrumentos `GLOBAL_EQUITY` de `EUR_VALIDATION_HOLDOUT_UNIVERSE` que no generan la señal:
  - `HOLDOUT_XDEM`
  - `HOLDOUT_XDEV`
  - `HOLDOUT_XDEQ`
  - `HOLDOUT_XDEB`
  - `HOLDOUT_IS3R`
  - `HOLDOUT_IS3S`
- evento: drawdown >=5%; ventana pre-pico 63 sesiones;
- gate congelado antes del resultado: al menos 3 benchmarks válidos, anticipación agregada >=50%, lead mediano >=10 sesiones, falsa señal <=35%.

Un PASS aquí significa sólo **confirmación de transferencia a outcomes independientes**. No es holdout temporal. FRED current-vintage de V5 sigue impidiendo promoción/economic gate hasta reconstrucción point-in-time/vintage-safe.

Archivos:
- `scripts/forwardRiskV8BenchmarkTransferLive.ts`
- `tests/forwardRiskV8BenchmarkTransfer.unit.ts`

---

# Validaciones sin tokens de IA
La pantalla incluye `ResearchValidationCenter`.

Ruta backend: `/api/alerts/research-validation/*`.

Job automático vigente: `forward-risk-v8-transfer`.
Ejecuta:
1. guard transferencia V8;
2. TypeScript (`npm run lint`);
3. transferencia V8 a benchmarks holdout.

Los jobs V6/V7/V8 originales dejan de mostrarse para evitar repetir gates ya resueltos. Sus scripts quedan en Git para reproducibilidad.

No llama a Gemini ni usa GitHub Actions.

---

# Datos de mercado y descubrimiento

## Proveedores
- **Yahoo Finance**: primario para acciones/ETF y búsqueda abierta.
- **EODHD**: secundario para contraste y NAV de fondos por ISIN si hay API key.
- **Alpha Vantage**: contraste secundario si hay API key.
- **Cboe**: históricos VIX/VIX9D/VVIX de V7/V8.
- **FRED current-vintage**: V5/V8; no point-in-time safe.

## Replay manual abierto
El replay manual puede buscar Yahoo LIVE por nombre/ticker/ISIN, validar histórico REAL y registrar instrumentos dinámicos EUR. El estudio individual acepta ticker directo y fondos/ISIN mediante `FundMarketDataService`.

### Pendiente estructural de descubrimiento
La decisión automática y las alarmas backend todavía parten de `EUR_PORTFOLIO_DISCOVERY_UNIVERSE`; aún no escanean todo Yahoo. Pendiente `OPEN_MARKET_DISCOVERY_V1` server-side compartido.

## CORE
`STRATEGIC_GROWTH_CORE_ASSET_IDS` sigue siendo una lista explícita. Pendiente `CORE_ELIGIBILITY_V2` con criterios auditables de índice amplio/diversificado, no sectorial, histórico suficiente y divisa controlada.

---

# Producto / web

## Mantener como núcleo
- Decisión de hoy.
- Registrar compra ejecutada.
- Mi cartera real / salud de posiciones.
- Estudio individual.
- Replay histórico auditado.
- Alarmas backend.

## Reorganizado
`MarketUtilityDashboard` prioriza:
1. Decisión de hoy.
2. Registrar ejecución si existe compra pendiente.
3. Cartera real.
4. Seguimiento operativo e historial (plegado).
5. Explicación/consenso/plan operativo (plegado).

El antiguo panel Forward Risk V1 fue retirado y sustituido por `ResearchValidationCenter`.

## Pendiente de simplificación
- fusionar ranking técnico con ranking del estudio;
- consolidar cobertura/proveedores + controles técnicos en un único bloque avanzado.

---

# Alertas / persistencia
- Dedupe durable en Firestore cuando Firebase está configurado.
- Webhook/Telegram fallido no marca evento como entregado.
- EODHD/Alpha son secundarios y no bloquean Yahoo.
- Para autonomía WATCH/REDUCE/EXIT con app cerrada, backend debe reconstruir cartera privada por UID y usar clasificación compartida.

---

# Próxima secuencia
1. Ejecutar `Forward Risk V8 · confirmación en benchmarks holdout` desde `Validaciones de investigación -> Ejecutar sin IA`.
2. Si falla, no promover V8. Si pasa, seguir bloqueando producción/economic gate hasta resolver FRED point-in-time/vintage-safe y decidir una confirmación temporal futura o equivalente.
3. Completar `OPEN_MARKET_DISCOVERY_V1`.
4. Diseñar `CORE_ELIGIBILITY_V2`.
5. Seguir simplificando UI/ranking/controles.
