-- Restaurar acceso al formulario con token en briefs_tokens_pendientes (brief nuevo sin guardar)

DROP FUNCTION IF EXISTS public.obtener_brief_por_token(varchar);

CREATE OR REPLACE FUNCTION public.obtener_brief_por_token(p_token varchar)
RETURNS TABLE (
  id integer,
  token varchar,
  cliente_nombre_completo text,
  cliente_empresa text,
  telefono_cliente text,
  email_cliente text,
  tipo_producto_servicio text[],
  tipo_producto_otro text,
  necesita_asesoramiento boolean,
  donde_colocados text,
  digital_o_impresion text,
  cantidades text,
  objetivo_proyecto text,
  material_logo text,
  material_textos text,
  material_imagenes text,
  tiene_referencias boolean,
  referencias_links text,
  brief_publico text,
  estilo_diseno text,
  referencias text,
  fecha_limite_brief date,
  es_urgencia boolean,
  id_orden_asociada integer,
  completado boolean,
  numero_op varchar,
  cliente varchar,
  mockup_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.token,
    b.cliente_nombre_completo,
    b.cliente_empresa,
    b.telefono_cliente,
    b.email_cliente,
    b.tipo_producto_servicio,
    b.tipo_producto_otro,
    b.necesita_asesoramiento,
    b.donde_colocados,
    b.digital_o_impresion,
    b.cantidades,
    b.objetivo_proyecto,
    b.material_logo,
    b.material_textos,
    b.material_imagenes,
    b.tiene_referencias,
    b.referencias_links,
    b.brief_publico,
    b.estilo_diseno,
    b.referencias,
    b.fecha_limite_brief,
    b.es_urgencia,
    b.id_orden_asociada,
    b.completado,
    o.numero_op,
    o.cliente,
    public.brief_mockup_url(b.id) AS mockup_url
  FROM public.briefs_publicos b
  LEFT JOIN public.ordenes_trabajo o ON b.id_orden_asociada = o.id
  WHERE b.token = p_token

  UNION ALL

  SELECT
    NULL::integer,
    tp.token,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text[],
    NULL::text,
    false,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    false,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::date,
    false,
    NULL::integer,
    false,
    NULL::varchar,
    NULL::varchar,
    NULL::text
  FROM public.briefs_tokens_pendientes tp
  WHERE tp.token = p_token
    AND NOT EXISTS (
      SELECT 1 FROM public.briefs_publicos bp WHERE bp.token = p_token
    );
END;
$$;

COMMENT ON FUNCTION public.obtener_brief_por_token IS
  'Brief guardado o token pendiente (formulario nuevo); incluye mockup_url si existe.';
