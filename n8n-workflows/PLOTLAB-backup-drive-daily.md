# PlotLab — Backup diario a Google Drive (JSON + PDF)

Este flujo guarda **todos los días** en Google Drive:

- `plotlab-backup-YYYY-MM-DD.json` (snapshot de órdenes + historial + usuarios)
- `plotlab-fichas-activas-YYYY-MM-DD.pdf` (fichas activas del tablero)

## Requisitos (Vercel)

Configurar variables de entorno en Vercel (Production):

- `SUPABASE_SERVICE_ROLE_KEY` (recomendado para que el endpoint lea todo sin depender de sesión)
- `PLOT_LAB_BACKUP_TOKEN` (un token secreto, largo, para que los endpoints no sean públicos)

Endpoints:

- `GET /api/admin/backup-json?limitHistorial=50000`
- `GET /api/admin/fichas-activas-pdf`

Ambos requieren header:

- `Authorization: Bearer <PLOT_LAB_BACKUP_TOKEN>`

## Requisitos (n8n)

1. Importar `n8n-workflows/plotlab-backup-drive-daily.json`
2. Configurar credenciales de Google Drive (OAuth2) en los nodos “Drive - Subir …”
3. Crear variables de entorno en n8n:

- `PLOT_LAB_BACKUP_TOKEN` (mismo que en Vercel)
- `GDRIVE_PLOTLAB_BACKUP_FOLDER_ID` (ID de la carpeta destino en Google Drive)

## Notas

- El workflow está en **inactive** por defecto.
- Podés cambiar el horario del Cron (por defecto 23:30).

