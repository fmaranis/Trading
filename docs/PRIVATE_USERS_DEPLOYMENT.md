# Custodia — usuarios privados, administrador y despliegue

## Objetivo

Ninguna cartera, efectivo, operación, contexto fiscal ni historial de decisión debe ser visible sin autenticación. El motor financiero permanece independiente de esta capa: identidad, autorización, persistencia y administración de cuentas no pueden crear una segunda lógica de inversión.

Trading mantiene infraestructura propia. `fmaranis/Cubetos-y-balsas-sincronizado` puede servir únicamente como referencia de patrones ya probados; no se comparten Firebase, usuarios, UID, Firestore, claims, backend, despliegue, datos, alarmas ni imports entre repositorios.

## Arquitectura implementada

- Firebase Authentication propio de Trading: correo + contraseña.
- Cloud Run/Express: verifica Firebase ID token en cada operación privada.
- Firebase Admin SDK: único componente autorizado para gestionar usuarios, claims y escrituras privadas.
- Firestore: estado persistente por `uid`.
- Custom Claims firmados:
  - `accessGranted=true`: permite usar la aplicación privada;
  - `isAdmin=true`: permite administrar cuentas y también implica acceso.
- `localStorage`: caché aislada del usuario conectado, no fuente compartida de identidad.
- ADMIN integrado en la superficie existente, sin panel/producto paralelo.
- Auditoría backend propia de Trading para operaciones administrativas.

Rutas web protegidas:

- `/`;
- `/portfolio.html`;
- `/legacy.html`.

En producción no existe bypass si Firebase no está configurado. Cualquier error durante autenticación, autorización o hidratación del estado privado es **fail-closed**: la aplicación no renderiza la cartera.

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
    custodia_fund_positions_v1,
    custodia_staged_capital_plan_v1,
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

users/{uid}/private/portfolioAlertAutomation
  estado/deduplicado de alertas de cartera del UID

system/alertAutomation
  estado técnico durable del backend de alertas de entrada

admin_audit_log/{eventId}
  actorUid
  actorEmail
  targetUid
  action
  before
  after
  metadata
  createdAt
