-- Comisiones: un vendedor puede "usar el % general" (porcentaje NULL) o tener uno propio.
--
-- Antes: comisiones_config_get mostraba porcentaje 0 y "no comisiona" para quien no tenía fila,
-- aunque el cálculo le aplicaba el % general y lo daba por activo. Al tildar "Comisiona" en la
-- pantalla se guardaba 0% propio y ese vendedor dejaba de cobrar comisión.
--
-- Ahora: porcentaje NULL = usa el general; activo se informa igual que en el cálculo (true sin fila).
-- comisiones_recalcular no cambia: ya usaba COALESCE(cv.porcentaje, porcentaje_default).
-- Requiere: 2026-09-22_comisiones_ventas.sql. Idempotente.

ALTER TABLE public.comisiones_vendedores ALTER COLUMN porcentaje DROP NOT NULL;
ALTER TABLE public.comisiones_vendedores ALTER COLUMN porcentaje DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.comisiones_config_get(p_actor_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF NOT public.actor_puede_comisiones(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para ver comisiones';
  END IF;

  SELECT jsonb_build_object(
    'config', (SELECT to_jsonb(c) FROM public.comisiones_config c WHERE c.id = 1),
    'vendedores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id_usuario', u.id,
               'nombre', u.nombre,
               'rol', u.rol,
               'porcentaje', cv.porcentaje,
               'usa_general', cv.porcentaje IS NULL,
               'activo', COALESCE(cv.activo, true),
               'ventas', COALESCE(vt.ventas, 0)
             ) ORDER BY u.nombre)
      FROM public.usuarios u
      LEFT JOIN public.comisiones_vendedores cv ON cv.id_usuario = u.id
      LEFT JOIN LATERAL (
        SELECT count(*) AS ventas FROM public.ventas v WHERE v.id_vendedor = u.id
      ) vt ON true
      WHERE COALESCE(u.activo, true) = true
        AND (vt.ventas > 0 OR cv.id_usuario IS NOT NULL)
    ), '[]'::jsonb)
  ) INTO v_out;

  RETURN v_out;
END;
$$;

-- p_porcentaje NULL = usar el % general.
CREATE OR REPLACE FUNCTION public.comisiones_guardar_vendedor(
  p_actor_id integer,
  p_id_usuario integer,
  p_porcentaje numeric,
  p_activo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.actor_puede_comisiones(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para configurar comisiones';
  END IF;
  IF p_porcentaje IS NOT NULL AND (p_porcentaje < 0 OR p_porcentaje > 100) THEN
    RAISE EXCEPTION 'El porcentaje tiene que estar entre 0 y 100';
  END IF;

  INSERT INTO public.comisiones_vendedores (id_usuario, porcentaje, activo, updated_at)
  VALUES (p_id_usuario, p_porcentaje, COALESCE(p_activo, true), now())
  ON CONFLICT (id_usuario) DO UPDATE
    SET porcentaje = EXCLUDED.porcentaje, activo = EXCLUDED.activo, updated_at = now();

  RETURN public.comisiones_config_get(p_actor_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.comisiones_config_get(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comisiones_guardar_vendedor(integer, integer, numeric, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
