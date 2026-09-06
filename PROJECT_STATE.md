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

# Estado vigente — 2026-09-06

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
- **V5: RETIRADO como arquitectura autónoma.** 2011–2026: 7/19 episodios anticipados = 36,84%; lead mediano 58 sesiones; falsa vulnerabilidad 14,62%. Falló el gate congelado de anticipación >=40% y no se ajusta el umbral después.
- **V6: INVESTIGACIÓN ACTIVA.** Divergencia cross-asset label-free: debilidad relativa risk-on + fortaleza defensiva. Gate congelado antes del resultado: anticipación >=50%, lead mediano >=10 sesiones, falsa divergencia <=35%.

V1/V2/V3/V3.1 están retirados del worker automático. El worker debe registrar `RETIRED_FROM_REPLAY_V3_1_ADVERSARIAL_HOLDOUT_FAILED` y no volver a ejecutar esos predictores.

## Validaciones sin tokens de IA
La pantalla principal incluye `ResearchValidationCenter`.

Ruta backend actual: `/api/alerts/research-validation/*`.

Primer job disponible: `forward-risk-v6`.
Ejecuta, en el backend Node de la propia app:
1. guard de arquitectura V6;
2. guard rolling V6;
3. TypeScript (`npm run lint`);
4. rolling anual 2011–2026.

No llama a Gemini ni usa GitHub Actions. La UI consulta el estado por polling y muestra el JSON final.

---

# Datos de mercado y descubrimiento

## Proveedores
- **Yahoo Finance**: proveedor primario para acciones/ETF y búsqueda abierta. Integración no oficial; el backend usa chart/search endpoints con validación y timeouts.
- **EODHD**: secundario para contraste y NAV de fondos por ISIN (`<ISIN>.EUFUND`) cuando `EODHD_API_KEY` está configurada.
- **Alpha Vantage**: contraste secundario cuando `ALPHA_VANTAGE_API_KEY` está configurada.
- La pantalla de validaciones muestra en runtime si EODHD/Alpha tienen API key configurada.

## Limitación histórica localizada y corregida parcialmente
Antes de 2026-09-06, el buscador manual del replay sólo filtraba `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` aunque el texto de UI sugería búsqueda abierta.

Ahora el replay manual puede:
- buscar primero catálogo/descubrimientos previos;
- consultar Yahoo LIVE por nombre, ticker o ISIN;
- validar que el símbolo tiene histórico REAL;
- aceptar sólo instrumentos EUR mientras no exista FX causal explícito;
- registrar el instrumento descubierto localmente y pasarlo al mismo scanner/replay.

El estudio individual ya era más abierto: ticker directo usa Yahoo y un ISIN usa `FundMarketDataService`, que intenta EODHD y resolución Yahoo.

### Pendiente estructural de descubrimiento
La **decisión automática actual y las alarmas backend todavía parten de un catálogo finito** (`EUR_PORTFOLIO_DISCOVERY_UNIVERSE`). No afirmar que se escanea “todo Yahoo”.

Hace falta una capa server-side de descubrimiento/catálogo dinámico compartida por:
- decisión actual;
- alarmas;
- replay;
- estudio/ranking.

No resolver esto añadiendo cientos de tickers hardcodeados.

## CORE
`STRATEGIC_GROWTH_CORE_ASSET_IDS` sigue siendo una lista explícita de cinco IDs broad-market/globales. El selector es dinámico entre los elegibles, pero la **elegibilidad** no lo es.

Pendiente: sustituir la lista cerrada por criterios auditables de `CORE_ELIGIBLE` (índice amplio/diversificado, no sectorial, cobertura/histórico suficiente, divisa controlada, etc.) y después dejar que el selector dinámico elija. No promover cualquier ETF sectorial a core por el mero hecho de seguir un índice.

---

# Producto / web — auditoría 2026-09-06

## Mantener como núcleo
- **Decisión de hoy**: usa la arquitectura actual y debe seguir siendo la respuesta principal.
- **Registrar compra ejecutada**: reconstruye `evaluatePortfolioDecision`, genera `buildPortfolioExecutionPlan` y ejecuta mediante `PortfolioStateExecutionService`; sigue vigente.
- **Mi cartera real / salud de posiciones**: usa `PortfolioPositionHealthService` y la clasificación compartida con replay.
- **Estudio individual**: útil para cualquier ticker y fondos por ISIN; conservar.
- **Replay histórico auditado**: sigue siendo la herramienta histórica principal; no sustituye la decisión live, sirve para validación causal/económica.
- **Alarmas backend**: siguen compartiendo `PortfolioCandidateGate`, consenso/Entry Timing y dedupe de eventos; su universo automático aún debe abrirse.

## Reorganizado
`MarketUtilityDashboard` ahora prioriza:
1. Decisión de hoy.
2. Registrar ejecución si existe una compra pendiente.
3. Cartera real.
4. Seguimiento operativo e historial (plegado).
5. Explicación/consenso/plan operativo (plegado).

El antiguo panel visible `Forward Risk Forecast V1` fue retirado de `decisionMain.tsx` y sustituido por `ResearchValidationCenter`.

## Útil pero secundario / candidato a simplificación posterior
- “V1 PILOT · control operativo”: su lógica sigue vigente porque usa `evaluatePortfolioDecision`, pero el nombre y la prominencia estaban obsoletos; queda como historial/seguimiento secundario.
- “Ranking técnico completo y métricas auxiliares”: aporta diagnóstico, pero se solapa con el ranking del estudio; candidato a fusionar en una única tabla avanzada.
- “Cobertura y proveedores” y “Datos y controles técnicos”: útiles para diagnóstico, no para la decisión principal; mantener plegados y consolidar en un único bloque técnico.

## Guard corregido
`tests/decisionArchitectureParity.unit.ts` estaba desactualizado y exigía que el worker siguiera ejecutando Forward Risk V1. Se actualizó para proteger el estado real: V1–V3.1 retirados del replay y `ResearchValidationCenter` como superficie de investigación.

---

# Alertas / persistencia
- Dedupe durable en Firestore cuando Firebase está configurado.
- Webhook/Telegram fallido no marca el evento como entregado.
- EODHD/Alpha son secundarios y no deben bloquear Yahoo.
- Para autonomía real de WATCH/REDUCE/EXIT con la app cerrada, el backend debe reconstruir la cartera privada por UID y usar la misma clasificación compartida; no crear otro motor.

---

# Próxima secuencia
1. Recargar/sincronizar la app y ejecutar V6 desde **Validaciones de investigación -> Ejecutar sin IA**.
2. Leer el resultado V6 sin volver a AI Studio como agente.
3. Completar `OPEN_MARKET_DISCOVERY_V1` server-side para que live + alertas no dependan del catálogo finito.
4. Diseñar `CORE_ELIGIBILITY_V2` semántico/auditable sin cambiar todavía la política productiva hasta validarlo.
5. Fusionar ranking técnico/cobertura/controles en una única sección avanzada y seguir simplificando la jerarquía visual.
