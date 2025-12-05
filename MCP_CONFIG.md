# 🔌 Configuración MCP (Model Context Protocol)

## ¿Qué es MCP?

MCP (Model Context Protocol) permite que los modelos de IA accedan a recursos y herramientas externas de forma estandarizada. En Cursor, puedes configurar servidores MCP para extender las capacidades del asistente.

## 📋 MCPs Disponibles

### 1. Supabase MCP (Ya configurado)
- ✅ Gestión de base de datos
- ✅ Ejecución de SQL
- ✅ Migraciones
- ✅ Edge Functions
- ✅ Logs y diagnósticos

### 2. MCPs que puedes agregar

#### GitHub MCP
Para gestionar repositorios, issues, PRs, etc.

#### Filesystem MCP
Para acceso avanzado al sistema de archivos.

#### MCP Personalizado
Para funcionalidades específicas de tu proyecto.

## 🔧 Cómo Configurar MCPs en Cursor

### Opción 1: Configuración en Cursor Settings

1. Abre Cursor Settings (`Ctrl + ,` o `Cmd + ,`)
2. Busca "MCP" o "Model Context Protocol"
3. Agrega la configuración del servidor MCP

### Opción 2: Archivo de Configuración

Los MCPs se configuran típicamente en:
- Windows: `%APPDATA%\Cursor\User\globalStorage\mcp.json`
- macOS: `~/Library/Application Support/Cursor/User/globalStorage/mcp.json`
- Linux: `~/.config/Cursor/User/globalStorage/mcp.json`

## 📝 Ejemplo de Configuración

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-supabase"
      ],
      "env": {
        "SUPABASE_URL": "https://tu-proyecto.supabase.co",
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
        "GITHUB_PERSONAL_ACCESS_TOKEN": "tu-token"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/ruta/al/proyecto"
      ]
    }
  }
}
```

## 🚀 MCP Personalizado para este Proyecto

Puedo crear un servidor MCP personalizado que exponga:
- Gestión de órdenes de trabajo
- Estadísticas y reportes
- Notificaciones
- Chat y mensajes
- Usuarios y permisos

¿Quieres que cree un servidor MCP personalizado para este proyecto?

## 📚 Recursos

- [Documentación oficial de MCP](https://modelcontextprotocol.io/)
- [Servidores MCP disponibles](https://github.com/modelcontextprotocol/servers)
- [Guía de desarrollo MCP](https://modelcontextprotocol.io/docs)

