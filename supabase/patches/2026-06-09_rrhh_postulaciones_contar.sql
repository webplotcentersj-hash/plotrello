CREATE OR REPLACE FUNCTION public.rrhh_postulaciones_contar(
  p_usuario_id integer,
  p_busqueda text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_puesto text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_busqueda text;
  v_total integer;
BEGIN
  IF NOT public._rrhh_es_gestor_postulaciones(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_busqueda := nullif(trim(p_busqueda), '');

  SELECT COUNT(*)::integer INTO v_total
  FROM public.rrhh_postulaciones p
  WHERE (p_estado IS NULL OR p_estado = '' OR p.estado = p_estado)
    AND (p_puesto IS NULL OR p_puesto = '' OR p.puesto = p_puesto)
    AND (
      v_busqueda IS NULL
      OR p.nombre ILIKE '%' || v_busqueda || '%'
      OR p.email ILIKE '%' || v_busqueda || '%'
      OR p.puesto ILIKE '%' || v_busqueda || '%'
      OR coalesce(p.mensaje, '') ILIKE '%' || v_busqueda || '%'
      OR coalesce(p.metadata_ia::text, '') ILIKE '%' || v_busqueda || '%'
    );

  RETURN coalesce(v_total, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_postulaciones_contar(integer, text, text, text) TO anon, authenticated;
