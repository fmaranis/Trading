# Fundamental Quality Future Forward V1 — cierre de diseño

Estado: **PREPARED / FUTURE OUTCOMES UNOPENED / START NOT CAPTURED**.
Base: `8708155950912a0b6dd9e8ea6e48e414f4053397`. La selección y su protocolo original no se modifican.

## Contrato de evidencia

- Snapshot SHA-256 exacto (bytes): `06ad777b20970fe8c957d9febe8ccadcbcc75ecbf08cc870cd600236488ab2f2`.
- 500 miembros, 347 evaluables, 100 securities, 99 emisores. Pesos iniciales suman 1; cap inicial por emisor 5%. El cap no se reaplica tras movimientos de precios: no hay rebalanceo.
- Snapshot, descriptores, protocolo, código y pruebas quedan referenciados en `validation-runs/preregistration/fundamental-quality-future-forward-v1-infrastructure-seal.json`.
- El guard comprueba hashes exactos. Capturador/evaluador leen y congelan recursivamente el snapshot; nunca aceptan una selección/pesos pasados por el caller. No importan funciones de ranking ni recalculan descriptores.
- LEGACY, CORE_ARCHITECTURE_V1 y el allocator siguen intactos. Es contabilidad de un experimento prospectivo, no un motor nuevo de decisiones ni una implementación ejecutable de 100 órdenes.
- Los tests usan fixtures artificiales aislados, identificados como UNIT ONLY; no son evidencia de mercado ni resultados de la hipótesis.

## Inicio: primera sesión común y terminada

Capturar desde el 2026-09-28, en orden cronológico, hasta encontrar la primera sesión realmente negociable para las 100 securities y SPY/URTH. No hay argumento de fecha de inicio ni de reloj en el CLI. El reloj inyectable sólo sirve para unit tests de las funciones.

El calendario congelado cubre 2026-09-28 a 2027-12-31. Fuente oficial publicada 2025-12-23:
https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx

Se excluyen fines de semana y cierres programados. Se registran sesiones reducidas. Para evitar aceptar barras aún provisionales, la lectura se habilita conservadoramente a **22:00 UTC** de cada sesión (después del cierre cash con o sin DST). Por tanto la primera consulta posible es 2026-09-28 22:00 UTC, 2026-09-29 00:00 Europe/Madrid. No se anticipa la apertura del 28.

Un cierre extraordinario no previsto bloquea esta versión: no se infiere un día festivo porque falten barras. La revisión de hechos puede acreditar una suspensión individual de sesión completa; sólo esa evidencia permite descartar como no común una sesión anterior. Una ausencia/error/null del proveedor sin esa acreditación bloquea la captura, incluso si todas las series tienen precios al día siguiente. Nunca se usa la intersección silenciosa de datos disponibles.

Para cada security en la sesión inicial:

`adjustedOpen = rawOpen × adjustedClose / rawClose`

Los tres valores pertenecen a la misma sesión terminada. Se conservan esos valores, fecha, identidad, respuesta bruta y su hash, URL, hora de descarga, revisión de corporate actions y las sesiones anteriores descartadas con evidencia. Se comprueba la identidad exacta retornada por Yahoo, moneda USD y zona America/New_York. La normalización de notación `NYSE:BRK.B -> BRK-B` está congelada; no permite buscar o sustituir otro activo.

## Persistencia, reanudación y punto cero

Mismo repositorio y rama de evidencia que las demás investigaciones: `fmaranis/Trading/replay-results`, directorio `validation-runs/fundamental-quality-future-forward-v1/`.

La nueva utilidad común `researchImmutableEvidenceStore.mjs` implementa create-only porque el helper anterior de informes permite sobrescritura. No cambia ese helper ni las investigaciones existentes. Las escrituras GitHub omiten SHA de reemplazo: dos capturas concurrentes no pueden pisarse. Después se verifica por lectura el hash del contenido. Un conflicto para una clave ya existente falla; no se fuerza.

Cada objeto se conserva comprimido gzip/base64 con hash del JSON canónico. Las respuestas por símbolo son caché durable inmutable; ante interrupción se reanudan las que faltan. Un fallo no hace cambiar de fecha. No hay polling, bucle de retries ni descargas históricas ajenas al rango autorizado. `.runtime` sólo contiene una copia de recuperación; jamás es la autoridad.

