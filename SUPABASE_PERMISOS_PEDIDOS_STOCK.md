# 🔐 Configuración de Permisos para Pedidos y Stock

Este documento explica cómo configurar los permisos necesarios para que funcionen correctamente los sistemas de **Pedidos de Compra** y **Gestión de Stock**.

## ⚠️ Problema

Si ves errores como:
- `new row violates row-level security policy`
- `permission denied for table pedidos_compras`
- `permission denied for table articulos`
- Los botones no funcionan o no se pueden crear pedidos/artículos

Significa que **faltan permisos** en Supabase.

## ✅ Solución: Ejecutar Scripts SQL

### Paso 1: Permisos para Pedidos de Compra (Base Principal)

**Este script se ejecuta en tu BASE DE DATOS PRINCIPAL de Supabase** (la que usa `VITE_SUPABASE_URL`).

1. Ve a tu proyecto en Supabase: https://app.supabase.com
2. Selecciona tu proyecto principal
3. Ve a **SQL Editor** (menú lateral izquierdo)
4. Abre el archivo: `supabase/patches/2025-01-15_fix_pedidos_stock_permissions.sql`
5. Copia y pega todo el contenido en el SQL Editor
6. Haz clic en **Run** (o presiona `Ctrl+Enter`)
7. Verifica que aparezcan mensajes de éxito (✅)

Este script otorga permisos para:
- `pedidos_compras`
- `pedidos_compras_items`
- `pedidos_compras_comentarios`
- `stock_movimientos`

### Paso 2: Permisos para Base de Stock (Base Separada)

**Este script se ejecuta en tu BASE DE DATOS DE STOCK** (la que usa `VITE_STOCK_SUPABASE_URL`).

⚠️ **IMPORTANTE**: Si tu base de stock está en un proyecto Supabase diferente:

1. Ve a ese proyecto en Supabase: https://app.supabase.com
2. Selecciona el proyecto de stock
3. Ve a **SQL Editor**
4. Abre el archivo: `supabase/patches/2025-01-15_fix_stock_database_permissions.sql`
5. Copia y pega todo el contenido en el SQL Editor
6. Haz clic en **Run**
7. Verifica que aparezcan mensajes de éxito (✅)

Este script otorga permisos para:
- `articulos` (tabla de stock)

### Paso 3: Verificar Variables de Entorno

Asegúrate de que estas variables estén configuradas:

#### En desarrollo local (`.env`):
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui

# Si usas base de stock separada:
VITE_STOCK_SUPABASE_URL=https://tu-proyecto-stock.supabase.co
VITE_STOCK_SUPABASE_ANON_KEY=tu-anon-key-stock-aqui
```

#### En Vercel (Settings → Environment Variables):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STOCK_SUPABASE_URL` (si aplica)
- `VITE_STOCK_SUPABASE_ANON_KEY` (si aplica)

**⚠️ IMPORTANTE**: Después de agregar/cambiar variables en Vercel, haz un **Redeploy**.

## 🔍 Verificar que Funcionó

1. Recarga la aplicación
2. Abre la consola del navegador (F12)
3. Intenta crear un pedido o artículo
4. Deberías ver mensajes como:
   - ✅ `Cliente de Supabase inicializado correctamente`
   - ✅ `Cliente de Supabase Stock inicializado correctamente` (si usas base separada)
   - ✅ `Pedido de compra creado exitosamente`
   - ✅ `Artículo creado exitosamente`

Si ves errores en la consola, revisa:
- Que ejecutaste los scripts SQL correctamente
- Que las variables de entorno están configuradas
- Que los mensajes de error en la consola para más detalles

## 📝 Notas Técnicas

### ¿Por qué necesito estos permisos?

Supabase usa **Row Level Security (RLS)** para proteger las tablas. Por defecto, las tablas nuevas:
- No tienen permisos GRANT otorgados
- Pueden tener RLS habilitado sin políticas

Los scripts:
1. Otorgan permisos `GRANT` explícitos a `anon` y `authenticated`
2. Crean políticas RLS permisivas si RLS está habilitado
3. Verifican que los permisos se otorgaron correctamente

### ¿Qué hace cada script?

**`2025-01-15_fix_pedidos_stock_permissions.sql`**:
- Otorga permisos para tablas de pedidos en la base principal
- Crea políticas RLS si están habilitadas
- Verifica que los permisos funcionen

**`2025-01-15_fix_stock_database_permissions.sql`**:
- Otorga permisos para tabla `articulos` en la base de stock
- Crea políticas RLS si están habilitadas
- Verifica que los permisos funcionen

## 🆘 Solución de Problemas

### Error: "permission denied"
- ✅ Ejecuta los scripts SQL nuevamente
- ✅ Verifica que ejecutaste el script en la base de datos correcta
- ✅ Verifica que las variables de entorno están configuradas

### Error: "No hay conexión a Supabase"
- ✅ Verifica `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- ✅ En Vercel, haz un Redeploy después de agregar variables

### Error: "No hay conexión a la base de datos de stock"
- ✅ Verifica `VITE_STOCK_SUPABASE_URL` y `VITE_STOCK_SUPABASE_ANON_KEY`
- ✅ Si no usas base separada, esto es normal (se usa la base principal)

### Los botones no funcionan
- ✅ Abre la consola del navegador (F12)
- ✅ Busca errores en rojo
- ✅ Verifica que los scripts SQL se ejecutaron correctamente
- ✅ Verifica que las variables de entorno están configuradas

## 📞 Soporte

Si después de seguir estos pasos sigues teniendo problemas:
1. Abre la consola del navegador (F12)
2. Copia los mensajes de error completos
3. Verifica que ejecutaste los scripts SQL correctamente
4. Verifica que las variables de entorno están configuradas

