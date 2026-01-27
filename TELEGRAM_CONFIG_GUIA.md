# 📘 Guía Detallada: Configurar Bot de Telegram (Pasos 2 y 3)

Esta guía te explica paso a paso cómo configurar las variables de entorno en Vercel y configurar el webhook del bot.

---

## 🔧 Paso 2: Configurar Variables de Entorno en Vercel

### 2.1. Acceder a tu Proyecto en Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. En el dashboard, busca y haz clic en tu proyecto (el que tiene tu aplicación PlotAI)

### 2.2. Ir a la Sección de Variables de Entorno

1. Una vez dentro de tu proyecto, busca la pestaña **"Settings"** (Configuración) en el menú superior
2. En el menú lateral izquierdo, haz clic en **"Environment Variables"** (Variables de Entorno)

### 2.3. Agregar TELEGRAM_BOT_TOKEN

1. En la sección de variables de entorno, verás un formulario con tres campos:
   - **Key** (Clave): Aquí escribes el nombre de la variable
   - **Value** (Valor): Aquí escribes el valor
   - **Environment** (Entorno): Aquí seleccionas dónde aplica

2. Para agregar el token del bot:
   - **Key**: `TELEGRAM_BOT_TOKEN`
   - **Value**: Pega aquí el token que te dio BotFather (algo como `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
   - **Environment**: Selecciona **"Production"** (y opcionalmente "Preview" y "Development" si quieres que funcione en todos los entornos)

3. Haz clic en el botón **"Add"** o **"Save"**

### 2.4. Agregar TELEGRAM_ALLOWED_USERS (Opcional pero Recomendado)

1. Obtén tu User ID de Telegram:
   - Busca `@userinfobot` en Telegram
   - Inicia una conversación con él
   - Te mostrará tu User ID (un número como `123456789`)
   - **Copia este número**

2. Si quieres autorizar múltiples usuarios:
   - Separa los User IDs con comas, sin espacios
   - Ejemplo: `123456789,987654321,555555555`

3. Agrega la variable:
   - **Key**: `TELEGRAM_ALLOWED_USERS`
   - **Value**: Pega los User IDs separados por comas (ejemplo: `123456789,987654321`)
   - **Environment**: Selecciona **"Production"** (y otros si quieres)

4. Haz clic en **"Add"** o **"Save"**

### 2.5. Verificar Variables Agregadas

Deberías ver una lista con tus variables:
- ✅ `TELEGRAM_BOT_TOKEN` → `123456789:ABC...` (oculto)
- ✅ `TELEGRAM_ALLOWED_USERS` → `123456789,987654321`

### 2.6. Redesplegar la Aplicación

⚠️ **IMPORTANTE**: Después de agregar variables de entorno, necesitas redesplegar:

1. Ve a la pestaña **"Deployments"** (Despliegues)
2. Encuentra el último despliegue
3. Haz clic en los tres puntos (⋯) a la derecha
4. Selecciona **"Redeploy"** (Redesplegar)
5. Confirma el redespliegue

**O simplemente haz un nuevo commit y push** - Vercel redesplegará automáticamente.

---

## 🔗 Paso 3: Configurar el Webhook

El webhook es la conexión entre Telegram y tu aplicación. Telegram enviará los mensajes a tu URL de Vercel.

### 3.1. Obtener la URL de tu Endpoint

Tu endpoint estará en:
```
https://tu-dominio.vercel.app/api/telegram/webhook
```

**Ejemplos:**
- Si tu dominio es `plotai.vercel.app` → `https://plotai.vercel.app/api/telegram/webhook`
- Si tu dominio es `mi-app-abc123.vercel.app` → `https://mi-app-abc123.vercel.app/api/telegram/webhook`

**¿Cómo saber cuál es tu dominio?**
1. Ve a Vercel → Tu proyecto → Pestaña **"Deployments"**
2. Haz clic en el último despliegue exitoso
3. Verás la URL en la parte superior (algo como `https://tu-proyecto-abc123.vercel.app`)
4. Agrega `/api/telegram/webhook` al final

### 3.2. Configurar el Webhook usando la Terminal (Recomendado)

Abre tu terminal (PowerShell en Windows, Terminal en Mac/Linux) y ejecuta:

```bash
curl -X POST "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://tu-dominio.vercel.app/api/telegram/webhook"
```

**Reemplaza:**
- `<TU_TOKEN>` con el token que te dio BotFather (sin los `< >`)
- `https://tu-dominio.vercel.app/api/telegram/webhook` con tu URL real

**Ejemplo real:**
```bash
curl -X POST "https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://mi-app-abc123.vercel.app/api/telegram/webhook"
```

**En PowerShell (Windows):** Si `curl` no funciona, usa:
```powershell
Invoke-WebRequest -Uri "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://tu-dominio.vercel.app/api/telegram/webhook" -Method POST
```

### 3.3. Configurar el Webhook usando el Navegador (Alternativa)

Si prefieres usar el navegador:

1. Abre una nueva pestaña
2. Ve a esta URL (reemplazando los valores):
```
https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://tu-dominio.vercel.app/api/telegram/webhook
```

**Ejemplo:**
```
https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://mi-app-abc123.vercel.app/api/telegram/webhook
```

3. Deberías ver una respuesta JSON como:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### 3.4. Verificar que el Webhook Está Configurado

Para verificar que todo está bien, ejecuta:

```bash
curl "https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo"
```

**O en el navegador:**
```
https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo
```

Deberías ver algo como:
```json
{
  "ok": true,
  "result": {
    "url": "https://tu-dominio.vercel.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

Si ves `"url"` con tu URL correcta, ¡está configurado! ✅

### 3.5. Probar el Bot

1. Abre Telegram
2. Busca tu bot (por el username que le diste a BotFather)
3. Haz clic en **"Start"** o envía `/start`
4. Deberías recibir un mensaje de bienvenida

Si funciona, ¡felicidades! 🎉 El bot está configurado correctamente.

---

## 🐛 Solución de Problemas

### El webhook no se configura

**Problema:** Recibes un error al configurar el webhook

**Soluciones:**
1. Verifica que el token del bot sea correcto (sin espacios extra)
2. Verifica que la URL sea correcta y accesible
3. Asegúrate de que tu aplicación esté desplegada en Vercel
4. Espera unos minutos después del despliegue antes de configurar el webhook

### El bot no responde

**Problema:** Configuraste el webhook pero el bot no responde

**Soluciones:**
1. Verifica que `TELEGRAM_BOT_TOKEN` esté configurado en Vercel
2. Verifica que hayas redesplegado después de agregar las variables
3. Revisa los logs de Vercel:
   - Ve a tu proyecto → Pestaña **"Deployments"**
   - Haz clic en el último despliegue → Pestaña **"Functions"**
   - Busca `api/telegram/webhook` y revisa los logs
4. Verifica que tu User ID esté en `TELEGRAM_ALLOWED_USERS` (si lo configuraste)

### Error "No tienes permiso"

**Problema:** El bot responde con "No tienes permiso"

**Soluciones:**
1. Verifica que tu User ID esté en `TELEGRAM_ALLOWED_USERS`
2. Obtén tu User ID correcto con `@userinfobot`
3. Si no quieres restricciones, elimina la variable `TELEGRAM_ALLOWED_USERS` y redesplega

---

## 📝 Resumen Rápido

**Paso 2:**
1. Vercel → Tu proyecto → Settings → Environment Variables
2. Agregar `TELEGRAM_BOT_TOKEN` = tu token
3. Agregar `TELEGRAM_ALLOWED_USERS` = tus User IDs (opcional)
4. Redesplegar

**Paso 3:**
1. Obtener URL: `https://tu-dominio.vercel.app/api/telegram/webhook`
2. Ejecutar: `curl -X POST "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=<TU_URL>"`
3. Verificar: `curl "https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo"`
4. Probar en Telegram

---

¿Necesitas ayuda con algún paso específico? ¡Dime cuál y te ayudo!

