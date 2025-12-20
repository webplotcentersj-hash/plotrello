# Unificación de Tablas de Clientes

## Objetivo
Unificar las tablas `clientes` y `clientes_web` en una sola tabla `clientes` para que todos los clientes (del tablero principal, web, DT) estén en la misma tabla con los mismos datos.

## Cambios Realizados

### 1. Estructura Unificada
- La tabla `clientes` ahora contiene todos los campos necesarios:
  - Campos del tablero principal: `nombre`, `dni_cuit`, `telefono`, `email`, `direccion`, `ubicacion_link`, `drive_link`
  - Campos de clientes web: `usuario`, `password_hash`, `activo`, `es_cliente_web`
  - Campos comunes: `apellido`, `empresa`, `created_at`, `updated_at`

### 2. Migración de Datos
- Los datos de `clientes_web` se migran automáticamente a `clientes`
- Si un cliente ya existe (por email o usuario), se actualiza en lugar de duplicar
- Todos los clientes web quedan marcados con `es_cliente_web = true`

### 3. Funciones Actualizadas
- `crear_cliente`: Ahora inserta en `clientes` con `es_cliente_web = true`
- `autenticar_cliente`: Busca en `clientes` con `es_cliente_web = true`
- `actualizar_cliente`: Actualiza en `clientes` con validación de `es_cliente_web`
- `crear_pedido_cliente`: Valida que el cliente sea web y esté activo

### 4. Código Frontend Actualizado
- `getClientesWeb()`: Ahora consulta `clientes` con `es_cliente_web = true`
- `autenticarClienteWeb()`: Usa la tabla unificada

## Cómo Ejecutar la Migración

### Opción 1: Usando Supabase Dashboard (Recomendado)
1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor**
3. Abre el archivo `supabase/patches/2025-01-17_unificar_tablas_clientes.sql`
4. Copia y pega todo el contenido
5. Haz clic en **Run** o presiona `Ctrl+Enter`
6. Verifica que no haya errores

### Opción 2: Usando Supabase CLI
```bash
supabase db execute -f supabase/patches/2025-01-17_unificar_tablas_clientes.sql
```

### Opción 3: Ejecutar directamente en PostgreSQL
```bash
psql -h [tu-host] -U [tu-usuario] -d [tu-database] -f supabase/patches/2025-01-17_unificar_tablas_clientes.sql
```

## Verificación Post-Migración

Después de ejecutar el script, verifica:

1. **Datos migrados correctamente:**
```sql
SELECT COUNT(*) FROM clientes WHERE es_cliente_web = true;
-- Debe ser igual o mayor al número de registros que había en clientes_web
```

2. **Funciones actualizadas:**
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('crear_cliente', 'autenticar_cliente', 'actualizar_cliente')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Verifica que las funciones usen 'clientes' en lugar de 'clientes_web'
```

3. **Prueba crear un cliente web:**
- Intenta crear un nuevo cliente desde la gestión de clientes web
- Verifica que aparezca en la lista
- Verifica que tenga `es_cliente_web = true` en la base de datos

## Notas Importantes

⚠️ **IMPORTANTE**: 
- La tabla `clientes_web` NO se elimina automáticamente por seguridad
- Después de verificar que todo funciona correctamente, puedes eliminarla manualmente:
  ```sql
  DROP TABLE IF EXISTS public.clientes_web CASCADE;
  ```
- Asegúrate de hacer un backup antes de ejecutar la migración

## Beneficios

✅ **Unificación de datos**: Todos los clientes en una sola tabla
✅ **Consistencia**: Mismo cliente visto desde cualquier parte del sistema
✅ **Mantenimiento**: Más fácil mantener y actualizar datos de clientes
✅ **Búsqueda**: Búsquedas unificadas de clientes desde cualquier módulo

## Próximos Pasos

Después de ejecutar la migración:
1. Verifica que los clientes web existentes funcionen correctamente
2. Prueba crear nuevos clientes desde diferentes módulos
3. Verifica que las búsquedas funcionen correctamente
4. Una vez confirmado todo, elimina la tabla `clientes_web` (opcional)

