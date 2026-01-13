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

