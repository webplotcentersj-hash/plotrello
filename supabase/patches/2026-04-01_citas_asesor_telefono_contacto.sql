-- Teléfono de contacto en citas del asesor (manual, sin depender solo de cliente vinculado)
BEGIN;

ALTER TABLE public.citas_asesor_tecnico
  ADD COLUMN IF NOT EXISTS telefono_contacto text;

-- ============================================
-- OBTENER: priorizar teléfono guardado en la cita, sino el del cliente
-- ============================================
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
  titulo varchar,
  descripcion text,
  fecha_cita timestamptz,
  duracion_minutos integer,
  direccion text,
  ubicacion_link text,
  estado varchar,
  notas text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by integer,
  cliente_nombre varchar,
  cliente_telefono varchar,
  cliente_email varchar,
  ficha_numero varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.id_asesor,
    c.id_cliente,
    c.id_ficha_no_op,
    c.titulo,
    c.descripcion,
    c.fecha_cita,
    c.duracion_minutos,
    c.direccion,
    c.ubicacion_link,
    c.estado,
    c.notas,
    c.created_at,
    c.updated_at,
    c.created_by,
    cl.nombre AS cliente_nombre,
    COALESCE(NULLIF(trim(c.telefono_contacto), ''), cl.telefono)::varchar AS cliente_telefono,
    cl.email AS cliente_email,
    ot.numero_op AS ficha_numero
  FROM public.citas_asesor_tecnico c
  LEFT JOIN public.clientes cl ON c.id_cliente = cl.id
  LEFT JOIN public.ordenes_trabajo ot ON c.id_ficha_no_op = ot.id
  WHERE c.id_asesor = p_id_asesor
    AND (p_fecha_desde IS NULL OR c.fecha_cita >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR c.fecha_cita <= p_fecha_hasta)
  ORDER BY c.fecha_cita ASC;
END;
$$;

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

COMMIT;
