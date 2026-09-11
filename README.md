# Custodia / Trading

Aplicación de decisión y seguimiento de inversión con arquitectura productiva integrada, replay histórico causal y herramientas de investigación separadas de la decisión operativa.

La fuente de verdad es `fmaranis/Trading/main`.

## Documentos de entrada

Para entender el estado actual sin depender de chats antiguos:

1. `PROJECT_STATE.md` — estado técnico actual y siguiente paso.
2. `docs/APP_FLOW_AND_ROADMAP.md` — diagrama maestro y ruta de cierre.
3. `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md` — reglas normativas de discovery/Top64.
4. `docs/DECISIONS.md` — decisiones durables históricas, subordinadas al código y al estado canónico vigente cuando hayan quedado superadas.

## Qué hace la app

La cadena productiva vigente es:

```text
mercado actual REAL
→ AssetUniverseScanner
→ Top64 dinámico
→ PortfolioCandidateGate
→ InvestmentDecisionEngine
→ PortfolioDecisionEngine / evaluatePortfolioDecision
→ CORE_GATE_V1
→ CORE_ARCHITECTURE_V1
→ plan ejecutable único
→ costes / broker / fiscalidad
→ COMPRAR / VENDER / TRASPASAR / REVIEW / NO HACER NADA
→ registro y seguimiento
```

La shortlist de 64 es dinámica. No existe una whitelist productiva fija de 64 nombres ni un universo productivo limitado a los cinco ETFs del prototipo inicial.

La producción mantiene actualmente allocation/opportunity `LEGACY`; `CORE_ELIGIBILITY_V2` y otras políticas de research no adquieren autoridad productiva sin evidencia fresh suficiente.

## Rutas principales

- `/` — superficie canónica de decisión y seguimiento.
- `/portfolio.html` — laboratorio cuantitativo sin autoridad para emitir una recomendación productiva alternativa.
- `/legacy.html` — no carga el producto antiguo; redirige a `/`.

## Replay histórico

El replay existente mantiene integrados:

- `Desde cero / manual / cartera actual`;
- `Motor Custodia / mantener cartera`;
- `DAILY / WEEKLY / MONTHLY / QUARTERLY` como frecuencia de decisión;
- ejecución causal posterior a señal / `NEXT_OPEN` cuando corresponde;
- cash histórico BCE;
- fiscalidad;
- `externalCashFlows` explícitos y fechados;
- benchmarks y métricas ajustadas por flujos.

Yahoo current discovery no se usa para reconstruir retrospectivamente un universo histórico. Persiste una limitación de survivorship mientras no exista un instrument master point-in-time con listings/delistings.

## Datos

La procedencia se etiqueta explícitamente como:

- `REAL`;
- `STATIC_REFERENCE`;
- `SYNTHETIC`.

Una validación que exige datos REAL debe fallar si aparece información sintética. Yahoo Finance es la fuente principal current/live e histórica para acciones/ETF dentro del motor EUR; otros proveedores pueden aportar evidencia secundaria, sin fallback sintético silencioso.

## Usuario, persistencia y despliegue

La capa privada está documentada en `docs/PRIVATE_USERS_DEPLOYMENT.md` e incluye Firebase Authentication, Firestore por UID, administración mediante custom claims y aislamiento de estado entre usuarios.

La app sigue siendo de ejecución **manual/asistida**: construye planes y permite registrar operaciones, pero no existe una integración broker que coloque órdenes automáticamente.

Las alertas de entrada y su persistencia están integradas; el cierre de autonomía 24/7 para `WATCH / REDUCE / EXIT` forma parte de la ruta de trabajo definida en `docs/APP_FLOW_AND_ROADMAP.md`.

## Validación

Los replays y validaciones largas se ejecutan en el motor local/backend de la propia aplicación. No se utilizan GitHub Actions para estos cálculos.

El estado exacto de guards, tests, Future Forward y trabajos pendientes se mantiene en `PROJECT_STATE.md`.

## Alcance

La aplicación es una herramienta de decisión, seguimiento e investigación. No garantiza rentabilidad ni sustituye asesoramiento financiero personalizado. La validación técnica de una superficie no equivale por sí sola a demostrar ventaja económica de una política de inversión.