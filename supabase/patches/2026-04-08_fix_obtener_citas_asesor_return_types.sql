-- Corrige: "structure of query does not match function result type" (varchar/text vs JOIN)
-- y expone es_ficha_no_op para distinguir referencia Ficha No OP vs OP real (mismo numero_op en OT).
BEGIN;

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
    c.id,
    c.id_asesor,
    c.id_cliente,
    c.id_ficha_no_op,
    c.titulo::text,
    c.descripcion::text,
    c.fecha_cita,
    c.duracion_minutos,
    c.direccion::text,
    c.ubicacion_link::text,
    c.estado::text,
    c.notas::text,
    c.created_at,
    c.updated_at,
    c.created_by,
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
  'Citas del asesor. ficha_numero = ordenes_trabajo.numero_op; es_ficha_no_op distingue FICHA (true/NULL) de OP ya generada (false).';

COMMIT;
