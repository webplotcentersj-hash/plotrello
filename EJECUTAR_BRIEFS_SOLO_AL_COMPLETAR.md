# Ejecutar Fix: Briefs Solo se Crean al Completar

## Descripción
Este patch modifica el sistema de briefs para que **solo se creen cuando el cliente los completa**, no cuando se copia el link.

## Cambios Realizados

1. **Nueva tabla `briefs_tokens_pendientes`**: Almacena tokens generados pero aún no completados
2. **Modificación de `crear_brief_publico`**: Solo crea el token pendiente, NO el brief completo
3. **Modificación de `actualizar_brief_publico_completo`**: Crea el brief cuando el cliente guarda el formulario
4. **Modificación de `obtener_brief_por_token`**: Permite acceso al formulario incluso si el token está pendiente
5. **Actualización de `listar_briefs_pendientes`**: Solo muestra briefs completados

## Cómo Ejecutar

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor**
3. Abre el archivo `supabase/patches/2025-01-17_briefs_solo_al_completar.sql`
4. Copia todo el contenido
5. Pégalo en el SQL Editor
6. Haz clic en **Run** o presiona `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### Opción 2: Desde CLI de Supabase

```bash
# Si tienes Supabase CLI instalado
supabase db push

# O ejecutar el archivo directamente
psql -h [TU_HOST] -U postgres -d postgres -f supabase/patches/2025-01-17_briefs_solo_al_completar.sql
```

## Verificación

Después de ejecutar el patch:

1. **Genera un nuevo link de brief** desde el panel
2. **Verifica que NO aparece** en la lista de "Briefs Pendientes"
3. **Completa el formulario** con ese token
4. **Verifica que SÍ aparece** en la lista de "Briefs Pendientes" después de guardar

## Notas Importantes

- Los tokens pendientes existentes seguirán funcionando normalmente
- Los briefs ya creados no se ven afectados
- El formulario público seguirá funcionando igual para los clientes
- Solo cambia cuándo se crea el registro en `briefs_publicos`

## Rollback (Si es necesario)

Si necesitas revertir los cambios, ejecuta:

```sql
-- Eliminar tabla de tokens pendientes
DROP TABLE IF EXISTS public.briefs_tokens_pendientes CASCADE;

-- Restaurar función crear_brief_publico original
-- (Necesitarías tener el backup de la función original)
```

## Soporte

Si encuentras algún problema al ejecutar este patch, verifica:
- Que tienes permisos de administrador en la base de datos
- Que no hay conflictos con otras funciones o tablas
- Los logs de error en Supabase Dashboard → Logs → Postgres Logs

