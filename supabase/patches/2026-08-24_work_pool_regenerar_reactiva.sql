-- Al regenerar credenciales, reactivar el usuario (admin está habilitando acceso).

CREATE OR REPLACE FUNCTION public.work_pool_regenerar_credenciales(
  p_id_usuario integer,
  p_nuevo_login text DEFAULT NULL,
  p_nueva_password text DEFAULT NULL
)
RETURNS TABLE (id_usuario integer, nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_nombre text;
  v_identidad text;
BEGIN
  IF p_id_usuario IS NULL OR p_id_usuario <= 0 THEN
    RAISE EXCEPTION 'usuario inválido';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_id_usuario) THEN
    RAISE EXCEPTION 'usuario no encontrado';
  END IF;

  IF NULLIF(trim(COALESCE(p_nuevo_login, '')), '') IS NULL
     AND NULLIF(COALESCE(p_nueva_password, ''), '') IS NULL THEN
    RAISE EXCEPTION 'indicá login y/o contraseña nueva';
  END IF;

  IF NULLIF(trim(COALESCE(p_nuevo_login, '')), '') IS NOT NULL THEN
    v_nombre := lower(trim(p_nuevo_login));
    v_identidad := public.work_pool_login_identidad(v_nombre);
    IF EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id <> p_id_usuario
        AND COALESCE(u.activo, true) = true
        AND (
          lower(trim(u.nombre)) = v_nombre
          OR public.work_pool_login_identidad(u.nombre) = v_identidad
        )
    ) THEN
      RAISE EXCEPTION 'ya existe un usuario con ese login';
    END IF;
    UPDATE public.usuarios
    SET nombre = v_nombre
    WHERE id = p_id_usuario;
  END IF;

  IF NULLIF(COALESCE(p_nueva_password, ''), '') IS NOT NULL THEN
    IF length(trim(p_nueva_password)) < 6 THEN
      RAISE EXCEPTION 'la contraseña debe tener al menos 6 caracteres';
    END IF;
    IF public.work_pool_password_en_uso(p_nueva_password, p_id_usuario) THEN
      RAISE EXCEPTION 'esa contraseña ya está en uso; generá otra';
    END IF;
    UPDATE public.usuarios
    SET password_hash = crypt(p_nueva_password, gen_salt('bf'))
    WHERE id = p_id_usuario;
  END IF;

  UPDATE public.usuarios
  SET activo = true
  WHERE id = p_id_usuario;

  RETURN QUERY
    SELECT u.id, u.nombre::text
    FROM public.usuarios u
    WHERE u.id = p_id_usuario;
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_regenerar_credenciales(integer, text, text) TO anon, authenticated;
