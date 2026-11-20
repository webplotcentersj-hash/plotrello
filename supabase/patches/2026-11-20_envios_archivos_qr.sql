-- Envío de archivos por QR fijo (/enviar-archivos): el cliente escanea un QR impreso en el
-- mostrador, sube PDF / imágenes desde el celular y recibe un código de 4 dígitos que dice
-- en el mostrador. Los envíos llegan a /mostrador/archivos-qr con notificación.
--
-- (El QR "en pantalla" no usa esta tabla: reutiliza totem_qr_upload_sessions.)
--
-- Los archivos se suben al bucket `archivos` (envios-qr/<uuid>/...) y acá solo se registran.
-- La tabla no se expone: todo pasa por funciones SECURITY DEFINER.
--   registrar_envio_archivos_qr → público (anon), honeypot + límite global por minuto.
--   listar_envios_archivos_qr / marcar_envio_archivos_qr → personal activo.

CREATE TABLE IF NOT EXISTS public.envios_archivos_qr (
  id bigserial PRIMARY KEY,
  codigo text NOT NULL,
  archivos jsonb NOT NULL,
  cantidad integer NOT NULL,
  bytes bigint NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'nuevo'
    CHECK (estado IN ('nuevo', 'recibido', 'archivado')),
  atendido_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  atendido_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_envios_archivos_qr_estado
  ON public.envios_archivos_qr (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_envios_archivos_qr_created
  ON public.envios_archivos_qr (created_at DESC);

ALTER TABLE public.envios_archivos_qr ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.envios_archivos_qr FROM anon, authenticated;

-- ——— Público: registrar envío ———
-- p_archivos: [{ "url": "...", "nombre": "...", "bytes": 123 }, ...]
CREATE OR REPLACE FUNCTION public.registrar_envio_archivos_qr(
  p_archivos jsonb,
  p_honeypot text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item jsonb;
  v_limpios jsonb := '[]'::jsonb;
  v_bytes bigint := 0;
  v_url text;
  v_nombre text;
  v_codigo text;
  v_id bigint;
  v_intentos integer := 0;
  v_resumen text;
BEGIN
  -- Bot: responde "ok" sin guardar nada.
  IF COALESCE(trim(p_honeypot), '') <> '' THEN
    RETURN json_build_object('ok', true, 'codigo', lpad((floor(random() * 10000))::int::text, 4, '0'));
  END IF;

  IF p_archivos IS NULL OR jsonb_typeof(p_archivos) <> 'array'
     OR jsonb_array_length(p_archivos) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'No llegó ningún archivo');
  END IF;
  IF jsonb_array_length(p_archivos) > 10 THEN
    RETURN json_build_object('ok', false, 'error', 'Máximo 10 archivos por envío');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_archivos) LOOP
    v_url := trim(COALESCE(v_item ->> 'url', ''));
    v_nombre := left(trim(COALESCE(v_item ->> 'nombre', '')), 300);
    -- Solo URLs del propio bucket, carpeta envios-qr (no se aceptan links externos).
    IF position('/storage/v1/object/public/archivos/envios-qr/' IN v_url) = 0
       OR v_url !~ '^https://' THEN
      RETURN json_build_object('ok', false, 'error', 'Archivo inválido');
    END IF;
    IF v_nombre = '' THEN v_nombre := 'archivo'; END IF;
    v_bytes := v_bytes + GREATEST(COALESCE((v_item ->> 'bytes')::bigint, 0), 0);
    v_limpios := v_limpios || jsonb_build_array(
      jsonb_build_object('url', v_url, 'nombre', v_nombre, 'bytes', (v_item ->> 'bytes')::bigint)
    );
  END LOOP;

  -- Freno anti-abuso: el QR es público y no identifica a nadie.
  IF (SELECT count(*) FROM public.envios_archivos_qr WHERE created_at > now() - interval '10 minutes') >= 40 THEN
    RETURN json_build_object('ok', false, 'error', 'Hay muchos envíos en este momento. Probá en unos minutos o pedí ayuda en el mostrador.');
  END IF;

  -- Código de 4 dígitos sin repetir entre los envíos de las últimas 24 h.
  LOOP
    v_codigo := lpad((floor(random() * 10000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.envios_archivos_qr
      WHERE codigo = v_codigo AND created_at > now() - interval '24 hours'
    );
    v_intentos := v_intentos + 1;
    EXIT WHEN v_intentos > 50;
  END LOOP;

  INSERT INTO public.envios_archivos_qr (codigo, archivos, cantidad, bytes)
  VALUES (v_codigo, v_limpios, jsonb_array_length(v_limpios), v_bytes)
  RETURNING id INTO v_id;

  v_resumen := CASE
    WHEN jsonb_array_length(v_limpios) = 1 THEN (v_limpios -> 0 ->> 'nombre')
    ELSE jsonb_array_length(v_limpios)::text || ' archivos'
  END;

  INSERT INTO public.user_notifications (user_id, title, description, type, is_read, origen, related_id)
  SELECT
    u.id,
    'Archivos recibidos por QR · código ' || v_codigo,
    v_resumen,
    'info',
    false,
    'envio_archivos_qr',
    'envio-archivos-qr:' || v_id
  FROM public.usuarios u
  WHERE COALESCE(u.activo, true) = true
    AND u.rol = ANY (ARRAY[
      'administracion',
      'admin',
      'gerencia',
      'mostrador',
      'caja',
      'presupuestos',
      'diseno',
      'taller-grafico'
    ]);

  RETURN json_build_object('ok', true, 'codigo', v_codigo);
END;
$$;

-- ——— Personal: listar ———
CREATE OR REPLACE FUNCTION public.listar_envios_archivos_qr(
  p_actor_id integer,
  p_estado text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  codigo text,
  archivos jsonb,
  cantidad integer,
  bytes bigint,
  estado text,
  atendido_por integer,
  atendido_por_nombre text,
  atendido_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = p_actor_id AND COALESCE(u.activo, true) = true
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN QUERY
  SELECT e.id, e.codigo, e.archivos, e.cantidad, e.bytes, e.estado,
         e.atendido_por, u.nombre::text, e.atendido_at, e.created_at
  FROM public.envios_archivos_qr e
  LEFT JOIN public.usuarios u ON u.id = e.atendido_por
  WHERE (p_estado IS NULL OR e.estado = p_estado)
    AND e.created_at > now() - interval '60 days'
  ORDER BY e.created_at DESC
  LIMIT 300;
END;
$$;

-- ——— Personal: marcar recibido / archivado / volver a nuevo ———
CREATE OR REPLACE FUNCTION public.marcar_envio_archivos_qr(
  p_id bigint,
  p_actor_id integer,
  p_estado text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = p_actor_id AND COALESCE(u.activo, true) = true
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_estado NOT IN ('nuevo', 'recibido', 'archivado') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;
  UPDATE public.envios_archivos_qr SET
    estado = p_estado,
    atendido_por = CASE WHEN p_estado = 'nuevo' THEN NULL ELSE p_actor_id END,
    atendido_at = CASE WHEN p_estado = 'nuevo' THEN NULL ELSE now() END
  WHERE id = p_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_envio_archivos_qr(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_envio_archivos_qr(jsonb, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_envios_archivos_qr(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_envios_archivos_qr(integer, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.marcar_envio_archivos_qr(bigint, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_envio_archivos_qr(bigint, integer, text) TO anon, authenticated;
