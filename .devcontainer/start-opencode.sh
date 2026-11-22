#!/usr/bin/env bash
# Run with: bash .devcontainer/start-opencode.sh
set -euo pipefail

if [[ "${CODESPACES:-}" != "true" ]]; then
  echo "Este lanzador está destinado a GitHub Codespaces, no al ordenador local." >&2
  exit 1
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode no está instalado. Prueba: npm install -g @opencode/cli" >&2
  exit 1
fi

if [[ -z "${OPENCODE_PASSWORD:-}" || ${#OPENCODE_PASSWORD} -lt 16 ]]; then
  echo "Falta OPENCODE_PASSWORD (al menos 16 caracteres)." >&2
  echo "Configúralo como secreto personal de GitHub Codespaces con acceso a este repositorio." >&2
  echo "No introduzcas claves en archivos, commits ni capturas de pantalla." >&2
  exit 1
fi

echo "OpenCode iniciando en el puerto 4096."
echo "En Codespaces: pestaña PORTS -> 4096 -> Private -> Open in Browser."
echo "No cambies el puerto a Public. El servicio se detiene con Ctrl+C o al parar el Codespace."
exec opencode serve --hostname 0.0.0.0 --port 4096
