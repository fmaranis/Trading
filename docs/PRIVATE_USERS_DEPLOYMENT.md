# Custodia — usuarios privados, administrador y despliegue

## Objetivo

Antes de publicar la aplicación, ninguna cartera, efectivo, operación, contexto fiscal ni historial de decisión debe ser visible sin autenticación. El motor financiero permanece congelado: este bloque sólo añade identidad, autorización, persistencia y administración de cuentas.

## Arquitectura implementada

- Firebase Authentication: correo + contraseña.
- Cloud Run/Express: verifica el Firebase ID token en cada operación privada.
- Firebase Admin SDK: único componente autorizado para gestionar usuarios, claims y escrituras privadas.
- Firestore: estado persistente por `uid`.
- Custom Claims firmados:
  - `accessGranted=true`: permite usar la aplicación privada.
  - `isAdmin=true`: permite administrar cuentas y también implica acceso.
- `localStorage`: queda como caché local del usuario conectado, no como fuente compartida de identidad.

Rutas web protegidas:
- `/`
- `/portfolio.html`
- `/legacy.html`

En producción no existe bypass si Firebase no está configurado. Además, cualquier error durante autenticación, autorización o hidratación del estado privado es **fail-closed**: la aplicación no renderiza la cartera.

## Estructura Firestore

```text
users/{uid}
  uid
  email
  displayName
  status               ACTIVE | PENDING | DISABLED
  isAdminDisplay        sólo informativo; NO concede permisos
  createdAt
  updatedAt

users/{uid}/private/state
  schemaVersion: 1
  updatedAt
  values: {
    custodia_user_portfolio_v1,
    custodia_fund_positions_v1,              # legado, sólo migración/aislamiento
    custodia_staged_capital_plan_v1,         # legado, sólo migración/aislamiento
    custodia_pending_execution_plan_v1,
    custodia_portfolio_execution_history_v1,
    custodia_portfolio_cash_flow_history_v1,
    custodia_myinvestor_manual_availability_v1,
    custodia_v1_pilot_decision_history_v1,
    custodia_spanish_tax_settings_v1,
    custodia_spanish_tax_lots_v1,
    custodia_cash_benchmark_annual_pct_v1,
    custodia_investment_decision_history_v1
  }

system/alertAutomation
  persistence: FIRESTORE
  updatedAt
  lastAttemptAt
  lastSuccessAt
  lastRunLocalDate
  lastMarketDate
  lastError
  lastAlerts
  lastEvidenceState
  lastNotificationAt
  lastNotificationEventCount
  lastNotificationEventKeys
  lastNotifiedActionableLevels
```

Los valores privados se sincronizan como representaciones JSON/string ya utilizadas por los servicios locales. Esto evita modificar el motor financiero y permite migrar gradualmente cada servicio a documentos Firestore nativos en el futuro.

`system/alertAutomation` es estado técnico del backend, no una cartera de usuario. Mantiene de forma durable el deduplicado de avisos de entrada. El Admin SDK es el único que lo lee/escribe; las reglas cliente siguen deny-by-default.

## Reglas de seguridad

`firestore.rules` aplica deny-by-default.

- Un usuario sólo puede leer su propio perfil y su propio estado financiero.
- Un administrador de cuentas puede leer metadatos de cuenta/perfil para administrar usuarios, pero **no puede leer la cartera, efectivo, historial fiscal u operaciones de otros usuarios**.
- Ningún cliente puede escribir roles, estados o datos privados directamente en Firestore.
- Todas las escrituras se realizan mediante el backend autenticado.
- El servidor usa Admin SDK y, por tanto, debe protegerse mediante IAM/credenciales de servicio; las reglas Firestore no sustituyen esa protección.
- `system/alertAutomation` queda cubierto por el deny-by-default del cliente y sólo es accesible al backend con Admin SDK.

## Primer administrador

Antes de publicar, configurar una de estas variables server-side:

```text
FIREBASE_BOOTSTRAP_ADMIN_EMAILS="tu-correo@example.com"
# o
FIREBASE_BOOTSTRAP_ADMIN_UIDS="firebase-uid"
```

Cuando esa cuenta inicia sesión, `/api/alerts/account/bootstrap` puede establecer:

```text
isAdmin=true
accessGranted=true
```

La vía por **email sólo funciona cuando Firebase emite `email_verified=true`**. Registrar simplemente el correo configurado sin controlar/verificar ese buzón no concede ADMIN. La vía por UID exige coincidencia exacta.

