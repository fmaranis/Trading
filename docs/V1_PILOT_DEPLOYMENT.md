# V1 PILOT — despliegue y autonomía

## Objetivo

La estrategia financiera permanece congelada. Este documento describe únicamente cómo operar el piloto de forma persistente y cómo separar desarrollo/Preview de ejecución autónoma.

## Qué funciona ya en Preview/local

- Decisión ejecutiva de hoy.
- Historial diario V1 PILOT en el navegador.
- Seguimiento de posiciones reales con retorno, MFE, giveback y estado HOLD/ADD/WATCH/REDUCE/EXIT.
- Historial de operaciones realmente registradas.
- Confirmación manual de disponibilidad en MyInvestor.
- Comprobación backend de oportunidades de entrada.
- Dedupe de avisos: una misma GOOD_ENTRY/HIGH_CONVICTION no vuelve a notificarse cada día.

Mientras el servidor de Preview/local esté apagado no existe ejecución autónoma del backend.

## Despliegue recomendado

1. Desplegar la aplicación full-stack como servicio persistente, preferentemente Cloud Run si se continúa dentro del flujo de Google AI Studio.
2. Mantener secretos únicamente en servidor:
   - `EODHD_API_KEY` si se usa validación secundaria.
   - `ALERT_WEBHOOK_URL`.
   - `ALERT_ADMIN_TOKEN`.
3. Configurar `APP_URL` con la URL pública del servicio.
4. Programar una invocación diaria fiable a `POST /api/alerts/run-now`, en vez de depender exclusivamente del `setInterval` del proceso Node.
5. Enviar `x-alert-admin-token` con el valor de `ALERT_ADMIN_TOKEN` cuando el endpoint se invoque en producción.

## Regla de aviso de entrada V1

Se envía notificación únicamente cuando:

- un activo que antes no era accionable pasa a `GOOD_ENTRY`;
- un activo que antes no era accionable pasa directamente a `HIGH_CONVICTION`;
- un activo ya en `GOOD_ENTRY` escala a `HIGH_CONVICTION`.

No se vuelve a avisar si al día siguiente conserva el mismo nivel.

Si una oportunidad desaparece y posteriormente reaparece, vuelve a considerarse un evento nuevo.

## Estado persistente obligatorio en producción

El archivo `.runtime/alertAutomationState.json` es solo caché local de desarrollo. No debe considerarse almacenamiento permanente en un contenedor efímero.

Antes de declarar autonomía 24/7 completa hay que mover a almacenamiento persistente:

- estado de deduplicación de alertas;
- última ejecución correcta;
- cartera real del usuario;
- historial operativo necesario para reconstruir coste/MFE/episodios;
- confirmaciones MyInvestor que deban sobrevivir a otro navegador/dispositivo.

Firestore, una base SQL gestionada o un almacenamiento equivalente son opciones válidas. La elección es de infraestructura y no debe cambiar el motor financiero.

## REDUCE / EXIT autónomos

La UI ya calcula y muestra REDUCE/EXIT con el motor compartido cuando dispone de la cartera real.

Para avisar de REDUCE/EXIT con la app cerrada, el backend necesita recibir y persistir esa cartera real y su historial de ejecución. Hasta entonces, no se debe afirmar que las alertas de salida son 24/7.

## Contrato V1 PILOT

- No recalibrar thresholds durante el piloto.
- No introducir nuevos scores o reglas por resultados de pocos días.
- Solo corregir bugs reproducibles o problemas de datos/operación.
- Guardar recomendación y ejecución real por separado.
- Toda trayectoria posterior usada para evaluar decisiones es diagnóstico ex post, nunca input causal.
