# 🧪 Probar el Bot de Telegram

## Verificar que el Webhook Está Funcionando

El error que ves (`"last_error_message": "Wrong response..."`) es de un intento anterior. El hecho de que `pending_update_count: 0` significa que Telegram procesó el último mensaje correctamente.

## Pasos para Probar

### 1. Verificar el Estado Actual

Ejecuta este comando para ver el estado actual del webhook:

```bash
curl "https://api.telegram.org/bot8243440644:AAFLS-SxFOtETLrIl2vFKq-iz9JA7-mDiPc/getWebhookInfo"
```

Si ves `pending_update_count: 0`, el webhook está funcionando.

### 2. Probar el Bot en Telegram

1. Abre Telegram en tu teléfono o computadora
2. Busca tu bot (usa el username que le diste a BotFather)
3. Haz clic en "Start" o envía el comando `/start`
4. Deberías recibir un mensaje de bienvenida

### 3. Probar Comandos

- `/start` - Debería mostrar el mensaje de bienvenida
- `/help` - Debería mostrar los comandos disponibles
- `/status` - Debería mostrar el estado del sistema

### 4. Probar Preguntas

Envía una pregunta normal como:
- "¿Cuántas OPs hay?"
- "Muéstrame el estado del sistema"
- "¿Cuáles son las OPs urgentes?"

## Si No Funciona

### Revisar Logs en Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Selecciona tu proyecto
3. Ve a **Deployments**
4. Haz clic en el último despliegue
5. Ve a la pestaña **Functions**
6. Busca `api/telegram/webhook`
7. Revisa los logs para ver errores específicos

### Verificar Variables de Entorno

Asegúrate de tener configuradas en Vercel:
- `TELEGRAM_BOT_TOKEN` = `8243440644:AAFLS-SxFOtETLrIl2vFKq-iz9JA7-mDiPc`
- `VITE_SUPABASE_URL` = tu URL de Supabase
- `VITE_SUPABASE_ANON_KEY` = tu clave anónima
- `GEMINI_API_KEY` = tu API key de Gemini

### Limpiar el Error Anterior

Si quieres limpiar el error anterior, puedes eliminar y volver a configurar el webhook:

```bash
# Eliminar webhook
curl -X POST "https://api.telegram.org/bot8243440644:AAFLS-SxFOtETLrIl2vFKq-iz9JA7-mDiPc/deleteWebhook"

# Volver a configurar
curl -X POST "https://api.telegram.org/bot8243440644:AAFLS-SxFOtETLrIl2vFKq-iz9JA7-mDiPc/setWebhook?url=https://plotrello.vercel.app/api/telegram/webhook"
```

## Estado Actual

Según la información que veo:
- ✅ Webhook configurado: `https://plotrello.vercel.app/api/telegram/webhook`
- ✅ `pending_update_count: 0` - No hay mensajes pendientes
- ⚠️ `last_error_message: "Wrong response..."` - Error de un intento anterior

El bot debería funcionar ahora. Prueba enviando un mensaje en Telegram.