Después del bootstrap se fuerza renovación del ID token para recibir los claims. No existe un campo editable por el navegador que pueda convertir a un usuario en administrador.

Recomendación: una vez existan al menos dos administradores controlados, retirar `FIREBASE_BOOTSTRAP_ADMIN_EMAILS/UIDS` del entorno de producción.

## Alta de usuarios

Hay dos caminos.

### 1. Registro pendiente

Con `FIREBASE_SELF_REGISTRATION_ENABLED=true`, una persona puede crear usuario con email/contraseña y recibe flujo de verificación de correo, pero queda sin `accessGranted`. Ve únicamente la pantalla PENDIENTE hasta que un administrador lo aprueba.

### 2. Alta por administrador

Desde el panel ADMIN:

- introducir email y nombre;
- el backend crea la cuenta con una contraseña aleatoria no mostrada;
- concede acceso si se solicita;
- genera un enlace Firebase de configuración/restablecimiento de contraseña;
- el enlace se copia para entregarlo al usuario por un canal privado.

Para una web cerrada se recomienda `FIREBASE_SELF_REGISTRATION_ENABLED=false` y alta sólo por administrador.

## Funciones del administrador

El panel permite:

- listar usuarios;
- conceder o revocar acceso;
- promover o retirar ADMIN;
- bloquear/reactivar una cuenta;
- generar enlace de cambio de contraseña;
- borrar cuenta y sus datos Firestore.

El panel **no incluye** ninguna función para abrir la cartera de otro usuario.

Protecciones:

- un administrador no puede borrarse a sí mismo;
- no puede bloquearse, revocarse acceso ni quitarse ADMIN a sí mismo desde el panel;
- no se puede eliminar/despromover el último administrador activo;
- al bloquear/revocar privilegios se revocan refresh tokens.

## Migración del estado local existente

Al primer acceso autorizado:

1. si Firestore ya tiene estado del UID, primero se limpia la caché privada local y se hidrata desde la nube;
2. si no existe estado cloud y el navegador todavía contiene el estado histórico sin propietario, se migra al primer UID autorizado;
3. se guarda `custodia_cloud_owner_uid_v1` localmente;
4. si posteriormente entra otro UID en el mismo navegador, los datos privados locales del usuario anterior se limpian antes de hidratar la nueva cuenta;
5. al cerrar sesión se intenta sincronizar y después se limpia la caché privada local.

Las claves heredadas de fondos/capital pendiente y el plan de ejecución pendiente forman parte explícita del aislamiento. Esto evita que dos cuentas compartan inadvertidamente cartera, operaciones pendientes o datos antiguos a través del mismo `localStorage`.

## Sincronización

Mientras la app está abierta:

- cambios de cartera/cash/contexto fiscal disparan sincronización;
- existe además una comprobación de cambios cada 15 s para servicios antiguos que todavía no emiten evento;
- al ocultar la pestaña se intenta sincronizar;
- Firestore queda como copia persistente privada.

La estrategia/cálculo no usa Firestore para decidir: el estado se hidrata primero y los servicios existentes trabajan con la misma representación que antes.

## Persistencia de alertas de entrada

El job de oportunidades ya no depende de `.runtime/alertAutomationState.json` cuando Firebase está configurado.

- Con Firebase configurado: lee/escribe `system/alertAutomation` en Firestore.
- En producción o con `FIREBASE_AUTH_REQUIRED=true`: si la persistencia Firebase no está disponible, devuelve `ALERT_STATE_PERSISTENCE_NOT_CONFIGURED` y no cae silenciosamente a disco local.
- Sólo en desarrollo sin Firebase puede usar `.runtime/alertAutomationState.json` como fallback local.
- `/api/alerts/status` expone `persistence: FIRESTORE | LOCAL_DEV | UNAVAILABLE` para diagnóstico.
- El deduplicado conserva la regla vigente: evento nuevo al aparecer `GOOD_ENTRY`, al escalar a `HIGH_CONVICTION`, o al reaparecer después de haber dejado de ser accionable; un webhook fallido no marca el evento como entregado.

Esto elimina la dependencia de un filesystem efímero para la continuidad de avisos entre reinicios/reescalados del contenedor.

## Configuración Firebase necesaria

1. Crear/seleccionar un proyecto Firebase.
2. Authentication → habilitar Email/Password.
3. Crear Cloud Firestore.
4. Registrar una Web App y obtener:
   - projectId
   - apiKey
   - authDomain
   - appId
