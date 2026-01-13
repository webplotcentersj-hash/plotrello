# Ejecutar Patch: Agregar id_venta a stock_movimientos

Este patch agrega la columna `id_venta` a la tabla `stock_movimientos` para poder relacionar los movimientos de stock con las ventas del CRM.

## Pasos para ejecutar:

1. **Abrir Supabase Dashboard**
   - Ve a tu proyecto en https://supabase.com/dashboard
   - Navega a la sección "SQL Editor"

2. **Ejecutar el patch SQL**
   - Copia y pega el contenido del archivo:
     `supabase/patches/2025-01-21_add_id_venta_to_stock_movimientos.sql`
   - O ejecuta directamente el siguiente SQL:

```sql
-- Agregar columna id_venta a stock_movimientos para relacionar movimientos con ventas del CRM

BEGIN;

-- Agregar columna id_venta si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'stock_movimientos' 
    AND column_name = 'id_venta'
  ) THEN
    ALTER TABLE public.stock_movimientos
    ADD COLUMN id_venta integer REFERENCES public.ventas(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_stock_movimientos_venta ON public.stock_movimientos(id_venta);
  END IF;
END $$;

COMMIT;
```

3. **Verificar la ejecución**
   - Deberías ver un mensaje de éxito
   - Verifica que la columna se haya agregado correctamente ejecutando:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'stock_movimientos' 
   AND column_name = 'id_venta';
   ```

## Notas importantes:

- Este patch es seguro de ejecutar múltiples veces (usa `IF NOT EXISTS`)
- La columna permite valores NULL para mantener compatibilidad con movimientos existentes
- Se crea un índice para mejorar el rendimiento de las consultas que relacionen ventas con movimientos de stock

## Después de ejecutar:

Una vez ejecutado este patch, el sistema de CRM de ventas podrá:
- Descontar stock automáticamente al crear ventas
- Registrar movimientos de stock relacionados con ventas
- Generar alertas de stock bajo/agotado cuando corresponda

