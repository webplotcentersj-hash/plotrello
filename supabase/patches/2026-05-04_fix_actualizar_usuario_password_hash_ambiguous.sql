-- actualizar_usuario: ambigüedad password_hash e id
-- 1) SET password_hash = variable con nombre de columna → v_password_hash
-- 2) RETURNS TABLE (id, nombre, rol) define variables homónimas: un "id" o
--    "AS id" en subconsultas choca con usuarios.id. Calificar y devolver
--    sin alias que repitan nombres de parámetros OUT.
-- 3) gen_salt/crypt viven en pgcrypto (schema extensions en Supabase): no usar
--    solo search_path = public — ver login_usuario (public, extensions).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE OR REPLACE FUNCTION public.actualizar_usuario(
  p_id integer,
  p_nombre text DEFAULT NULL,
  p_rol text DEFAULT NULL,
  p_password text DEFAULT NULL
)
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  usuario_existente record;
  v_password_hash text;
  autentificacion_exists boolean;
BEGIN
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
    password_hash = v_password_hash,
    updated_at = now()
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

  -- Sin AS id/nombre/rol: esos nombres son parámetros OUT y generan ambigüedad
  RETURN QUERY
  SELECT
    p_id,
    (COALESCE(trim(p_nombre), usuario_existente.nombre))::text,
    (COALESCE(p_rol, usuario_existente.rol))::text;
END;
$$;

COMMENT ON FUNCTION public.actualizar_usuario IS
'Actualiza un usuario existente. Permite actualizar nombre, rol y/o contraseña. Los parámetros NULL no se actualizan.';

COMMIT;
