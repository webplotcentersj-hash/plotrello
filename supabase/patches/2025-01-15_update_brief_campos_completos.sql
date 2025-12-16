-- Actualizar campos de brief para incluir todos los campos del formulario completo
ALTER TABLE public.ordenes_trabajo
  -- Datos del cliente (si no están ya en otros campos)
  ADD COLUMN IF NOT EXISTS cliente_nombre_completo text,
  ADD COLUMN IF NOT EXISTS cliente_empresa text,
  
  -- Tipo de producto/servicio (array para múltiples selecciones)
  ADD COLUMN IF NOT EXISTS tipo_producto_servicio text[],
  ADD COLUMN IF NOT EXISTS tipo_producto_otro text,
  ADD COLUMN IF NOT EXISTS necesita_asesoramiento boolean DEFAULT false,
  
  -- Detalles del producto
  ADD COLUMN IF NOT EXISTS donde_colocados text,
  ADD COLUMN IF NOT EXISTS digital_o_impresion text,
  ADD COLUMN IF NOT EXISTS cantidades text,
  
  -- Material disponible
  ADD COLUMN IF NOT EXISTS material_logo text CHECK (material_logo IN ('si_pdf_eps_ai', 'si_solo_imagen', 'no', 'necesito_diseno')),
  ADD COLUMN IF NOT EXISTS material_textos text CHECK (material_textos IN ('si_definitivos', 'no', 'necesito_redacten')),
  ADD COLUMN IF NOT EXISTS material_imagenes text CHECK (material_imagenes IN ('si_material_propio', 'no', 'usar_banco_imagenes')),
  ADD COLUMN IF NOT EXISTS tiene_referencias boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS referencias_links text,
  
  -- Plazos
  ADD COLUMN IF NOT EXISTS fecha_limite_brief date,
  ADD COLUMN IF NOT EXISTS es_urgencia boolean DEFAULT false;

-- Actualizar función para obtener orden por token con nuevos campos
CREATE OR REPLACE FUNCTION public.obtener_orden_por_brief_token(p_token varchar(255))
RETURNS TABLE (
  id integer,
  numero_op varchar(255),
  cliente varchar(255),
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
  deadline_brief date
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.numero_op,
    o.cliente,
    o.cliente_nombre_completo,
    o.cliente_empresa,
    o.telefono_cliente,
    o.email_cliente,
    o.tipo_producto_servicio,
    o.tipo_producto_otro,
    o.necesita_asesoramiento,
    o.donde_colocados,
    o.digital_o_impresion,
    o.cantidades,
    o.objetivo_proyecto,
    o.material_logo,
    o.material_textos,
    o.material_imagenes,
    o.tiene_referencias,
    o.referencias_links,
    o.brief_publico,
    o.estilo_diseno,
    o.referencias,
    o.fecha_limite_brief,
    o.es_urgencia,
    o.deadline_brief
  FROM public.ordenes_trabajo o
  WHERE o.brief_token = p_token;
END;
$$;

-- Actualizar función para guardar brief completo
CREATE OR REPLACE FUNCTION public.actualizar_brief_publico(
  p_token varchar(255),
  p_cliente_nombre_completo text DEFAULT NULL,
  p_cliente_empresa text DEFAULT NULL,
  p_telefono_cliente text DEFAULT NULL,
  p_email_cliente text DEFAULT NULL,
  p_tipo_producto_servicio text[] DEFAULT NULL,
  p_tipo_producto_otro text DEFAULT NULL,
  p_necesita_asesoramiento boolean DEFAULT false,
  p_donde_colocados text DEFAULT NULL,
  p_digital_o_impresion text DEFAULT NULL,
  p_cantidades text DEFAULT NULL,
  p_objetivo_proyecto text DEFAULT NULL,
  p_material_logo text DEFAULT NULL,
  p_material_textos text DEFAULT NULL,
  p_material_imagenes text DEFAULT NULL,
  p_tiene_referencias boolean DEFAULT false,
  p_referencias_links text DEFAULT NULL,
  p_brief_publico text DEFAULT NULL,
  p_estilo_diseno text DEFAULT NULL,
  p_referencias text DEFAULT NULL,
  p_fecha_limite_brief date DEFAULT NULL,
  p_es_urgencia boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ordenes_trabajo
  SET 
    cliente_nombre_completo = COALESCE(p_cliente_nombre_completo, cliente_nombre_completo),
    cliente_empresa = COALESCE(p_cliente_empresa, cliente_empresa),
    telefono_cliente = COALESCE(p_telefono_cliente, telefono_cliente),
    email_cliente = COALESCE(p_email_cliente, email_cliente),
    tipo_producto_servicio = COALESCE(p_tipo_producto_servicio, tipo_producto_servicio),
    tipo_producto_otro = COALESCE(p_tipo_producto_otro, tipo_producto_otro),
    necesita_asesoramiento = COALESCE(p_necesita_asesoramiento, necesita_asesoramiento),
    donde_colocados = COALESCE(p_donde_colocados, donde_colocados),
    digital_o_impresion = COALESCE(p_digital_o_impresion, digital_o_impresion),
    cantidades = COALESCE(p_cantidades, cantidades),
    objetivo_proyecto = COALESCE(p_objetivo_proyecto, objetivo_proyecto),
    material_logo = COALESCE(p_material_logo, material_logo),
    material_textos = COALESCE(p_material_textos, material_textos),
    material_imagenes = COALESCE(p_material_imagenes, material_imagenes),
    tiene_referencias = COALESCE(p_tiene_referencias, tiene_referencias),
    referencias_links = COALESCE(p_referencias_links, referencias_links),
    brief_publico = COALESCE(p_brief_publico, brief_publico),
    estilo_diseno = COALESCE(p_estilo_diseno, estilo_diseno),
    referencias = COALESCE(p_referencias, referencias),
    fecha_limite_brief = COALESCE(p_fecha_limite_brief, fecha_limite_brief),
    es_urgencia = COALESCE(p_es_urgencia, es_urgencia)
  WHERE brief_token = p_token;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token de brief no válido';
  END IF;
END;
$$;

