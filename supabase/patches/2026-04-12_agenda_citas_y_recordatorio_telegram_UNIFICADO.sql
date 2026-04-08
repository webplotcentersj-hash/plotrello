-- =============================================================================
-- UNIFICADO: agenda asesor (RPCs citas) + recordatorio Telegram ~30 min + NOTIFY
-- Pegar y ejecutar en Supabase SQL Editor (una sola vez).
-- =============================================================================
BEGIN;

-- Quitar sobrecargas (42725 / 42P13)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'obtener_citas_asesor',
        'crear_cita_asesor',
        'actualizar_cita_asesor',
        'eliminar_cita_asesor',
        'obtener_citas_recordatorio_telegram_15m'
      )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS es_ficha_no_op boolean;

ALTER TABLE public.citas_asesor_tecnico
  ADD COLUMN IF NOT EXISTS telefono_contacto text;

ALTER TABLE public.citas_asesor_tecnico
  ADD COLUMN IF NOT EXISTS recordatorio_telegram_15m_at timestamptz;

COMMENT ON COLUMN public.citas_asesor_tecnico.recordatorio_telegram_15m_at IS
  'Cuándo se envió el aviso por Telegram (~30 min antes de fecha_cita). NULL = aún no enviado.';

-- -----------------------------------------------------------------------------
-- obtener_citas_asesor
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obtener_citas_asesor(
  p_id_asesor integer,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  id_asesor integer,
  id_cliente integer,
  id_ficha_no_op integer,
  titulo text,
  descripcion text,
  fecha_cita timestamptz,
  duracion_minutos integer,
  direccion text,
  ubicacion_link text,
  estado text,
  notas text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by integer,
  cliente_nombre text,
  cliente_telefono text,
  cliente_email text,
  ficha_numero text,
  es_ficha_no_op boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (c.id)::integer,
    (c.id_asesor)::integer,
    (c.id_cliente)::integer,
    (c.id_ficha_no_op)::integer,
    c.titulo::text,
    c.descripcion::text,
    c.fecha_cita,
    (c.duracion_minutos)::integer,
    c.direccion::text,
    c.ubicacion_link::text,
    c.estado::text,
    c.notas::text,
    c.created_at,
    c.updated_at,
    (c.created_by)::integer,
    cl.nombre::text AS cliente_nombre,
    COALESCE(NULLIF(trim(c.telefono_contacto), ''), cl.telefono)::text AS cliente_telefono,
    cl.email::text AS cliente_email,
    ot.numero_op::text AS ficha_numero,
    ot.es_ficha_no_op AS es_ficha_no_op
  FROM public.citas_asesor_tecnico c
  LEFT JOIN public.clientes cl ON c.id_cliente = cl.id
  LEFT JOIN public.ordenes_trabajo ot ON c.id_ficha_no_op = ot.id
  WHERE c.id_asesor = p_id_asesor
    AND (p_fecha_desde IS NULL OR c.fecha_cita >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR c.fecha_cita <= p_fecha_hasta)
  ORDER BY c.fecha_cita ASC;
END;
$$;

COMMENT ON FUNCTION public.obtener_citas_asesor IS
  'Citas del asesor. ficha_numero = ordenes_trabajo.numero_op; es_ficha_no_op distingue FICHA de OP (false = OP real).';

-- -----------------------------------------------------------------------------
-- crear / actualizar / eliminar cita
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_cita_asesor(
  p_id_asesor integer,
  p_titulo varchar,
  p_fecha_cita timestamptz,
  p_id_cliente integer DEFAULT NULL,
  p_id_ficha_no_op integer DEFAULT NULL,
  p_descripcion text DEFAULT NULL,
  p_duracion_minutos integer DEFAULT 60,
  p_direccion text DEFAULT NULL,
  p_ubicacion_link text DEFAULT NULL,
  p_estado varchar DEFAULT 'programada',
  p_notas text DEFAULT NULL,
  p_telefono_contacto text DEFAULT NULL,
  p_created_by integer DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  titulo varchar,
  fecha_cita timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nueva_cita_id integer;
BEGIN
  INSERT INTO public.citas_asesor_tecnico (
    id_asesor,
    id_cliente,
    id_ficha_no_op,
    titulo,
    descripcion,
    fecha_cita,
    duracion_minutos,
    direccion,
    ubicacion_link,
    estado,
    notas,
    telefono_contacto,
    created_by
  ) VALUES (
    p_id_asesor,
    p_id_cliente,
    p_id_ficha_no_op,
    p_titulo,
    p_descripcion,
    p_fecha_cita,
    p_duracion_minutos,
    p_direccion,
    p_ubicacion_link,
    p_estado,
    p_notas,
    NULLIF(trim(p_telefono_contacto), ''),
    p_created_by
  )
  RETURNING public.citas_asesor_tecnico.id INTO nueva_cita_id;

  RETURN QUERY
  SELECT
    c.id,
    c.titulo,
    c.fecha_cita
  FROM public.citas_asesor_tecnico c
  WHERE c.id = nueva_cita_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.actualizar_cita_asesor(
  p_id integer,
  p_titulo varchar DEFAULT NULL,
  p_descripcion text DEFAULT NULL,
  p_fecha_cita timestamptz DEFAULT NULL,
  p_duracion_minutos integer DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_ubicacion_link text DEFAULT NULL,
  p_estado varchar DEFAULT NULL,
  p_notas text DEFAULT NULL,
  p_telefono_contacto text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.citas_asesor_tecnico
  SET
    titulo = COALESCE(p_titulo, titulo),
    descripcion = COALESCE(p_descripcion, descripcion),
    fecha_cita = COALESCE(p_fecha_cita, fecha_cita),
    duracion_minutos = COALESCE(p_duracion_minutos, duracion_minutos),
    direccion = COALESCE(p_direccion, direccion),
    ubicacion_link = COALESCE(p_ubicacion_link, ubicacion_link),
    estado = COALESCE(p_estado, estado),
    notas = COALESCE(p_notas, notas),
    telefono_contacto = CASE
      WHEN p_telefono_contacto IS NULL THEN telefono_contacto
      ELSE NULLIF(trim(p_telefono_contacto), '')
    END,
    updated_at = now()
  WHERE id = p_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.eliminar_cita_asesor(
  p_id integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.citas_asesor_tecnico
  WHERE id = p_id;

  RETURN FOUND;
END;
$$;

-- -----------------------------------------------------------------------------
-- Recordatorio Telegram / n8n: ventana ~30 min (27–33 min)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obtener_citas_recordatorio_telegram_15m()
RETURNS TABLE (
  id integer,
  id_asesor integer,
  titulo varchar,
  fecha_cita timestamptz,
  duracion_minutos integer,
  estado varchar,
  direccion text,
  ubicacion_link text,
  cliente_nombre text,
  ficha_numero text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.id_asesor,
    c.titulo,
    c.fecha_cita,
    c.duracion_minutos,
    c.estado,
    c.direccion,
    c.ubicacion_link,
    cl.nombre::text,
    ot.numero_op::text
  FROM public.citas_asesor_tecnico c
  LEFT JOIN public.clientes cl ON c.id_cliente = cl.id
  LEFT JOIN public.ordenes_trabajo ot ON c.id_ficha_no_op = ot.id
  WHERE c.recordatorio_telegram_15m_at IS NULL
    AND (
      c.estado IS NULL
      OR lower(trim(c.estado)) NOT IN ('completada', 'cancelada')
    )
    AND c.fecha_cita >= (now() + interval '27 minutes')
    AND c.fecha_cita <= (now() + interval '33 minutes');
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.obtener_citas_asesor TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_citas_asesor TO service_role;

GRANT EXECUTE ON FUNCTION public.crear_cita_asesor TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_cita_asesor TO service_role;

GRANT EXECUTE ON FUNCTION public.actualizar_cita_asesor TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_cita_asesor TO service_role;

GRANT EXECUTE ON FUNCTION public.eliminar_cita_asesor TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_cita_asesor TO service_role;

GRANT EXECUTE ON FUNCTION public.obtener_citas_recordatorio_telegram_15m() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
