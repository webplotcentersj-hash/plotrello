-- Sesión temporal para que el cliente suba un archivo desde el celular (QR en el tótem)
BEGIN;

CREATE TABLE IF NOT EXISTS public.totem_qr_upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  archivo_url text,
  archivo_nombre varchar(512),
  archivo_bytes bigint,
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'completada', 'expirada'))
);

CREATE INDEX IF NOT EXISTS idx_totem_qr_upload_expires ON public.totem_qr_upload_sessions(expires_at);

COMMENT ON TABLE public.totem_qr_upload_sessions IS 'Subida de archivo al tótem vía QR + celular; fila única por sesión UUID';

CREATE OR REPLACE FUNCTION public.crear_sesion_qr_upload_totem ()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_exp timestamptz := now() + interval '20 minutes';
BEGIN
  INSERT INTO public.totem_qr_upload_sessions (expires_at)
  VALUES (v_exp)
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'session_id', v_id,
    'expires_at', v_exp
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

  RETURN json_build_object(
    'ok', true,
    'session_id', r.id,
    'expires_at', r.expires_at,
    'archivo_url', r.archivo_url,
    'archivo_nombre', r.archivo_nombre,
    'archivo_bytes', r.archivo_bytes,
    'estado', r.estado
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_archivo_sesion_qr_totem (
  p_session_id uuid,
  p_archivo_url text,
  p_archivo_nombre varchar(512),
  p_archivo_bytes bigint DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_archivo_url IS NULL OR trim(p_archivo_url) = '' THEN
    RETURN json_build_object('ok', false, 'error', 'URL de archivo inválida');
  END IF;

  IF p_archivo_nombre IS NULL OR trim(p_archivo_nombre) = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Nombre de archivo inválido');
  END IF;

  UPDATE public.totem_qr_upload_sessions s
  SET
    archivo_url = trim(p_archivo_url),
    archivo_nombre = trim(p_archivo_nombre),
    archivo_bytes = p_archivo_bytes,
    estado = 'completada'
  WHERE s.id = p_session_id
    AND s.expires_at >= now()
    AND s.estado = 'abierta'
    AND s.archivo_url IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN json_build_object(
      'ok', false,
      'error',
      'No se pudo registrar (sesión inexistente, vencida o ya usada)'
    );
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_sesion_qr_upload_totem () TO anon;
GRANT EXECUTE ON FUNCTION public.crear_sesion_qr_upload_totem () TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_sesion_qr_upload_totem (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_sesion_qr_upload_totem (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_archivo_sesion_qr_totem (uuid, text, varchar, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_archivo_sesion_qr_totem (uuid, text, varchar, bigint) TO authenticated;

COMMIT;
