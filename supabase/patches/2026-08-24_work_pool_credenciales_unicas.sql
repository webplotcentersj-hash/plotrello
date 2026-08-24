-- Login y contraseña únicos al aprobar / regenerar operarios work-pool.
-- - No crea usuario si el login (o su parte local) ya existe activo.
-- - Si existe inactivo con la misma identidad, lo reactiva y actualiza password.
-- - Rechaza contraseñas ya usadas por otro operario externo.

CREATE OR REPLACE FUNCTION public.work_pool_login_identidad(p_login text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      split_part(trim(COALESCE(p_login, '')), '@', 1),
      '[^a-z0-9]',
      '',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.work_pool_password_en_uso(
  p_password text,
  p_except_id integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
BEGIN
  IF NULLIF(p_password, '') IS NULL THEN
    RETURN false;
  END IF;

  FOR r IN
    SELECT u.id, u.password_hash
    FROM public.usuarios u
    WHERE u.rol IN ('operario-diseno', 'operario-bolsa', 'operario')
      AND (p_except_id IS NULL OR u.id <> p_except_id)
      AND u.password_hash IS NOT NULL
  LOOP
    IF r.password_hash = crypt(p_password, r.password_hash) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_aprobar_solicitud(
  p_id_solicitud integer,
  p_id_admin integer,
  p_usuario_login text,
  p_password text,
  p_notas_admin text DEFAULT NULL
)
RETURNS TABLE(id_usuario integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sol RECORD;
  v_rol text;
  v_sector text;
  v_rubro text;
  v_uid integer;
  v_nombre text;
  v_identidad text;
  v_existente RECORD;
BEGIN
  SELECT * INTO v_sol FROM public.work_pool_solicitudes WHERE id = p_id_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'solicitud no encontrada'; END IF;
  IF v_sol.estado <> 'pendiente' THEN RAISE EXCEPTION 'la solicitud ya fue procesada'; END IF;
  IF NULLIF(trim(p_usuario_login), '') IS NULL OR NULLIF(p_password, '') IS NULL THEN
    RAISE EXCEPTION 'usuario y contraseña obligatorios';
  END IF;
  IF length(trim(p_password)) < 6 THEN
    RAISE EXCEPTION 'la contraseña debe tener al menos 6 caracteres';
  END IF;

  v_rubro := COALESCE(
    v_sol.rubro,
    CASE v_sol.tipo WHEN 'diseno' THEN 'diseno' ELSE 'instalaciones' END
  );

  v_rol := CASE WHEN v_rubro = 'diseno' THEN 'operario-diseno' ELSE 'operario-bolsa' END;
  v_sector := CASE v_rubro
    WHEN 'diseno' THEN 'diseno'
    WHEN 'metalurgica' THEN 'metalurgica'
    ELSE 'instalaciones'
  END;

  v_nombre := lower(trim(p_usuario_login));
  v_identidad := public.work_pool_login_identidad(v_nombre);

  IF v_identidad = '' THEN
    RAISE EXCEPTION 'login inválido';
  END IF;

  SELECT u.id, u.nombre, u.activo, u.rol
    INTO v_existente
  FROM public.usuarios u
  WHERE public.work_pool_login_identidad(u.nombre) = v_identidad
     OR lower(trim(u.nombre)) = v_nombre
  ORDER BY
    CASE WHEN lower(trim(u.nombre)) = v_nombre THEN 0 ELSE 1 END,
    CASE WHEN u.activo THEN 0 ELSE 1 END,
    u.id DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existente.activo THEN
      RAISE EXCEPTION 'ya existe un usuario con ese login (o el mismo nombre)';
    END IF;
    -- Reactivar inactivo en lugar de duplicar
    IF public.work_pool_password_en_uso(p_password, v_existente.id) THEN
      RAISE EXCEPTION 'esa contraseña ya está en uso; generá otra';
    END IF;
    UPDATE public.usuarios
    SET nombre = v_nombre,
        rol = v_rol,
        password_hash = crypt(p_password, gen_salt('bf')),
        activo = true
    WHERE id = v_existente.id;
    v_uid := v_existente.id;
  ELSE
    IF public.work_pool_password_en_uso(p_password, NULL) THEN
      RAISE EXCEPTION 'esa contraseña ya está en uso; generá otra';
    END IF;
    INSERT INTO public.usuarios (nombre, rol, password_hash, activo)
    VALUES (v_nombre, v_rol, crypt(p_password, gen_salt('bf')), true)
    RETURNING usuarios.id INTO v_uid;
  END IF;

  INSERT INTO public.work_pool_profiles (id_usuario, sector, skills, zona_cobertura, activo, aprobado, notas_admin)
  VALUES (
    v_uid,
    v_sector,
    COALESCE(v_sol.skills, '{}'),
    v_sol.zona_cobertura,
    true,
    true,
    COALESCE(NULLIF(trim(p_notas_admin), ''), v_sol.mensaje)
  )
  ON CONFLICT ON CONSTRAINT work_pool_profiles_id_usuario_sector_key DO UPDATE SET
    skills = EXCLUDED.skills,
    zona_cobertura = EXCLUDED.zona_cobertura,
    aprobado = true,
    activo = true,
    notas_admin = EXCLUDED.notas_admin,
    updated_at = now();

  UPDATE public.work_pool_solicitudes
  SET estado = 'aprobada',
      id_usuario_creado = v_uid,
      revisado_por = p_id_admin,
      notas_admin = NULLIF(trim(p_notas_admin), ''),
      updated_at = now()
  WHERE id = p_id_solicitud;

  RETURN QUERY SELECT v_uid, v_nombre::text, v_rol::text;
END;
$$;

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

  -- Regenerar credenciales = acceso habilitado
  UPDATE public.usuarios
  SET activo = true
  WHERE id = p_id_usuario;

  RETURN QUERY
    SELECT u.id, u.nombre::text
    FROM public.usuarios u
    WHERE u.id = p_id_usuario;
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_login_identidad(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_pool_password_en_uso(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_pool_aprobar_solicitud(integer, integer, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_pool_regenerar_credenciales(integer, text, text) TO anon, authenticated;
