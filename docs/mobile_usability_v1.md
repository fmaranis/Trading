# Mobile usability V1

Fecha: 2026-09-10

Estado: **FIRST PASS APPLIED / ENGINE UNCHANGED**

## Objetivo

Mejorar la utilización real de Custodia desde teléfono sin modificar scanner, gates, decision engine, allocator, replay ni el protocolo prospectivo QUALITY.

## Problema observado

En Android/WebView el botón `Descargar JSON` del `ResearchValidationCenter` podía no reaccionar al toque. La implementación dependía de que el navegador sintetizara correctamente un `click` desde un toque sobre un botón pequeño y después consumiera un Blob antes de que su object URL fuese revocada.

Además, la interfaz mantenía controles táctiles de menos de 44 px y varias navegaciones simultáneas en teléfono.

## Cambios aplicados

### Descarga JSON

`src/utils/jsonDownloadCompat.ts`

- mantiene las URLs Blob JSON vivas durante 15 s antes de revocarlas;
- añade un bridge específico `pointerup/touchend -> click` únicamente para el control cuyo texto es `Descargar JSON`;
- ignora botones deshabilitados;
- incluye guard temporal para impedir doble activación;
- no altera el comportamiento táctil de otros botones.

### Base táctil global

`src/index.css`

En dispositivos `pointer: coarse`:

- botones, summaries y form controls: `touch-action: manipulation`;
- target mínimo: 44 px;
- inputs/selects/textarea: 16 px para reducir zoom accidental al enfocar;
- feedback de tap visible;
- controles del `ResearchValidationCenter`: tipografía interactiva mínima mayor.

### Navegación móvil

Para anchos menores de 768 px:

- se oculta la tira de tabs de escritorio del header;
- se ocultan los quick-actions superiores duplicados;
- se conserva la barra inferior móvil y el menú `Más...`;
- las acciones del `ResearchValidationCenter` ocupan todo el ancho disponible para facilitar el toque.

## Guard

`tests/jsonDownloadCompat.unit.ts`

Protege 13 invariantes sobre:

- instalación previa al render;
- scope exclusivo JSON;
- revocación retardada;
- activación touch específica;
- anti doble-tap;
- target 44 px;
- inputs móviles 16 px;
- ocultación de navegación duplicada;
- preservación del payload JSON completo.

## Archivos metodológicos

Este pase sólo modifica UI/compatibilidad:

- `src/index.css`
- `src/utils/jsonDownloadCompat.ts`
- `tests/jsonDownloadCompat.unit.ts`

No modifica ninguno de los 25 blobs congelados de `QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1`; la observación prospectiva de septiembre sigue intacta.

## Pendiente para segunda pasada móvil

- revisar tablas anchas y convertir las de uso diario en cards/resúmenes en móvil;
- revisar modales y formularios para teclado virtual/safe areas;
- retirar visualmente textos heredados `Bot 2X / 100 -> 200` que ya no representan la arquitectura productiva;
- revisar densidad de `MarketTracker`, `RiskAnalysisCenter`, alerts y backtest en teléfono;
- mantener una sola recomendación accionable: la del centro canónico.
