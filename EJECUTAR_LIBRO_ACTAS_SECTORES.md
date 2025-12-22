# Ejecutar Sistema de Libro de Actas por Sector

Este patch crea un sistema completo de libro de actas para que cada sector pueda registrar novedades, problemas, mejoras, incidentes, reuniones, capacitaciones, etc.

## Características:

- ✅ Tabla `libro_actas_sectores` con todos los campos necesarios
- ✅ Funciones SQL para CRUD completo (crear, listar, obtener, actualizar, eliminar)
- ✅ Filtros por tipo de novedad, fecha, sector
- ✅ Políticas RLS para seguridad
- ✅ Trigger automático para `updated_at`
- ✅ Tipos de novedad: general, problema, mejora, incidente, reunión, capacitación, otro

## Pasos para ejecutar:

1. Abre el SQL Editor en Supabase Dashboard
2. Copia y pega el contenido completo del archivo:
   ```
   supabase/patches/2025-01-17_create_libro_actas_sectores.sql
   ```
3. Ejecuta el script
4. Verifica que no haya errores

## Verificación:

Después de ejecutar el patch, verifica que:
- La tabla `libro_actas_sectores` existe
- Las funciones SQL están creadas:
  - `crear_acta_sector`
  - `listar_actas_sector`
  - `obtener_acta_sector`
  - `actualizar_acta_sector`
  - `eliminar_acta_sector`

## Cómo acceder:

Una vez ejecutado el patch, puedes acceder al libro de actas de cualquier sector usando la URL:
```
/libro-actas/sector/:sectorId
```

Donde `:sectorId` es el ID del sector (puedes obtenerlo desde la tabla `sectores`).

### Ejemplo:
- Diseño Gráfico (ID: 1): `/libro-actas/sector/1`
- Taller de Imprenta (ID: 2): `/libro-actas/sector/2`
- Taller Gráfico (ID: 3): `/libro-actas/sector/3`
- etc.

## Funcionalidades:

1. **Crear Acta**: Los usuarios pueden crear nuevas actas con título, contenido, tipo de novedad y fecha
2. **Listar Actas**: Ver todas las actas del sector con filtros
3. **Editar Acta**: Solo el creador o administradores pueden editar
4. **Eliminar Acta**: Solo el creador o administradores pueden eliminar
5. **Filtros**: Por tipo de novedad, fecha desde/hasta

## Notas:

- Este patch es seguro de ejecutar en producción
- No afecta datos existentes
- Las políticas RLS permiten que todos los usuarios autenticados lean y creen actas
- Solo el creador o administradores pueden editar/eliminar

