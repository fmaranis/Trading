# Forward Risk V11 — resultado blind

Fecha de ejecución: **2026-09-07**  
Protocolo: `V11_PREREG_2026_09_07`  
Política: `V11_POLICY_1`  
Fingerprint: `sha256:945f39501b58c40735eeb9fc7dbd7ea128985e45b991f3c947c925cbc5cb94c1`

Veredicto:

`V11_BLIND_FAIL_RETIRE_V11_POLICY_1`

## Resultado agregado

- activos blind válidos: **6/6**;
- PASS individuales: **0/6**;
- mediana `finalDeltaEur`: **-313,29 €**;
- mediana `finalDeltaPctOfContributions`: **-0,17229%**;
- mediana reducción de drawdown: **+0,00906 pp**;
- mediana `wealthEfficiencyRatio`: **0,999413**;
- gate agregado: **FAIL**.

El gate preregistrado exigía 6/6 activos válidos, al menos 4/6 PASS individuales, mediana de reducción de drawdown >=0,5 pp, mediana de delta final >=-0,5% del capital aportado y mediana de `wealthEfficiencyRatio >=1`.

## Resultado por activo

| Ticker | Delta final € | Delta / aportaciones | Reducción DD | Wealth efficiency ratio | PASS |
|---|---:|---:|---:|---:|---|
| IUSQ.DE | -422,28 | -0,2359% | +0,0013 pp | 0,999092 | No |
| SXR4.DE | -1.741,70 | -0,9264% | +0,0208 pp | 0,997421 | No |
| EUNM.DE | -204,30 | -0,1087% | +0,2192 pp | 1,001070 | No |
| EUNK.DE | -106,42 | -0,0566% | -0,00003 pp | 0,999734 | No |
| SXR1.DE | -83,53 | -0,0444% | +0,0156 pp | 0,999867 | No |
| SXRZ.DE | -3.238,24 | -1,7225% | +0,0025 pp | 0,993119 | No |

## Interpretación cerrada

V11 consiguió que el coste de rentabilidad mediano fuese pequeño, pero la reducción de drawdown fue prácticamente nula. La hipótesis central —que el score continuo de Forward Risk pudiera comprar una mejora material de retorno/riesgo mediante sizing parcial— no queda respaldada.

El único caso con `wealthEfficiencyRatio > 1` fue EUNM.DE, pero su reducción de drawdown (+0,219 pp) quedó claramente por debajo del mínimo preregistrado de +0,5 pp.

No hay problemas de calidad de datos que permitan declarar INCONCLUSIVE: los seis activos fueron válidos. El fallo es económico/metodológico, no técnico.

## Disposición

- `V11_POLICY_1` queda **RETIRADA**;
- no se permite V11.1 ni tuning sobre estos seis activos;
- `IUSQ.DE`, `SXR4.DE`, `EUNM.DE`, `EUNK.DE`, `SXR1.DE`, `SXRZ.DE` quedan consumidos para cualquier sucesor;
- la confirmación future-forward desde 2026-09-08 queda cancelada para promoción de V11;
- V11 no se integra en `CORE_ARCHITECTURE_V1`, Custodia, replay ni live;
- cualquier sucesor Forward Risk requiere una arquitectura nueva preregistrada y un holdout independiente aún no inspeccionado.
