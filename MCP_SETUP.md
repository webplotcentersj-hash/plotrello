# 🔌 Configuración MCP para Cursor

## 📍 Ubicación del archivo

El archivo de configuración MCP está en:
```
C:\Users\USUARIO\.cursor\mcp.json
```

## 🚀 Configuración Recomendada

### Opción 1: Solo Vercel (Actual)

```json
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-vercel"
      ],
      "env": {
        "VERCEL_API_TOKEN": "tu-vercel-api-token"
      }
    }
  }
}
```

### Opción 2: Configuración Completa (Recomendada)

```json
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-vercel"
      ],
      "env": {
        "VERCEL_API_TOKEN": "tu-vercel-api-token"
      }
    },
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-supabase"
      ],
      "env": {
        "SUPABASE_URL": "https://bwdtrzcdzbzrtykjzber.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "tu-service-role-key"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "tu-token-github"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\USUARIO\\Desktop\\Recue\\Trello\\7"
      ]
    }
  }
}
```

## 🔑 Cómo Obtener las Credenciales

### Vercel API Token

1. Ve a https://vercel.com/account/tokens
2. Haz clic en "Create Token"
3. Dale un nombre (ej: "Cursor MCP")
4. Copia el token generado
5. Pégalo en `VERCEL_API_TOKEN`

### Supabase Service Role Key

1. Ve a tu proyecto en https://app.supabase.com
2. Settings → API
3. Copia "service_role" key (⚠️ NO la anon key)
4. Pégalo en `SUPABASE_SERVICE_ROLE_KEY`

### GitHub Personal Access Token

1. Ve a https://github.com/settings/tokens
2. Generate new token (classic)
3. Selecciona scopes: `repo`, `workflow`, `read:org`
4. Copia el token generado
5. Pégalo en `GITHUB_PERSONAL_ACCESS_TOKEN`

## 📝 Pasos para Configurar

1. **Abre el archivo de configuración**:
   ```
   C:\Users\USUARIO\.cursor\mcp.json
   ```

2. **Copia la configuración completa** del archivo `mcp-config-complete.json`

3. **Reemplaza los valores**:
   - `tu-vercel-api-token` → Tu token de Vercel
   - `tu-service-role-key` → Tu service role key de Supabase
   - `tu-token-github` → Tu token de GitHub (opcional)

4. **Guarda el archivo**

5. **Reinicia Cursor** para que cargue la nueva configuración

## ✅ Verificar que Funciona

Después de reiniciar Cursor, deberías poder:
- ✅ Gestionar deployments en Vercel
- ✅ Ejecutar SQL en Supabase
- ✅ Gestionar repositorios en GitHub
- ✅ Acceder a archivos del proyecto

## 🔒 Seguridad

⚠️ **IMPORTANTE**: 
- El archivo `mcp.json` contiene credenciales sensibles
- NO lo subas a Git (debería estar en `.gitignore`)
- Mantén tus tokens seguros y no los compartas

## 🆘 Solución de Problemas

### El servidor MCP no se conecta

1. Verifica que las credenciales sean correctas
2. Asegúrate de que `npx` esté disponible en tu PATH
3. Revisa la consola de Cursor para ver errores
4. Reinicia Cursor completamente

### Error de autenticación

- Verifica que los tokens no hayan expirado
- Regenera los tokens si es necesario
- Asegúrate de usar el token correcto (service_role para Supabase, no anon)

