Capturas para docs/IMPLEMENTACION_BITACORA_OPERARIOS.html

Regenerar (componentes reales de la app en dev):

  npm run dev
  npm run docs:bitacora-capturas

Capturas desde producción (datos reales de la DB):

  set DOC_STAFF_USER=tu@usuario
  set DOC_STAFF_PASS=...
  set BASE_URL=https://www.plotcenterlab.com.ar
  node scripts/capture-bitacora-screenshots.mjs --live

Archivos (recomendado 1200px ancho, generados a 1280×2 DPR):

01-fab-boton.png          — Botón flotante del anotador (esquina inferior derecha)
02-fab-tabs.png           — Panel abierto: pestañas Bitácora / Checklist / Anotador
03-fab-composer.png       — Formulario: trabajo, título, OP, horario, adjuntos
04-fab-lista-hoy.png      — Lista "Hoy · N entradas"
05-admin-acceso-header.png — Header tablero: chip Actividades + quick nav
06-admin-plot-design-btn.png — Botón "Actividades operarios" en /plot-design
07-supervision-calendario.png — Panel /actividades-operarios con calendario
08-supervision-dia.png    — Encabezado del día + tarjetas por operario
09-supervision-modal.png  — Modal detalle de una entrada
10-legajo-tab.png         — Ver legajo → pestaña Actividades Plot

Tras agregar imágenes, abrir el HTML en el navegador; si existe el archivo, se muestra la foto; si no, el recuadro guía.
