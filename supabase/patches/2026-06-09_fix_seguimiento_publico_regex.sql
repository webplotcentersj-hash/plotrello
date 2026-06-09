-- Fix: regex inválido [\s-_#:] en get_orden_seguimiento_publico (PostgreSQL interpreta - como rango)
-- Rompía todos los enlaces /op-public/* con "invalid regular expression: invalid character range"

CREATE OR REPLACE FUNCTION public.get_orden_seguimiento_publico(p_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_row public.ordenes_trabajo%ROWTYPE;
BEGIN
  v_ref := trim(coalesce(p_ref, ''));
  IF v_ref = '' THEN
    RETURN NULL;
  END IF;

  v_ref := regexp_replace(v_ref, '^OP-?', '', 'i');
  v_ref := regexp_replace(v_ref, '^FICHA[\s_#:\-]*', '', 'i');

  SELECT * INTO v_row
  FROM public.ordenes_trabajo o
  WHERE (
    o.numero_op = trim(p_ref)
    OR o.numero_op = v_ref
    OR o.seguimiento_token::text = trim(p_ref)
  )
    AND COALESCE(o.eliminada, false) = false
  ORDER BY
    CASE WHEN COALESCE(o.visible_en_tablero, true) THEN 0 ELSE 1 END,
    o.fecha_creacion DESC NULLS LAST,
    o.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'numero_op', v_row.numero_op,
    'seguimiento_token', v_row.seguimiento_token,
    'cliente', v_row.cliente,
    'estado', v_row.estado,
    'descripcion', v_row.descripcion,
    'fecha_entrega', v_row.fecha_entrega
  );
END;
$$;