5. Configurar en el servidor:

```text
FIREBASE_PROJECT_ID=
FIREBASE_WEB_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_APP_ID=
FIREBASE_AUTH_REQUIRED=true
FIREBASE_SELF_REGISTRATION_ENABLED=false
FIREBASE_BOOTSTRAP_ADMIN_UIDS=...
```

6. Si se usa bootstrap por email, verificar el correo de la cuenta bootstrap.
7. Cloud Run dentro del mismo proyecto: preferir Application Default Credentials y un service account con el acceso mínimo requerido a Firebase Auth/Firestore.
8. Fuera de ese entorno puede usarse temporalmente `FIREBASE_SERVICE_ACCOUNT_JSON` como secreto server-side; nunca incluirlo en frontend, repositorio o variables `VITE_*`.
9. Desplegar `firestore.rules` (`firebase.json` ya referencia el archivo).
10. Añadir el dominio público de Cloud Run/dominio propio a los dominios autorizados de Firebase Authentication cuando corresponda.

## Dependencias

Versiones fijadas y lockfile coherente:

```text
firebase 12.18.0
firebase-admin 13.10.0
```

El `package-lock.json` ya fue regenerado a partir del `package.json` actual e incluye ambas dependencias.

## Cloud Run + Cloud Scheduler

Para producción 24/7:

- desplegar el full-stack en Cloud Run;
- mantener `FIREBASE_AUTH_REQUIRED=true`;
- guardar secretos server-side, nunca en GitHub;
- usar Cloud Scheduler para invocar `POST /api/alerts/run-now` a la hora deseada en `Europe/Madrid`;
- configurar `ALERT_ADMIN_TOKEN` y hacer que Scheduler envíe el mismo valor en `x-alert-admin-token` si el servicio web es público;
- cuando Cloud Scheduler sea la fuente de programación, dejar `ALERT_AUTOMATION_ENABLED=false` para no duplicar el scheduler interno del proceso;
- verificar `/api/alerts/status` y exigir `persistence: FIRESTORE` antes de considerar el job operativo.

El scheduler interno de Node se conserva sólo para entornos locales/long-lived donde sea útil; Cloud Scheduler es la opción prevista para Cloud Run.

## Qué queda pendiente para autonomía completa de salidas

La cartera ya puede persistirse por usuario en Firestore y deja de depender exclusivamente del navegador. El cierre restante para avisos `WATCH/REDUCE/EXIT` 24/7 es hacer que el job backend:

1. enumere únicamente usuarios `ACTIVE`;
2. lea su estado privado Firestore mediante el backend autorizado;
3. reconstruya la cartera/contexto operativo en servidor;
4. ejecute el mismo clasificador de salud vigente con datos REAL;
5. guarde por UID el último evento notificado;
6. envíe únicamente eventos nuevos al canal configurado para ese usuario.

No debe implementarse una segunda lógica de trading en el backend: el clasificador y gates deben seguir siendo los mismos módulos compartidos.

## Validación multiusuario realizada

Validado manualmente en el proyecto Firebase real:

- primer usuario ADMIN autenticado correctamente;
- cartera real asociada al UID privado del propietario;
- alta de un segundo usuario desde el panel ADMIN;
- segundo usuario sin privilegios ADMIN;
- cartera del segundo usuario aislada de la del ADMIN;
- cambio de UID en el mismo navegador sin mezcla de estados;
- retorno al usuario ADMIN recuperando exclusivamente su cartera;
- borrado del usuario de prueba disponible desde el panel.

## Regla de publicación

No publicar como versión operativa hasta cumplir simultáneamente:

- Firebase configurado;
- `FIREBASE_AUTH_REQUIRED=true`;
- primer ADMIN comprobado;
- Firestore rules desplegadas;
- lockfile coherente con Firebase;
- `npm run lint` PASS;
- `npx tsx tests/privateUserSecurity.unit.ts` PASS;
- login usuario normal probado;
- usuario normal incapaz de abrir ADMIN;
- ADMIN capaz de alta/bloqueo/borrado de una cuenta de prueba;
- ADMIN incapaz de abrir la cartera de otra cuenta desde la UI/Firestore client;
- cambio de usuario en un mismo navegador sin mezcla de cartera;
- error forzado de carga privada comprobado como fail-closed;
- `/api/alerts/status` devuelve `persistence: FIRESTORE` en el entorno desplegado;
- Cloud Scheduler probado manualmente al menos una vez antes de dejarlo programado.
