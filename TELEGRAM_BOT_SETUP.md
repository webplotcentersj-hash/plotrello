# 🤖 Bot de Telegram para PlotAI

Este documento explica cómo configurar y usar el bot de Telegram para hablar con PlotAI.

## 📋 Requisitos Previos

1. Una cuenta de Telegram
2. Acceso a BotFather en Telegram (@BotFather)
3. Variables de entorno configuradas en Vercel
4. URL pública de tu aplicación desplegada

## 🚀 Configuración Paso a Paso

### 1. Crear el Bot en Telegram

1. Abre Telegram y busca `@BotFather`
2. Envía el comando `/newbot`
3. Sigue las instrucciones para darle un nombre y username a tu bot
4. BotFather te dará un **token** (algo como `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. **Guarda este token** - lo necesitarás para configurar el bot

### 2. Obtener tu User ID de Telegram

Para autorizar usuarios específicos, necesitas conocer sus User IDs:

1. Busca `@userinfobot` en Telegram
2. Inicia una conversación con él
3. Te mostrará tu User ID (un número como `123456789`)
4. **Guarda este número** - lo necesitarás para autorizar usuarios

### 3. Configurar Variables de Entorno en Vercel

📘 **Para una guía detallada paso a paso, consulta [TELEGRAM_CONFIG_GUIA.md](./TELEGRAM_CONFIG_GUIA.md)**

**Resumen rápido:**

1. Ve a Vercel → Tu proyecto → **Settings** → **Environment Variables**
2. Agrega estas variables:

   **Requerida:**
   - `TELEGRAM_BOT_TOKEN`: El token que te dio BotFather
     ```
     Ejemplo: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
     ```

   **Opcional (recomendado):**
   - `TELEGRAM_ALLOWED_USERS`: Lista de User IDs autorizados separados por comas
     ```
     Ejemplo: 123456789,987654321,555555555
     ```
     - Si no se configura, **cualquiera** podrá usar el bot
     - Si se configura, solo los usuarios listados podrán usarlo

3. **⚠️ IMPORTANTE:** Después de agregar variables, redesplega la aplicación:
   - Ve a **Deployments** → Haz clic en los tres puntos (⋯) → **Redeploy**
   - O simplemente haz un nuevo commit y push

### 4. Configurar el Webhook

📘 **Para una guía detallada paso a paso, consulta [TELEGRAM_CONFIG_GUIA.md](./TELEGRAM_CONFIG_GUIA.md)**

**Resumen rápido:**

1. Obtén la URL de tu endpoint: `https://tu-dominio.vercel.app/api/telegram/webhook`
   - Encuentra tu dominio en Vercel → Tu proyecto → **Deployments** → Último despliegue
   - Agrega `/api/telegram/webhook` al final

2. Configura el webhook ejecutando en tu terminal:

```bash
curl -X POST "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://tu-dominio.vercel.app/api/telegram/webhook"
```

Reemplaza:
- `<TU_TOKEN>` con el token que te dio BotFather (sin los `< >`)
- `https://tu-dominio.vercel.app/api/telegram/webhook` con tu URL real

**En PowerShell (Windows):**
```powershell
Invoke-WebRequest -Uri "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://tu-dominio.vercel.app/api/telegram/webhook" -Method POST
```

**O usa el navegador:** Abre esta URL (reemplazando los valores):
```
https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://tu-dominio.vercel.app/api/telegram/webhook
```

### 5. Verificar el Webhook

Para verificar que el webhook está configurado correctamente:

```bash
curl "https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo"
```

Deberías ver información sobre tu webhook configurado con tu URL.

## 💬 Uso del Bot

### Comandos Disponibles

- `/start` - Iniciar conversación y ver bienvenida
- `/help` - Mostrar ayuda y comandos disponibles
- `/status` - Ver estado actual del sistema (OPs, equipo, etc.)

### Preguntas en Lenguaje Natural

Puedes hacer preguntas normales al bot, por ejemplo:

- "¿Cuántas OPs hay en proceso?"
- "Muéstrame las OPs urgentes"
- "¿Cuál es el estado del Kanban?"
- "¿Quién tiene más carga de trabajo?"
- "Dame un resumen de las métricas de hoy"

El bot usará PlotAI para entender tu pregunta y generar una respuesta basada en los datos reales del sistema.

## 🔒 Seguridad

### Autorización de Usuarios

Si configuraste `TELEGRAM_ALLOWED_USERS`:

- Solo los usuarios con User IDs en esa lista podrán usar el bot
- Los demás recibirán un mensaje de "No tienes permiso"

### Sin Autorización

Si **no** configuraste `TELEGRAM_ALLOWED_USERS`:

- **Cualquiera** que encuentre tu bot podrá usarlo
- ⚠️ **No recomendado para producción** si tienes datos sensibles

## 🛠️ Solución de Problemas

### El bot no responde

1. Verifica que el webhook esté configurado correctamente:
   ```bash
   curl "https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo"
   ```

2. Revisa los logs de Vercel para ver si hay errores

3. Verifica que `TELEGRAM_BOT_TOKEN` esté configurado correctamente en Vercel

4. Asegúrate de que tu aplicación esté desplegada y funcionando

### Error "No tienes permiso"

- Verifica que tu User ID esté en `TELEGRAM_ALLOWED_USERS`
- Asegúrate de que los User IDs estén separados por comas sin espacios extra

### El bot responde pero con errores

- Verifica que `GEMINI_API_KEY` esté configurada (necesaria para PlotAI)
- Revisa los logs de Vercel para ver errores específicos
- Verifica que Supabase esté configurado correctamente

## 📝 Notas Importantes

1. **Límites de Telegram**: Los mensajes tienen un límite de 4096 caracteres. Si PlotAI genera una respuesta muy larga, se truncará automáticamente.

2. **Rate Limits**: Telegram tiene límites de velocidad. Si envías muchos mensajes muy rápido, podrías ser limitado temporalmente.

3. **Privacidad**: El bot tiene acceso a todos los datos del sistema. Asegúrate de autorizar solo usuarios de confianza.

4. **Costo**: El uso de PlotAI (Gemini API) puede tener costos asociados según tu uso.

## 🔄 Actualizar el Webhook

Si necesitas cambiar la URL del webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://nueva-url.vercel.app/api/telegram/webhook"
```

Para eliminar el webhook (usar polling en su lugar):

```bash
curl -X POST "https://api.telegram.org/bot<TU_TOKEN>/deleteWebhook"
```

## 📚 Recursos Adicionales

- [Documentación de Telegram Bot API](https://core.telegram.org/bots/api)
- [Guía de BotFather](https://core.telegram.org/bots/tutorial)
- [Documentación de PlotAI](./ADMIN_README.md)

