# 🚀 Ejecutar Fix de Movimiento de Fichas

## Script a Ejecutar

**Archivo:** `supabase/patches/2024-11-24_fix_completo_movimiento_fichas.sql`

Este script consolida todas las correcciones necesarias para que las fichas se muevan libremente.

## Pasos para Ejecutar

1. **Ve a Supabase Dashboard:**
   - https://app.supabase.com/project/bwdtrzcdzbzrtykjzber

2. **Abre el SQL Editor:**
   - Menú lateral → SQL Editor

3. **Copia y pega el contenido del archivo:**
   - `supabase/patches/2024-11-24_fix_completo_movimiento_fichas.sql`

4. **Ejecuta el script:**
   - Haz clic en "Run" o presiona `Ctrl + Enter`

5. **Verifica que no haya errores:**
   - Deberías ver mensajes de éxito en la consola

## Qué Corrige Este Script

✅ **Sincronización:**
- NO sincroniza estado ni sector
- Solo sincroniza datos (descripción, prioridad, materiales, etc.)
- Las fichas se mueven independientemente

✅ **Unificación:**
- Solo se ejecuta cuando estado = "Finalizado en Taller"
- NO interfiere con movimientos normales

## Después de Ejecutar

1. Prueba mover una ficha duplicada
2. Verifica que se mantenga en el nuevo estado
3. No debería volver al estado anterior

