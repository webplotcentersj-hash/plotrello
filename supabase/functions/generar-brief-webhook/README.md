# Edge Function: generar-brief-webhook

Esta función Edge de Supabase genera un nuevo brief público y devuelve el link para ser enviado por WhatsApp a través de n8n.

## Despliegue

```bash
# Desde la raíz del proyecto
supabase functions deploy generar-brief-webhook
```

## Variables de Entorno

Configura estas variables en el dashboard de Supabase:

- `SUPABASE_URL`: Se configura automáticamente
- `SUPABASE_SERVICE_ROLE_KEY`: Se configura automáticamente
- `BRIEF_BASE_URL`: URL base de tu aplicación (opcional, por defecto usa Vercel)

## Uso

### Request

```bash
POST https://TU_PROJECT_ID.supabase.co/functions/v1/generar-brief-webhook
Authorization: Bearer TU_SUPABASE_ANON_KEY
Content-Type: application/json

{
  "telefono": "+5491123456789",
  "nombre_cliente": "Juan Pérez",
  "usuario_id": 1
}
```

### Response

```json
{
  "success": true,
  "data": {
    "token": "abc123xyz789",
    "brief_url": "https://tu-app.vercel.app/brief/abc123xyz789",
    "mensaje_whatsapp": "Hola Juan Pérez! 👋\n\nTe envío el formulario...",
    "telefono": "+5491123456789",
    "nombre_cliente": "Juan Pérez"
  }
}
```

## Campos

- `telefono` (requerido): Número de teléfono del cliente en formato internacional
- `nombre_cliente` (opcional): Nombre del cliente
- `usuario_id` (opcional): ID del usuario que crea el brief (para tracking)

