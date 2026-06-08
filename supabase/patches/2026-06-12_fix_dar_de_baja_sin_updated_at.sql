-- Fix: usuarios no tiene columna updated_at; la baja solo marca activo=false.

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
