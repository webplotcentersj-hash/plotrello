-- Baja formal de personal: soft-delete (activo=false), historial completo preservado.

BEGIN;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON public.usuarios(activo);

UPDATE public.usuarios SET activo = true WHERE activo IS NULL;

ALTER TABLE public.usuarios_bajas_log
  ADD COLUMN IF NOT EXISTS fecha_desvinculacion date,
  ADD COLUMN IF NOT EXISTS tipo_desvinculacion text,
  ADD COLUMN IF NOT EXISTS observaciones_finales text,
  ADD COLUMN IF NOT EXISTS adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rol_snapshot text;

COMMENT ON COLUMN public.usuarios.activo IS
  'false = personal de baja; el registro y legajo se conservan para trazabilidad.';

-- Solo usuarios activos en listados operativos
CREATE OR REPLACE FUNCTION public.listar_usuarios()
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nombre, u.rol
  FROM public.usuarios u
  WHERE COALESCE(u.activo, true) = true
  ORDER BY u.nombre;
$$;

GRANT EXECUTE ON FUNCTION public.listar_usuarios() TO anon, authenticated;

-- Bloquear login de personal dado de baja
CREATE OR REPLACE FUNCTION public.login_usuario(p_usuario text, p_password text)
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  user_rec RECORD;
  stored_hash text;
  computed_hash_raw text;
  computed_hash_trim text;
  trimmed_usuario text;
  autentificacion_exists boolean;
BEGIN
  trimmed_usuario := trim(p_usuario);

  IF trimmed_usuario = '' OR p_password IS NULL OR length(p_password) = 0 THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;

  SELECT u.id, u.nombre, u.rol, u.password_hash
    INTO user_rec
    FROM public.usuarios u
   WHERE lower(trim(u.nombre)) = lower(trimmed_usuario)
     AND COALESCE(u.activo, true) = true
   LIMIT 1;

  IF NOT FOUND AND autentificacion_exists THEN
    BEGIN
      EXECUTE format(
        'SELECT a.id, a.nombre, a.rol, a.password_hash
         FROM public.autentificacion a
         WHERE lower(trim(a.nombre)) = lower(%L)
         LIMIT 1',
        trimmed_usuario
      ) INTO user_rec;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF user_rec IS NULL THEN
    RETURN;
  END IF;

  stored_hash := user_rec.password_hash;
  IF stored_hash IS NULL OR length(trim(stored_hash)) = 0 THEN
    RETURN;
  END IF;

  computed_hash_raw := crypt(p_password, stored_hash);
  computed_hash_trim := crypt(trim(p_password), stored_hash);

  IF computed_hash_raw = stored_hash OR computed_hash_trim = stored_hash THEN
    RETURN QUERY SELECT
      user_rec.id::integer,
      user_rec.nombre::text,
      user_rec.rol::text;
  END IF;

  RETURN;
END;
$$;

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

COMMENT ON FUNCTION public.dar_de_baja_usuario IS
  'Baja formal: marca activo=false, registra trazabilidad y conserva legajo/historial.';

GRANT EXECUTE ON FUNCTION public.dar_de_baja_usuario(
  integer, date, text, text, text, jsonb, integer
) TO anon, authenticated;

-- Compatibilidad: eliminar_usuario ahora delega en baja formal (sin adjuntos ni tipo)
CREATE OR REPLACE FUNCTION public.eliminar_usuario(
  p_id integer,
  p_motivo text,
  p_registrado_por integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.dar_de_baja_usuario(
    p_id,
    CURRENT_DATE,
    p_motivo,
    'otro',
    NULL,
    '[]'::jsonb,
    p_registrado_por
  );
END;
$$;

COMMIT;
