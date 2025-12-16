# Integración n8n para Brief Automático por WhatsApp

Esta guía explica cómo configurar n8n para que automáticamente responda a mensajes de WhatsApp con el link del formulario de brief.

## Requisitos Previos

1. **n8n instalado y configurado** con acceso a WhatsApp Business API o un servicio de WhatsApp compatible
2. **Supabase Edge Function** desplegada (`generar-brief-webhook`)
3. **URL de tu aplicación** donde se encuentra el formulario de brief público

## Configuración del Workflow en n8n

### Paso 1: Crear un nuevo workflow

1. Abre n8n y crea un nuevo workflow
2. Nómbralo "Brief Automático WhatsApp"

### Paso 2: Configurar el trigger de WhatsApp

1. Agrega un nodo **Webhook** o **WhatsApp Trigger** (dependiendo de tu proveedor de WhatsApp)
2. Configura el webhook para recibir mensajes entrantes de WhatsApp
3. El webhook debe recibir:
   - `from`: Número de teléfono del remitente (formato internacional, ej: +5491123456789)
   - `body`: Cuerpo del mensaje (opcional, para detectar palabras clave)
   - `name`: Nombre del contacto (opcional)

### Paso 3: Agregar nodo de filtro (opcional)

Si quieres que solo responda a ciertos mensajes:

1. Agrega un nodo **IF** o **Filter**
2. Configura condiciones como:
   - Responder solo si el mensaje contiene palabras clave como "brief", "presupuesto", "proyecto"
   - O responder a todos los mensajes

### Paso 4: Agregar nodo HTTP para generar el brief

1. Agrega un nodo **HTTP Request**
2. Configura:
   - **Method**: `POST`
   - **URL**: `https://TU_PROJECT_ID.supabase.co/functions/v1/generar-brief-webhook`
   - **Authentication**: 
     - Type: `Header Auth`
     - Name: `Authorization`
     - Value: `Bearer TU_SUPABASE_ANON_KEY`
   - **Headers**:
     - `Content-Type`: `application/json`
   - **Body**:
     ```json
     {
       "telefono": "{{ $json.from }}",
       "nombre_cliente": "{{ $json.name || '' }}",
       "usuario_id": null
     }
     ```

### Paso 5: Extraer el link del brief

1. Agrega un nodo **Set** o **Code** para extraer el link de la respuesta
2. La respuesta del webhook tiene esta estructura:
   ```json
   {
     "success": true,
     "data": {
       "token": "abc123...",
       "brief_url": "https://tu-app.com/brief/abc123...",
       "mensaje_whatsapp": "Hola! Te envío el formulario...",
       "telefono": "+5491123456789",
       "nombre_cliente": "Juan Pérez"
     }
   }
   ```

### Paso 6: Enviar respuesta por WhatsApp

1. Agrega un nodo **WhatsApp Send Message** o el nodo correspondiente a tu proveedor
2. Configura:
   - **To**: `{{ $json.from }}` (número del remitente original)
   - **Message**: `{{ $('HTTP Request').item.json.data.mensaje_whatsapp }}`
   - O simplemente: `{{ $('HTTP Request').item.json.data.brief_url }}`

## Ejemplo de Workflow Completo

```
[Webhook Trigger] 
    ↓
[IF: Contiene "brief" o "presupuesto"] 
    ↓
[HTTP Request: Generar Brief]
    ↓
[WhatsApp: Enviar Mensaje]
```

## Variables de Entorno Necesarias

En tu Edge Function de Supabase, asegúrate de tener configuradas:

- `SUPABASE_URL`: URL de tu proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key de Supabase (para poder llamar RPC)
- `BRIEF_BASE_URL`: URL base de tu aplicación (opcional, por defecto usa Vercel)

## Ejemplo de Payload del Webhook

### Entrada (desde WhatsApp):
```json
{
  "from": "+5491123456789",
  "body": "Hola, necesito un presupuesto",
  "name": "Juan Pérez"
}
```

### Salida (respuesta del webhook):
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

## Personalización del Mensaje

Puedes modificar el mensaje en el archivo `supabase/functions/generar-brief-webhook/index.ts` en la variable `mensajeWhatsApp` para personalizar el texto que se envía por WhatsApp.

## Troubleshooting

### Error 401 Unauthorized
- Verifica que estés usando el `SUPABASE_ANON_KEY` correcto en el header `Authorization`
- Asegúrate de que el formato sea: `Bearer TU_ANON_KEY`

### Error 500 Internal Server Error
- Verifica que la función RPC `crear_brief_publico` exista en tu base de datos
- Revisa los logs de la Edge Function en el dashboard de Supabase

### El link no funciona
- Verifica que `BRIEF_BASE_URL` esté configurado correctamente
- Asegúrate de que la ruta `/brief/:token` esté configurada en tu aplicación React

## Seguridad

- **Nunca** expongas tu `SUPABASE_SERVICE_ROLE_KEY` en el frontend
- Usa rate limiting en n8n para evitar spam
- Considera agregar autenticación adicional al webhook si es necesario

