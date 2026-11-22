# OpenCode remoto desde móvil y ordenador · GitHub Codespaces

Configuración opt-in para **Trading** en `main`. Se prepara únicamente el entorno de trabajo; **no crea ningún Codespace ni ejecuta tareas automáticamente**. El código sigue en GitHub y el ordenador personal puede estar apagado.

## Primera apertura (una vez por Codespace)

1. En [el repositorio](https://github.com/fmaranis/Trading), pulsa **Code → Codespaces → Create codespace on main**. Elige máquina **2-core**, para consumir la menor cuota mensual.
2. En la configuración de tu cuenta GitHub, sección **Codespaces secrets**, crea el secreto **`OPENCODE_PASSWORD`** con una contraseña nueva de **16 caracteres o más**, y autoriza explícitamente este repositorio. No guardes esta contraseña en código, commit, script, historial ni captura. Si el Codespace ya estaba abierto cuando creaste el secreto, detenlo y reanúdalo para disponer de la variable.
3. En el terminal del Codespace ejecuta:

   ```bash
   bash .devcontainer/start-opencode.sh
   ```

   La instalación de la CLI oficial `@opencode/cli` se intenta **una sola vez en la creación del Codespace** mediante `postCreateCommand`; si falló, vuelve a instalar manualmente con `npm install -g @opencode/cli`. No se instalan automáticamente dependencias de la app ni se ejecutan pruebas.
4. En la pestaña **Ports**, localiza **4096** y verifica que la visibilidad sea **Private** (nunca Public). Pulsa **Open in Browser**. Accedes con tu identidad GitHub y, si se solicita, usuario `opencode` y el secreto `OPENCODE_PASSWORD`. El URL privado del puerto funciona tanto desde Android como desde un ordenador, mientras este Codespace esté encendido.
5. En OpenCode conecta únicamente un **modelo gratuito o incluido** en tu suscripción y establece cuotas compatibles. **No** uses proveedores con facturación por token, fallbacks de pago ni credenciales de API de cobro. No es necesario suscribir un servicio adicional.

## Agentes previos: qué se reutiliza y qué falta

- OpenCode **no importa automáticamente** `~/.config/opencode/opencode.jsonc` ni los agentes globales de la instalación Windows antigua: esos datos viven fuera del repositorio. El primer Codespace tiene la CLI, pero **todavía no tiene asegurado el coordinador/programador/auditor/pruebas personalizados**.
- Para migrar los cuatro agentes, transferir una **copia depurada** de definiciones y reglas, **sin** `auth.json`, secretos, tokens ni rutas absolutas Windows. Reemplazar scripts PowerShell locales por comandos válidos en Linux y comprobar permisos reales antes de delegar.
- El supervisor GPT final no se crea ni se activa en esta fase. Cuando existan las definiciones migradas, deberá dispararse **una sola vez tras PASS de guards**, no durante cada acción, y únicamente si el proveedor disponible no cobra aparte.
- `main` y **PROJECT_STATE.md** siguen siendo fuente de verdad. **Centro de validación del backend; no GitHub Actions ni replays largos dentro de Codespaces.**

## Límites y seguridad

- GitHub Free personal incluye, según GitHub, **120 core-hours/mes y 15 GB de almacenamiento/mes** (60 horas con máquina 2-core). La cuota se comparte entre los Codespaces personales; **dos Codespaces no duplican la cuota**. Si hay método de pago/budget con gasto permitido, puede existir facturación; verificar presupuesto y bloquear gasto extra antes de usarlos.
- Codespaces se detiene por inactividad; por defecto el timeout es **30 minutos**, y no equivale a un servicio gratuito 24/7. Tras detenerse, reanudarlo y reiniciar `bash .devcontainer/start-opencode.sh`. Un proceso ejecutándose no garantiza que GitHub lo mantenga vivo indefinidamente.
- Nunca abrir el puerto 4096 públicamente. `OPENCODE_PASSWORD` va como secreto privado de Codespaces, no al repositorio. Evitar copiar datos privados, archivos de producción o estados fiscales de cartera al código.
- Este entorno **no ejecuta GitHub Actions** ni calcula automáticamente backtests/replays/importaciones. El botón **Create codespace** y el inicio del agente son acciones explícitas del usuario, que pueden consumir la cuota gratuita.
- El disco USB del router no hace falta: los archivos de aplicación y commits están en GitHub, pero el trabajo de los agentes requiere la CPU del Codespace mientras esté activo.

## Estado de implantación

`CONFIG_COMMITTED / CODESPACE_NOT_CREATED_OR_RUNTIME_VERIFIED / PREVIOUS_LOCAL_AGENT_CONFIG_NOT_MIGRATED`.

Una vez creado el primer Codespace, verificar en el terminal `opencode --version`, abrir el puerto privado, comprobar que OpenCode se autentica y ejecutar un primer guard rápido permitido. Solo después declarar funcionamiento remoto validado.
