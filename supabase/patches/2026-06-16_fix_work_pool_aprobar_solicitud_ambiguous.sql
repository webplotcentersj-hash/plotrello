-- Fix: column reference "id_usuario" is ambiguous
-- PL/pgSQL RETURNS TABLE (id_usuario ...) shadows ON CONFLICT (id_usuario, sector).
-- Use named unique constraint instead of column list in ON CONFLICT.

CREATE OR REPLACE FUNCTION public.work_pool_aprobar_solicitud(
  p_id_solicitud integer,
  p_id_admin integer,
  p_usuario_login text,
  p_password text,
  p_notas_admin text DEFAULT NULL
)
RETURNS TABLE (id_usuario integer, nombre text, rol text)
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
BEGIN
  SELECT * INTO v_sol FROM public.work_pool_solicitudes WHERE id = p_id_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'solicitud no encontrada'; END IF;
  IF v_sol.estado <> 'pendiente' THEN RAISE EXCEPTION 'la solicitud ya fue procesada'; END IF;
  IF NULLIF(trim(p_usuario_login), '') IS NULL OR NULLIF(p_password, '') IS NULL THEN
    RAISE EXCEPTION 'usuario y contraseña obligatorios';
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
  v_nombre := trim(p_usuario_login);

  INSERT INTO public.usuarios (nombre, rol, password_hash, activo)
  VALUES (v_nombre, v_rol, crypt(p_password, gen_salt('bf')), true)
  RETURNING usuarios.id INTO v_uid;

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

  RETURN QUERY SELECT v_uid, v_nombre, v_rol;
END;
$$;
