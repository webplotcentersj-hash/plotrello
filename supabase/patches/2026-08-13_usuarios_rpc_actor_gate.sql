-- Paso 2 seguridad (usuarios): las RPCs DEFINER crear/actualizar/baja
-- eran ejecutables por anon sin chequear al actor.
-- NO se revoca EXECUTE (el staff sigue con anon key).
-- NO se toca RLS. El cliente debe enviar p_actor_id / p_registrado_por.

CREATE OR REPLACE FUNCTION public.actor_puede_gestionar_usuarios(p_actor_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_actor_id
      AND COALESCE(u.activo, true) = true
      AND u.rol IN ('administracion', 'gerencia', 'recursos-humanos')
  );
$$;

CREATE OR REPLACE FUNCTION public.actor_puede_asignar_rol(p_actor_id integer, p_rol text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_rol text;
BEGIN
  SELECT u.rol INTO v_actor_rol
  FROM public.usuarios u
  WHERE u.id = p_actor_id
    AND COALESCE(u.activo, true) = true;

  IF v_actor_rol IS NULL THEN
    RETURN false;
  END IF;

  IF v_actor_rol = 'administracion' THEN
    RETURN true;
  END IF;

  IF v_actor_rol = 'gerencia' THEN
    RETURN p_rol IS DISTINCT FROM 'administracion';
  END IF;

  IF v_actor_rol = 'recursos-humanos' THEN
    RETURN p_rol IS DISTINCT FROM 'administracion'
       AND p_rol IS DISTINCT FROM 'gerencia';
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.actor_puede_gestionar_usuarios(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.actor_puede_asignar_rol(integer, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dar_de_baja_usuario(
  p_id integer,
  p_fecha_desvinculacion date,
  p_motivo text,
  p_tipo_desvinculacion text,
  p_observaciones_finales text,
  p_adjuntos jsonb,
  p_registrado_por integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  usuario_existente record;
  autentificacion_exists boolean;
  v_motivo text;
  v_tipo text;
  v_obs text;
  v_adj jsonb;
  v_log_id bigint;
BEGIN
  IF p_registrado_por IS NULL OR NOT public.actor_puede_gestionar_usuarios(p_registrado_por) THEN
    RAISE EXCEPTION 'No autorizado para dar de baja usuarios';
  END IF;

  IF p_registrado_por = p_id THEN
    RAISE EXCEPTION 'No podés darte de baja a vos mismo';
  END IF;

  v_motivo := trim(COALESCE(p_motivo, ''));
  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'El motivo de baja es obligatorio (mínimo 5 caracteres)';
  END IF;

  v_tipo := trim(COALESCE(p_tipo_desvinculacion, ''));
  IF length(v_tipo) < 2 THEN
    RAISE EXCEPTION 'El tipo de desvinculación es obligatorio';
  END IF;

  IF p_fecha_desvinculacion IS NULL THEN
    RAISE EXCEPTION 'La fecha de desvinculación es obligatoria';
  END IF;

  SELECT * INTO usuario_existente
  FROM public.usuarios
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_id;
  END IF;

  IF COALESCE(usuario_existente.activo, true) = false THEN
    RAISE EXCEPTION 'El colaborador ya figura como personal de baja';
  END IF;

  IF usuario_existente.rol = 'administracion' THEN
    RAISE EXCEPTION 'No se puede dar de baja un usuario con rol administración';
  END IF;

  v_obs := NULLIF(trim(COALESCE(p_observaciones_finales, '')), '');
  v_adj := COALESCE(p_adjuntos, '[]'::jsonb);
  IF jsonb_typeof(v_adj) IS DISTINCT FROM 'array' THEN
    v_adj := '[]'::jsonb;
  END IF;

  INSERT INTO public.usuarios_bajas_log (
    id_usuario,
    nombre_snapshot,
    motivo,
    registrado_por,
    fecha_desvinculacion,
    tipo_desvinculacion,
    observaciones_finales,
    adjuntos,
    rol_snapshot
  )
  VALUES (
    p_id,
    usuario_existente.nombre,
    v_motivo,
    p_registrado_por,
    p_fecha_desvinculacion,
    v_tipo,
    v_obs,
    v_adj,
    usuario_existente.rol
  )
  RETURNING id INTO v_log_id;

  UPDATE public.usuarios
  SET activo = false
  WHERE id = p_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;

  IF autentificacion_exists THEN
    BEGIN
      EXECUTE format(
        'DELETE FROM public.autentificacion WHERE nombre = %L',
        usuario_existente.nombre
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'No se pudo eliminar de autentificacion: %', SQLERRM;
    END;
  END IF;

  RETURN v_log_id;
END;
$$;

DROP FUNCTION IF EXISTS public.crear_usuario(text, text, text);

CREATE FUNCTION public.crear_usuario(
  p_nombre text,
  p_password text,
  p_rol text,
  p_actor_id integer DEFAULT NULL
)
RETURNS TABLE(id integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  new_user_id integer;
  password_hash text;
  autentificacion_exists boolean;
  trimmed_password text;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_usuarios(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para crear usuarios';
  END IF;

  IF NOT public.actor_puede_asignar_rol(p_actor_id, p_rol) THEN
    RAISE EXCEPTION 'No autorizado para asignar el rol %', p_rol;
  END IF;

  IF p_rol NOT IN (
    'administracion',
    'gerencia',
    'recursos-humanos',
    'diseno',
    'imprenta',
    'taller-grafico',
    'instalaciones',
    'metalurgica',
    'caja',
    'mostrador',
    'compras',
    'asesor-tecnico',
    'presupuestos'
  ) THEN
    RAISE EXCEPTION 'Rol inválido: %', p_rol;
  END IF;

  IF trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre de usuario no puede estar vacío';
  END IF;

  trimmed_password := trim(p_password);

  IF length(trimmed_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE lower(u.nombre) = lower(trim(p_nombre))
  ) THEN
    RAISE EXCEPTION 'El usuario "%" ya existe', trim(p_nombre);
  END IF;

  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;

  IF autentificacion_exists THEN
    IF EXISTS (
      SELECT 1 FROM public.autentificacion a
      WHERE lower(a.nombre) = lower(trim(p_nombre))
    ) THEN
      RAISE EXCEPTION 'El usuario "%" ya existe en autentificacion', trim(p_nombre);
    END IF;
  END IF;

  password_hash := crypt(trimmed_password, gen_salt('bf'));

  INSERT INTO public.usuarios (nombre, password_hash, rol)
  VALUES (trim(p_nombre), password_hash, p_rol)
  RETURNING public.usuarios.id INTO new_user_id;

  IF autentificacion_exists THEN
    BEGIN
      EXECUTE format('
        INSERT INTO public.autentificacion (nombre, password_hash, rol)
        VALUES (%L, %L, %L)
        ON CONFLICT (nombre) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            rol = EXCLUDED.rol
      ', trim(p_nombre), password_hash, p_rol);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'No se pudo sincronizar con autentificacion: %', SQLERRM;
    END;
  END IF;

  RETURN QUERY
  SELECT
    new_user_id AS id,
    trim(p_nombre) AS nombre,
    p_rol AS rol;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_usuario(text, text, text, integer) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.actualizar_usuario(integer, text, text, text);

CREATE FUNCTION public.actualizar_usuario(
  p_id integer,
  p_nombre text DEFAULT NULL,
  p_rol text DEFAULT NULL,
  p_password text DEFAULT NULL,
  p_actor_id integer DEFAULT NULL
)
RETURNS TABLE(id integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  usuario_existente record;
  v_password_hash text;
  autentificacion_exists boolean;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_usuarios(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para actualizar usuarios';
  END IF;

  SELECT * INTO usuario_existente
  FROM public.usuarios usr
  WHERE usr.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_id;
  END IF;

  IF p_rol IS NOT NULL THEN
    IF p_rol NOT IN (
      'administracion',
      'gerencia',
      'recursos-humanos',
      'diseno',
      'imprenta',
      'taller-grafico',
      'instalaciones',
      'metalurgica',
      'caja',
      'mostrador',
      'compras',
      'asesor-tecnico',
      'presupuestos'
    ) THEN
      RAISE EXCEPTION 'Rol inválido: %', p_rol;
    END IF;

    IF NOT public.actor_puede_asignar_rol(p_actor_id, p_rol) THEN
      RAISE EXCEPTION 'No autorizado para asignar el rol %', p_rol;
    END IF;
  END IF;

  IF p_nombre IS NOT NULL AND trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre de usuario no puede estar vacío';
  END IF;

  IF p_password IS NOT NULL AND length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  IF p_nombre IS NOT NULL AND lower(trim(p_nombre)) != lower(usuario_existente.nombre) THEN
    IF EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE lower(u.nombre) = lower(trim(p_nombre))
        AND u.id != p_id
    ) THEN
      RAISE EXCEPTION 'El usuario "%" ya existe', trim(p_nombre);
    END IF;
  END IF;

  IF p_password IS NOT NULL THEN
    v_password_hash := crypt(p_password, gen_salt('bf'));
  ELSE
    v_password_hash := usuario_existente.password_hash;
  END IF;

  UPDATE public.usuarios u
  SET
    nombre = COALESCE(trim(p_nombre), usuario_existente.nombre),
    rol = COALESCE(p_rol, usuario_existente.rol),
    password_hash = v_password_hash
  WHERE u.id = p_id;

  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;

  IF autentificacion_exists THEN
    BEGIN
      EXECUTE format('
        UPDATE public.autentificacion a
        SET nombre = %L,
            rol = %L,
            password_hash = %L
        WHERE a.nombre = %L
      ',
        COALESCE(trim(p_nombre), usuario_existente.nombre),
        COALESCE(p_rol, usuario_existente.rol),
        v_password_hash,
        usuario_existente.nombre
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'No se pudo sincronizar con autentificacion: %', SQLERRM;
    END;
  END IF;

  RETURN QUERY
  SELECT
    p_id,
    (COALESCE(trim(p_nombre), usuario_existente.nombre))::text,
    (COALESCE(p_rol, usuario_existente.rol))::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_usuario(integer, text, text, text, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.actor_puede_gestionar_usuarios(integer) IS
  'Admin / gerencia / RRHH activos. Uso interno de RPCs de usuarios.';
COMMENT ON FUNCTION public.crear_usuario(text, text, text, integer) IS
  'Alta de usuario. Requiere p_actor_id con rol admin/gerencia/RRHH.';
COMMENT ON FUNCTION public.actualizar_usuario(integer, text, text, text, integer) IS
  'Edita usuario. Requiere p_actor_id con rol admin/gerencia/RRHH.';
COMMENT ON FUNCTION public.dar_de_baja_usuario IS
  'Baja formal. Requiere p_registrado_por admin/gerencia/RRHH y distinto del dado de baja.';
