-- Varios archivos por sesión QR del tótem de impresión
BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_archivo_sesion_qr_totem (
  p_session_id uuid,
  p_archivo_url text,
  p_archivo_nombre varchar(512),
  p_archivo_bytes bigint DEFAULT NULL,
  p_finalizar boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totem_qr_upload_sessions%ROWTYPE;
  v_files jsonb;
  v_manifest text;
  v_nombre varchar(512);
BEGIN
  IF p_archivo_url IS NULL OR trim(p_archivo_url) = '' THEN
    RETURN json_build_object('ok', false, 'error', 'URL de archivo inválida');
  END IF;

  IF p_archivo_nombre IS NULL OR trim(p_archivo_nombre) = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Nombre de archivo inválido');
  END IF;

  SELECT * INTO v_row
  FROM public.totem_qr_upload_sessions s
  WHERE s.id = p_session_id
    AND s.expires_at >= now()
    AND s.estado = 'abierta'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'ok', false,
      'error',
      'No se pudo registrar (sesión inexistente, vencida o ya cerrada)'
    );
  END IF;

  IF v_row.archivo_url IS NOT NULL AND left(trim(v_row.archivo_url), 1) = '{' THEN
  BEGIN
    v_files := coalesce((v_row.archivo_url::jsonb -> 'files'), '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_files := '[]'::jsonb;
  END;
  ELSE
    IF v_row.archivo_url IS NOT NULL AND trim(v_row.archivo_url) <> '' THEN
      v_files := jsonb_build_array(
        jsonb_build_object(
          'url', trim(v_row.archivo_url),
          'nombre', coalesce(nullif(trim(v_row.archivo_nombre), ''), 'archivo'),
          'bytes', v_row.archivo_bytes
        )
      );
    ELSE
      v_files := '[]'::jsonb;
    END IF;
  END IF;

  v_files := v_files || jsonb_build_array(
    jsonb_build_object(
      'url', trim(p_archivo_url),
      'nombre', trim(p_archivo_nombre),
      'bytes', p_archivo_bytes
    )
  );

  v_manifest := json_build_object('files', v_files)::text;
  v_nombre := jsonb_array_length(v_files)::text || ' archivo(s)';

  UPDATE public.totem_qr_upload_sessions s
  SET
    archivo_url = v_manifest,
    archivo_nombre = v_nombre,
    archivo_bytes = coalesce(s.archivo_bytes, 0) + coalesce(p_archivo_bytes, 0),
    estado = CASE WHEN coalesce(p_finalizar, true) THEN 'completada' ELSE 'abierta' END
  WHERE s.id = p_session_id;

  RETURN json_build_object(
    'ok', true,
    'archivo_count', jsonb_array_length(v_files),
    'estado', CASE WHEN coalesce(p_finalizar, true) THEN 'completada' ELSE 'abierta' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_sesion_qr_upload_totem (p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.totem_qr_upload_sessions%ROWTYPE;
  v_files jsonb;
BEGIN
  SELECT * INTO r
  FROM public.totem_qr_upload_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Sesión no encontrada');
  END IF;

  IF r.expires_at < now() THEN
    UPDATE public.totem_qr_upload_sessions SET estado = 'expirada' WHERE id = p_session_id AND estado = 'abierta';
    RETURN json_build_object('ok', false, 'error', 'Sesión vencida');
  END IF;

  v_files := '[]'::jsonb;
  IF r.archivo_url IS NOT NULL AND left(trim(r.archivo_url), 1) = '{' THEN
  BEGIN
    v_files := coalesce((r.archivo_url::jsonb -> 'files'), '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_files := '[]'::jsonb;
  END;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'session_id', r.id,
    'expires_at', r.expires_at,
    'archivo_url', r.archivo_url,
    'archivo_nombre', r.archivo_nombre,
    'archivo_bytes', r.archivo_bytes,
    'archivos', v_files,
    'archivo_count', CASE
      WHEN jsonb_array_length(v_files) > 0 THEN jsonb_array_length(v_files)
      WHEN r.archivo_url IS NOT NULL AND trim(r.archivo_url) <> '' THEN 1
      ELSE 0
    END,
    'estado', r.estado
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_sesion_qr_upload_totem (p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.totem_qr_upload_sessions s
  SET estado = 'completada'
  WHERE s.id = p_session_id
    AND s.expires_at >= now()
    AND s.estado = 'abierta'
    AND s.archivo_url IS NOT NULL
    AND trim(s.archivo_url) <> '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'No hay archivos para finalizar o la sesión no está abierta');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_archivo_sesion_qr_totem (uuid, text, varchar, bigint, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_archivo_sesion_qr_totem (uuid, text, varchar, bigint, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_sesion_qr_upload_totem (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.finalizar_sesion_qr_upload_totem (uuid) TO authenticated;

COMMIT;
