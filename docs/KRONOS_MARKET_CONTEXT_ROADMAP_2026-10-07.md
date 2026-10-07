# KRONOS_MARKET_CONTEXT_V1 — hoja de ruta

Fecha de congelación: 2026-10-07  
Estado: RESEARCH-ONLY / SHADOW / NO PRODUCTION AUTHORITY

## Objetivo

Evaluar Kronos como modelo especializado en K-lines/OHLCV y determinar si aporta señal causal útil para:

1. dirección y pendiente futura a 20/60 sesiones;
2. ranking de activos;
3. contexto/timing de candidatos ya elegibles por la arquitectura existente;
4. confirmación prospectiva de PEAD;
5. comparación directa con TimesFM, momentum y core.

Kronos NO crea un motor de decisión paralelo y no modifica producción. Producción permanece LEGACY.

## Fuente y pins

Repositorio oficial: shiyu-coder/Kronos  
Licencia: MIT  
Código pinneado: 67b630e67f6a18c9e9be918d9b4337c960db1e9a

Modelo inicial:
- NeoQuasar/Kronos-small
- 24.7M parámetros
- max_context = 512
- revision = 901c26c1332695a2a8f243eb2f37243a37bea320
- model.safetensors SHA256 = b082dfcbd8e8c142a725c8bbb99781802f38fec81210e13479effb32b3c3e020

Tokenizer:
- NeoQuasar/Kronos-Tokenizer-base
- revision = 0e0117387f39004a9016484a186a908917e22426
- model.safetensors SHA256 = 59d85f6af76a2c3b8240ea06cb21db4213b4eeca053f246b23e29cf832fc6bee

## Riesgo metodológico: cutoff de pretraining desconocido

No existe en la documentación pública revisada un cutoff temporal verificable del corpus de pretraining.
Existe una issue pública del repositorio solicitando esa aclaración.

Consecuencia:
- backtests históricos con Kronos pueden tener contaminación de pretraining;
- cualquier comparación histórica Kronos vs TimesFM es DIAGNÓSTICA/DESCRIPTIVA;
- no puede promocionar política;
- la primera evidencia válida para promoción será fresh/prospective posterior a este freeze.

## Stage A — smoke técnico

Sin Yahoo, sin precios reales, sin outcomes.

Debe probar:
- Python/runtime aislado;
- código oficial pinneado y blobs verificados;
- pesos/modelo/tokenizer pinneados y SHA256 verificados;
- inferencia Kronos-small en CPU/GPU disponible;
- OHLCV sintético -> forecast OHLCV;
- sampling estocástico reproducible con seed;
- múltiples trayectorias individuales, sin promediarlas antes de medir probabilidad;
- cálculo de P(return>0) y P(slope(log-close)>0);
- productionAuthority=false.

Stage A PASS sólo autoriza Stage B.

## Stage B — benchmark histórico descriptivo

Muestra: reutilizar exactamente anchors ya consumidos por TimesFM cuando sea posible para comparación apples-to-apples.
No se abre un holdout nuevo para diseñar thresholds.

Inputs:
- Yahoo REAL OHLCV causal hasta informationDate;
- contexto 512;
- horizontes 20 y 60 sesiones;
- T=1.0, top_p=0.9, top_k=0;
- 20 trayectorias por asset/anchor con seeds deterministas.

Outputs congelados:
- expected/median return 20/60;
- P(return20>0), P(return60>0);
- P(slope20>0), P(slope60>0);
- median forecast slope;
- RankIC cross-sectional 20/60;
- directional accuracy;
- Brier score de probabilidad de subida;
- calibración;
- comparación con TimesFM y momentum.

Interpretación: descriptiva únicamente por cutoff de pretraining desconocido.

## Stage C — evidencia prospectiva W42+

Primera semana elegible: 2026-10-12.

No crear un segundo motor económico.
Tras PASS de Stage A/B técnico, Kronos se incorpora como brazo shadow al collector prospectivo semanal existente.

Se registrará antes de outcomes:
- forecast central 20/60;
- P(return>0);
- P(slope>0);
- dispersión de trayectorias;
- metadata/model pins.

No backfill. No retuning tras abrir el collector.

## Stage D — PEAD + Kronos

PEAD Source Audit R3 y PEAD_ANALYST_SURPRISE_V1 no se alteran.

La muestra histórica PEAD 2024 NO puede validar Kronos por cutoff de pretraining desconocido.

La hipótesis prospectiva futura será:
- señal primaria: Surprise(%);
- contexto shadow: Kronos P(slope60>0) y P(return60>0);
- medir complementarity sin cambiar eligibility PEAD.

No se fijará ningún threshold económico posthoc. Primero se recopila evidencia prospectiva.

## Stage E — integración de producto

Sólo si la evidencia prospectiva lo justifica:
AssetUniverseScanner
-> PortfolioCandidateGate
-> InvestmentDecisionEngine (Kronos context/shadow)
-> PortfolioDecisionEngine/evaluatePortfolioDecision
-> ejecución/seguimiento

Kronos podrá aportar contexto de:
- dirección;
- pendiente;
- incertidumbre;
- riesgo/timing;
- ranking/confianza.

Nunca autoridad productiva independiente ni 100% al ganador sin validación económica separada.

## Criterio de parada

Parar la línea si:
- Stage A no es técnicamente reproducible;
- Stage B no muestra información útil ni calibración;
- prospectivo no confirma señal;
- coste/latencia supera el valor informativo.

No retunear sobre muestras consumidas.
