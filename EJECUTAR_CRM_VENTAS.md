# ⚠️ URGENTE: Ejecutar Fix SQL para CRM de Ventas

## Problema
La función `public.agregar_item_venta` no existe en la base de datos, lo que **IMPIDE GUARDAR LAS VENTAS**.

## Solución Rápida (RECOMENDADA)
Ejecuta el script consolidado que arregla todo de una vez:

### Pasos:

1. **Abre Supabase Dashboard** → Tu proyecto → **SQL Editor**
2. **Copia y pega TODO el contenido** del archivo:
   ```
   supabase/patches/2025-01-21_FIX_CRM_VENTAS_COMPLETO.sql
   ```
3. **Ejecuta el script completo** (botón "Run" o F5)
4. **Verifica que no haya errores** - deberías ver un mensaje de éxito

## Verificación Inmediata

Después de ejecutar, verifica que las funciones existan:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'agregar_item_venta',
    'crear_venta_directa'
  );
```

**Debes ver 2 funciones listadas.** Si ves ambas, el problema está resuelto.

## Si el script consolidado no funciona

Ejecuta estos archivos en orden:

1. ✅ `supabase/patches/2025-01-21_create_crm_ventas.sql`
2. ✅ `supabase/patches/2025-01-21_crear_venta_directa.sql`
3. ✅ `supabase/patches/2025-01-21_add_id_venta_to_stock_movimientos.sql`

## Nota Importante
- El script usa `DROP FUNCTION IF EXISTS` y `CREATE OR REPLACE FUNCTION`, así que es seguro ejecutarlo múltiples veces
- Si ves errores, cópialos y compártelos para diagnóstico
- Después de ejecutar, **refresca la aplicación** (F5 en el navegador)

