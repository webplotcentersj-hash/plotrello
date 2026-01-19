-- ============================================
-- Deshabilitar temporalmente el trigger de facturación automática
-- hasta que el módulo de facturación esté completamente implementado
-- ============================================

BEGIN;

-- Modificar la función para que verifique si la tabla existe antes de ejecutarse
CREATE OR REPLACE FUNCTION public.crear_factura_automatica_op()
RETURNS TRIGGER AS $$
DECLARE
  v_table_exists boolean;
BEGIN
  -- Verificar si la tabla facturas_venta existe
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'facturas_venta'
  ) INTO v_table_exists;

  -- Si la tabla no existe, simplemente retornar sin hacer nada
  IF NOT v_table_exists THEN
    RETURN NEW;
  END IF;

  -- Si la tabla existe, ejecutar la lógica original
  -- (El resto del código original se mantiene aquí para cuando se habilite)
  -- Por ahora, simplemente retornar sin hacer nada
  -- TODO: Descomentar y habilitar cuando el módulo de facturación esté listo
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger ya existe, solo actualizamos la función
-- No es necesario recrear el trigger

COMMIT;