Artefactos:

- `start-opening`: marca durable antes de consultar precios de arranque, mantiene outcomes de checkpoints sin abrir;
- `start-input-YYYY-MM-DD-*`: respuestas por símbolo;
- `start-input-YYYY-MM-DD`: manifiesto/paquete completo;
- `start`: payload + SHA-256 atómico, ligado al hash del snapshot; es el seal del inicio;
- `checkpoint-3m-opening`, `checkpoint-6m-opening`, `checkpoint-12m-opening`: apertura durable antes de outcomes, incluso si después falla un proveedor;
- `checkpoint-Nm-input-*` / `checkpoint-Nm-input`: evidencia reproducible;
- `checkpoint-Nm`: resultado sellado, enlazado a start/snapshot/inputs/revisión.

El snapshot conserva su campo histórico `outcomeOpened:false`; las aperturas reales posteriores constan en esos marcadores nuevos y no reescriben el snapshot. Un checksum demuestra integridad respecto de una referencia confiable; no certifica por sí solo la veracidad económica de un proveedor o la revisión de eventos.

## Checkpoints y riesgo

3/6/12 meses de calendario desde la fecha capturada; si el aniversario cae en cierre programado se usa la primera sesión programada posterior. No se retrasa el endpoint por faltar una security. Si el inicio fuese legítimamente 2026-09-28: 3m = 2026-12-28, 6m = 2027-03-29, 12m = 2027-09-28. Las fechas no se materializan como start real antes de capturarlo.

El evaluador exige 100% de securities **y ambos benchmarks**, con cada sesión diaria del calendario, sin duplicados, fechas futuras, precios no positivos ni huecos intermedios. Una suspensión dentro del periodo impide calcular el riesgo diario completo y produce bloqueo, no forward-fill. No se renormalizan supervivientes. Cada serie debe ser REAL, en USD, y provenir de un solo paquete/vintage para todo el rango start-end.

Los adjusted close del proveedor pueden cambiar retroactivamente cuando llegan dividendos posteriores. Por ello cada serie se normaliza por el adjusted open del inicio **reobtenido en ese mismo vintage**, que se enlaza al raw open/raw close del inicio sellado. El raw start tiene que coincidir (tolerancia relativa 1e-8); una revisión/split que lo cambie bloquea. Esta normalización no cambia la fecha ni la transacción inicial. Usar adjustedClose nuevo dividido por adjustedOpen antiguo sería incorrecto.

`securityNAV[d] = adjustedClose[d] / sameVintageAdjustedOpen[start]`

`candidateNAV[d] = sum(frozenInitialWeight[i] × securityNAV[i,d])`

Los pesos derivan con la rentabilidad: es buy-and-hold, no rebalanceo diario. Dividendos ordinarios se tratan mediante el proxy total-return del proveedor, reinvertidos en la propia security según su convención. No se suman además como efectivo. Es rentabilidad bruta research en USD, sin gastos, spread, impuestos españoles ni prueba de ejecutabilidad.

Métricas comunes a candidate/SPY/URTH:

- total return desde open inicial a close del checkpoint;
- CAGR equivalente usando segundos reales entre open/close, año de 365,25 días;
- retornos simples diarios; primera observación open-to-close inicial, siguientes close-to-close;
- volatilidad = desviación típica muestral (n-1) de retornos × sqrt(252);
- max drawdown de la curva diaria incluyendo NAV inicial 1;
- Sharpe = media diaria de exceso / desviación muestral de exceso × sqrt(252);
- risk-free congelado **0 diario para las tres curvas**, referencia neutral de investigación. No es remuneración BCE ni inferencia del Sharpe frente al cash económico real;
- volatilidad cero => Sharpe N/D, nunca infinito.

3m/6m sólo `DESCRIPTIVE_CHECKPOINT_NO_PROMOTION`. Sólo 12m evalúa simultáneamente candidate > SPY y candidate > URTH con cobertura 100%. Empates fallan; tolerancia aritmética 1e-10 puntos porcentuales evita que redondeo de la suma de pesos convierta un empate en PASS. No es un hurdle económico ajustado por resultados. Riesgo es descriptivo, no añade un gate que no existía.

Resultado máximo: `PASS_PRIMARY_12M_SIGNAL_ONLY`, siempre `productionAuthority=false`, `promotionAllowed=false`. Una ejecución incompleta devuelve `BLOCKED_FAIL_CLOSED` con causa; no se transforma en FAIL económico ni PASS técnico falso.