```

Los valores privados se sincronizan como representaciones JSON/string ya utilizadas por los servicios existentes para no modificar el motor financiero.

`system/alertAutomation` es estado técnico del backend, no una cartera. `admin_audit_log` contiene sólo metadatos administrativos de cuenta, nunca carteras ni datos financieros de otro usuario.

## Reglas de seguridad

`firestore.rules` aplica deny-by-default.

- Un usuario sólo puede leer su propio perfil y su propio estado financiero.
- Un administrador puede leer metadatos de cuenta/perfil necesarios para administrar usuarios, pero **no puede leer la cartera, efectivo, historial fiscal u operaciones de otros usuarios** desde el cliente.
- Ningún cliente puede escribir roles, estados o datos privados directamente en Firestore.
- Las escrituras privilegiadas se realizan mediante backend autenticado + Admin SDK.
- `system/alertAutomation` y `admin_audit_log` quedan cubiertos por deny-by-default del cliente y sólo son accesibles al backend con Admin SDK.
- El servidor usa Admin SDK y debe protegerse mediante IAM/credenciales de servicio; las reglas Firestore no sustituyen esa protección.

## Primer administrador

Configurar server-side una de estas variables:

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

La vía por email sólo funciona cuando Firebase emite `email_verified=true`. La vía por UID exige coincidencia exacta.

Después del bootstrap se renueva el ID token para recibir los claims. No existe un campo editable por el navegador capaz de convertir a un usuario en administrador.

## Alta de usuarios

### Registro pendiente

Con `FIREBASE_SELF_REGISTRATION_ENABLED=true`, una persona puede crear usuario con email/contraseña y verificar correo, pero queda sin `accessGranted` hasta aprobación ADMIN.

### Alta por administrador

Desde el panel ADMIN:

- introducir email y nombre;
- backend crea la cuenta con contraseña aleatoria no mostrada;
- concede acceso si se solicita;
- genera enlace Firebase de configuración/restablecimiento;
- copia el enlace para entrega privada;
- si el alta falla antes de completar el bootstrap de cuenta, el backend intenta revertir usuario y estado parcial para evitar cuentas huérfanas.

Para una web cerrada se recomienda `FIREBASE_SELF_REGISTRATION_ENABLED=false` y alta sólo por administrador.

## Funciones del administrador

El panel existente permite:

- listar usuarios;
- buscar por correo, nombre o UID;
- ver si el correo figura verificado;
- conceder o revocar acceso;
- promover o retirar ADMIN;
- bloquear/reactivar una cuenta;
- generar enlace de cambio de contraseña;
- borrar cuenta y sus datos Firestore;
- consultar actividad administrativa reciente.

El panel **no** incluye ninguna función para abrir la cartera de otro usuario.

Protecciones:

- ADMIN se autoriza mediante custom claim firmado, no `profile.role`;
- un administrador no puede borrarse a sí mismo;
- no puede bloquearse, revocarse acceso ni quitarse ADMIN a sí mismo desde el panel;
- no se puede eliminar/despromover el último administrador activo;
- al bloquear/revocar privilegios se revocan refresh tokens;
- operaciones sensibles del panel exigen confirmación explícita;
- alta, cambios de acceso/ADMIN/bloqueo, generación de enlace de contraseña y borrado quedan registrados en `admin_audit_log` mediante backend;
- un fallo de escritura del audit log no transforma una mutación ya completada en un falso error del cliente: el backend lo registra en servidor y devuelve `auditLogged` en la respuesta administrativa.

## Qué se tomó como referencia de Cubetos/Muros

La comparación de Fase 2A concluyó que Trading ya tenía una base fuerte de identidad/aislamiento y no debía migrarse a otra arquitectura.

Patrones aprovechados de forma independiente:

- auditoría de operaciones administrativas;
- mayor visibilidad del estado del usuario en el backoffice;
- búsqueda de usuarios;
- confirmación de operaciones sensibles;
- revisión del flujo de alta para evitar dejar una cuenta parcial cuando falla el bootstrap.

No se copiaron porque no aportan valor actual a Trading:

- planes `free/premium/pro/empresa`;
- créditos de informes;
- anuncios;
- permisos de PDF/DXF/proyectos;
- `PermissionContext`/entitlements genéricos cuando Trading sólo necesita actualmente `accessGranted` + `isAdmin`;
- dependencias o servicios compartidos entre aplicaciones.

Si en el futuro Trading necesita permisos por feature, se diseñarán dentro de Trading y se validarán contra sus necesidades reales antes de añadir abstracciones.

## Migración y aislamiento del estado local

Al primer acceso autorizado:

1. si Firestore ya tiene estado del UID, se limpia caché privada local y se hidrata desde nube;
2. si no existe estado cloud y el navegador contiene estado histórico sin propietario, se migra al primer UID autorizado;
3. se guarda `custodia_cloud_owner_uid_v1` localmente;
4. si entra otro UID en el mismo navegador, los datos privados locales anteriores se limpian antes de hidratar la nueva cuenta;
5. al cerrar sesión se intenta sincronizar y después se limpia la caché privada local.

Las claves heredadas de fondos/capital pendiente y el plan de ejecución pendiente forman parte explícita del aislamiento.

## Sincronización

Mientras la app está abierta:

- cambios de cartera/cash/contexto fiscal disparan sincronización;
- existe comprobación de cambios para servicios antiguos que todavía no emiten evento;
- al ocultar la pestaña se intenta sincronizar;
- Firestore queda como copia persistente privada.

La estrategia/cálculo no usa Firestore para decidir: el estado se hidrata y los servicios financieros existentes trabajan con su representación habitual.

## Alertas actuales

### Entrada

El job de oportunidades usa persistencia durable:

- con Firebase configurado: `system/alertAutomation` en Firestore;
- en producción o con `FIREBASE_AUTH_REQUIRED=true`, si Firebase durable no está disponible devuelve `ALERT_STATE_PERSISTENCE_NOT_CONFIGURED` y no cae silenciosamente a disco;
- sólo desarrollo sin Firebase puede usar fallback local;
- `/api/alerts/status` expone `FIRESTORE | LOCAL_DEV | UNAVAILABLE`;
- el dedupe conserva GOOD_ENTRY, escalada HIGH_CONVICTION y reaparición tras dejar de ser accionable;
- un webhook fallido no marca el evento como entregado.

### Gestión de cartera

No está por construir desde cero. `server/portfolioManagementAlerts.ts` ya:

- resuelve la cuenta configurada actualmente;
- comprueba que esté activa/autorizada;
- lee `users/{uid}/private/state`;
- reconstruye cartera, historial, tax lots y cash benchmark;
- reutiliza `PortfolioPositionHealthService` / `classifyPositionHealth`;
- mantiene dedupe en estado privado por UID;
- puede enviar `ADD / WATCH / REDUCE / EXIT` por Telegram.

Las alarmas ya llegan en la configuración real actual del usuario.

Pendiente residual, sólo si se decide incluirlo en V1:

1. decidir si hace falta generalizar avisos a todos los usuarios ACTIVE o si el alcance actual es suficiente;
2. si se generaliza, mantener dedupe independiente por UID;
3. revisar la autoridad residual de `PortfolioRotationReviewEngine`/`ROTATE_NOW` antes de convertirla en una alerta productiva canónica;
4. añadir/ajustar guards si ese flujo se modifica;
5. comprobar que las alarmas actuales siguen llegando después de cualquier cambio.

No debe crearse una segunda lógica de trading en backend.

## Configuración Firebase necesaria

```text
FIREBASE_PROJECT_ID=
FIREBASE_WEB_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_APP_ID=
FIREBASE_AUTH_REQUIRED=true
FIREBASE_SELF_REGISTRATION_ENABLED=false
FIREBASE_BOOTSTRAP_ADMIN_UIDS=...
```

Cloud Run dentro del mismo proyecto debe preferir Application Default Credentials con service account de mínimo privilegio. Cualquier `FIREBASE_SERVICE_ACCOUNT_JSON` temporal permanece server-side y nunca en frontend/repositorio/variables `VITE_*`.

Versiones fijadas:

```text
firebase 12.18.0
firebase-admin 13.10.0
```

## Cloud Run + Cloud Scheduler

- desplegar full-stack en Cloud Run;
- mantener `FIREBASE_AUTH_REQUIRED=true`;
- secretos server-side, nunca GitHub;
- Cloud Scheduler invoca `POST /api/alerts/run-now` en `Europe/Madrid`;
- `ALERT_ADMIN_TOKEN` viaja en `x-alert-admin-token` si corresponde;
- con Cloud Scheduler como fuente, `ALERT_AUTOMATION_ENABLED=false` evita scheduler duplicado;
- `/api/alerts/status` debe mostrar `persistence: FIRESTORE`.

## Validación multiusuario ya realizada

Validado manualmente en Firebase real:

- primer usuario ADMIN autenticado;
- cartera real asociada al UID privado propietario;
- alta de segundo usuario desde ADMIN;
- segundo usuario sin ADMIN;
- cartera del segundo usuario aislada;
- cambio de UID en mismo navegador sin mezcla;
- retorno al ADMIN recuperando exclusivamente su cartera;
- borrado de usuario de prueba disponible.

## Validación requerida tras el hardening de Fase 2A

Los cambios de Fase 2A modifican únicamente administración de usuarios, no motor financiero ni Future Forward.

Antes de marcar este bloque PASS:

1. ejecutar **`Producto · cierre rápido`** una sola vez; su guard de superficie incluye ahora las invariantes de ADMIN/audit y termina con TypeScript;
2. comprobar que el panel ADMIN abre normalmente;
3. comprobar que lista usuarios, búsqueda y estado de correo funcionan;
4. realizar una operación administrativa reversible sobre una cuenta de prueba y comprobar que aparece en `Actividad administrativa reciente`;
5. confirmar que el usuario principal conserva exactamente su cartera/estado privado;
6. confirmar que las alarmas actuales siguen llegando normalmente.

No hace falta ejecutar un replay largo para validar este cambio.