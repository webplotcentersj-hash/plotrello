-- ============================================
-- FIX: Corregir ambigüedad en función guardar_preferencias_cliente
-- ============================================

BEGIN;

-- Recrear la función con referencias explícitas para evitar ambigüedad
CREATE OR REPLACE FUNCTION public.guardar_preferencias_cliente(
  p_dni_cuit varchar(50),
  p_preferencias text DEFAULT NULL,
  p_notas_internas text DEFAULT NULL,
  p_es_vip boolean DEFAULT false
)
RETURNS TABLE (
  id integer,
  dni_cuit varchar(50),
  preferencias text,
  notas_internas text,
  es_vip boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id integer;
BEGIN
  INSERT INTO public.preferencias_clientes (dni_cuit, preferencias, notas_internas, es_vip)
  VALUES (UPPER(p_dni_cuit), p_preferencias, p_notas_internas, p_es_vip)
  ON CONFLICT (dni_cuit) 
  DO UPDATE SET
    preferencias = EXCLUDED.preferencias,
    notas_internas = EXCLUDED.notas_internas,
    es_vip = EXCLUDED.es_vip,
    updated_at = now()
  RETURNING public.preferencias_clientes.id INTO v_id;

  RETURN QUERY
  SELECT 
    pc.id,
    pc.dni_cuit,
    pc.preferencias,
    pc.notas_internas,
    pc.es_vip
  FROM public.preferencias_clientes pc
  WHERE pc.id = v_id;
END;
$$;

COMMIT;

