-- Reactivar colaborador dado de baja (activo = true)
CREATE OR REPLACE FUNCTION public.reactivar_usuario(
  p_id integer,
  p_registrado_por integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  usuario_existente record;
BEGIN
  IF p_id IS NULL OR p_id <= 0 THEN
    RAISE EXCEPTION 'ID de usuario inválido';
  END IF;

  SELECT * INTO usuario_existente
  FROM public.usuarios
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_id;
  END IF;

  IF COALESCE(usuario_existente.activo, true) = true THEN
    RAISE EXCEPTION 'El colaborador ya está activo';
  END IF;

  UPDATE public.usuarios
  SET activo = true
  WHERE id = p_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivar_usuario(integer, integer) TO anon, authenticated, service_role;
