-- Función para listar briefs pendientes (sin OP asociada)
CREATE OR REPLACE FUNCTION public.listar_briefs_pendientes()
RETURNS TABLE (
  id integer,
  token varchar(255),
  cliente_nombre_completo text,
  cliente_empresa text,
  telefono_cliente text,
  email_cliente text,
  tipo_producto_servicio text[],
  objetivo_proyecto text,
  fecha_creacion timestamp,
  fecha_completado timestamp,
  completado boolean,
  es_urgencia boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
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
    b.objetivo_proyecto,
    b.fecha_creacion,
    b.fecha_completado,
    b.completado,
    b.es_urgencia
  FROM public.briefs_publicos b
  WHERE b.id_orden_asociada IS NULL
  ORDER BY b.fecha_creacion DESC;
END;
$$;

COMMENT ON FUNCTION public.listar_briefs_pendientes IS 'Lista todos los briefs públicos que aún no tienen una OP asociada';

