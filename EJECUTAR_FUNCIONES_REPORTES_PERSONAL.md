# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos:

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-17_add_funciones_reportes_personal.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

## Funciones creadas:

1. **`obtener_estadisticas_usuario`**: Obtiene estadísticas de actividad y productividad de un usuario específico
   - Parámetros: `p_id_usuario`, `p_fecha_desde` (opcional), `p_fecha_hasta` (opcional)
   - Retorna: Total de órdenes, completadas, en proceso, pendientes, movimientos, promedio días, sector principal, última actividad

2. **`obtener_estadisticas_sector`**: Obtiene estadísticas de actividad y productividad de un sector específico
   - Parámetros: `p_sector`, `p_fecha_desde` (opcional), `p_fecha_hasta` (opcional)
   - Retorna: Total de órdenes, completadas, en proceso, usuarios activos, promedio días, tasa de completitud

3. **`obtener_estadisticas_periodo`**: Obtiene estadísticas generales de actividad y productividad en un período
   - Parámetros: `p_fecha_desde`, `p_fecha_hasta`
   - Retorna: Total de órdenes, completadas, en proceso, usuarios activos, movimientos totales, promedio días, órdenes por día

## Uso:

Estas funciones se utilizan automáticamente desde la página de Reportes de Personal en Recursos Humanos.