## Corporate actions: bloqueo formal y revisión requerida

Se revisó la posibilidad de implementar una contabilidad común. No se cierra ahora un motor genérico correcto: el proveedor de precios no acredita por sí solo derechos, proporciones, record/ex/effective/payment dates, cash in lieu y sucesores económicos. Queda congelada una **regla genérica de admisión fail-closed**, no una política de terminal values, en `researchCorporateActionsFailClosedV1.mjs`.

| Hecho | Regla prospectiva V1 |
| --- | --- |
| Dividendo cash ordinario | Sólo total-return del proveedor, sin doble conteo; revisión causal documentada |
| Cash merger | Bloqueado; no insertar consideración cash ni último precio |
| Stock merger | Bloqueado; no crear automáticamente posición sucesora |
| Delisting/quiebra | Bloqueado; ni cero supuesto, ni último precio, ni eliminación |
| Cambio de ticker | Bloqueado; no sustitución automática aun cuando parezca la misma empresa |
| Spin-off/distribución en especie | Bloqueado; no ignorar ni valorar derechos a posteriori |
| Split/reverse split | Bloqueado en esta versión conservadora; requiere verificar base de acciones y ajustes antes de habilitar contabilidad |
| Datos insuficientes/evento desconocido | Bloqueado, con evidencia y motivo |

Un futuro handler debe ser preregistrado separadamente antes de conocer el evento que pretenda evaluar; no desbloquear V1 retrospectivamente a raíz del propio caso. No se ha empleado CTXS para calibrar, probar o validar económicamente nada aquí.

Antes de aceptar precios se requiere un manifiesto REAL de revisión de eventos por rango y **102 identidades**. No se genera automáticamente una revisión 'sin eventos' desde un array vacío de Yahoo. Contrato:

- `policy: RESEARCH_CORPORATE_ACTIONS_FAIL_CLOSED_V1`, `sourceType: REAL`, `coverage: COMPLETE`;
- `from`, `through`, `reviewedAt` después de la sesión through y no después del reloj actual;
- `reviewer`, `symbols` exactos, `sources:[{url,sha256}]` con evidencias reales preservadas;
- `events:[{symbol,type,effectiveDate,knownAt,sourceUrl,adjustment}]`;
- `nonTradableSessions:[{symbol,date,reason:EXCHANGE_CONFIRMED_FULL_SESSION_HALT,sourceUrl,sourceSha256}]` sólo con prueba oficial.

El código verifica estructura/identidad/tiempo/hash de las referencias declaradas, no sustituye una auditoría de las fuentes. La obtención de ese manifiesto es una dependencia real pendiente para cada captura/checkpoint; el usuario no debe escribir uno ficticio para desbloquear. Sin revisión suficiente el runtime falla antes de precios. La infraestructura está preparada para evidencia auditada de un agente/operador o feed adecuado, sin relajar requisitos.

## Comandos y restricciones

Desde raíz del repo, Node >=22 (sin dependencias adicionales):

```
node tests/fundamentalQualityFutureForwardV1.unit.mjs
node tests/fundamentalQualityFutureForwardV1Infrastructure.unit.mjs
npm run lint
node scripts/fundamentalQualityFutureForwardV1Live.mjs start --review-dir /ruta/revisiones-reales
node scripts/fundamentalQualityFutureForwardV1Live.mjs evaluate --months 3 --review-dir /ruta/revisiones-reales
```

Después 6/12 con el mismo comando y horizonte. No `--start`, `--end`, `--now`, ni cambios de benchmark/pesos. Cada revisión se busca como `YYYY-MM-DD.json`. Requiere `GITHUB_REPLAY_SYNC_TOKEN` para evidencia durable; no se necesitan EODHD ni SEC para estos precios. El token no se imprime. En el domingo inicial el capturador retorna WAIT sin siquiera construir el store ni realizar llamadas de red. No se ha creado una automatización ni se ejecuta un proceso en background: el próximo arranque autorizado necesita una sesión madura, acceso durable y revisión real de eventos.

Las ramas profitability raw/capped, value intersection, ex-US y packaged UCITS conservan sus estados/sellos y no se reejecutan. La infraestructura no promociona ni reactiva ninguna de ellas.
