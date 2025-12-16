-- Crear tabla separada para briefs públicos (antes de crear la OP)
CREATE TABLE IF NOT EXISTS public.briefs_publicos (
  id SERIAL PRIMARY KEY,
  token varchar(255) UNIQUE NOT NULL,
  -- Datos del cliente
  cliente_nombre_completo text,
  cliente_empresa text,
  telefono_cliente text,
  email_cliente text,
  
  -- Tipo de producto/servicio
  tipo_producto_servicio text[],
  tipo_producto_otro text,
  necesita_asesoramiento boolean DEFAULT false,
  
  -- Detalles del producto
  donde_colocados text,
  digital_o_impresion text,
  cantidades text,
  
  -- Objetivo
  objetivo_proyecto text,
  
  -- Material disponible
  material_logo text CHECK (material_logo IN ('si_pdf_eps_ai', 'si_solo_imagen', 'no', 'necesito_diseno')),
  material_textos text CHECK (material_textos IN ('si_definitivos', 'no', 'necesito_redacten')),
  material_imagenes text CHECK (material_imagenes IN ('si_material_propio', 'no', 'usar_banco_imagenes')),
  tiene_referencias boolean DEFAULT false,
  referencias_links text,
  
  -- Brief y referencias
  brief_publico text,
  estilo_diseno text,
  referencias text,
  
  -- Plazos
  fecha_limite_brief date,
  es_urgencia boolean DEFAULT false,
  
  -- Control
  id_orden_asociada integer REFERENCES public.ordenes_trabajo(id) ON DELETE SET NULL,
  completado boolean DEFAULT false,
  creado_por integer REFERENCES public.usuarios(id),
  fecha_creacion timestamp DEFAULT NOW(),
  fecha_completado timestamp,
  fecha_actualizacion timestamp DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_briefs_token ON public.briefs_publicos(token);
CREATE INDEX IF NOT EXISTS idx_briefs_orden ON public.briefs_publicos(id_orden_asociada) WHERE id_orden_asociada IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_briefs_completado ON public.briefs_publicos(completado);

-- Función para crear un nuevo brief público (sin OP)
CREATE OR REPLACE FUNCTION public.crear_brief_publico(
  p_creado_por integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_brief_id integer;
  v_exists boolean;
BEGIN
  -- Generar token único
  LOOP
    v_token := encode(
      gen_random_bytes(32),
      'base64'
    );
    v_token := translate(v_token, '/+', '_-');
    v_token := substring(v_token from 1 for 32);
    
    SELECT EXISTS(SELECT 1 FROM public.briefs_publicos WHERE token = v_token) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  -- Crear el brief
  INSERT INTO public.briefs_publicos (token, creado_por, fecha_creacion)
  VALUES (v_token, p_creado_por, NOW())
  RETURNING id INTO v_brief_id;
  
  RETURN v_token;
END;
$$;

-- Función para obtener brief por token
CREATE OR REPLACE FUNCTION public.obtener_brief_por_token(p_token varchar(255))
RETURNS TABLE (
  id integer,
  token varchar(255),
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
  numero_op varchar(255),
  cliente varchar(255)
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
    o.cliente
  FROM public.briefs_publicos b
  LEFT JOIN public.ordenes_trabajo o ON b.id_orden_asociada = o.id
  WHERE b.token = p_token;
END;
$$;

-- Función para actualizar brief desde formulario público
CREATE OR REPLACE FUNCTION public.actualizar_brief_publico_completo(
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
  UPDATE public.briefs_publicos
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
    es_urgencia = COALESCE(p_es_urgencia, es_urgencia),
    completado = true,
    fecha_completado = NOW(),
    fecha_actualizacion = NOW()
  WHERE token = p_token;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token de brief no válido';
  END IF;
END;
$$;

-- Función para asociar un brief a una orden
CREATE OR REPLACE FUNCTION public.asociar_brief_a_orden(
  p_token_brief varchar(255),
  p_id_orden integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_brief_id integer;
BEGIN
  -- Obtener el ID del brief
  SELECT id INTO v_brief_id FROM public.briefs_publicos WHERE token = p_token_brief;
  
  IF v_brief_id IS NULL THEN
    RAISE EXCEPTION 'Brief no encontrado';
  END IF;
  
  -- Asociar el brief a la orden
  UPDATE public.briefs_publicos
  SET id_orden_asociada = p_id_orden
  WHERE id = v_brief_id;
  
  -- Copiar datos del brief a la orden
  UPDATE public.ordenes_trabajo
  SET
    cliente_nombre_completo = b.cliente_nombre_completo,
    cliente_empresa = b.cliente_empresa,
    telefono_cliente = COALESCE(b.telefono_cliente, telefono_cliente),
    email_cliente = COALESCE(b.email_cliente, email_cliente),
    tipo_producto_servicio = b.tipo_producto_servicio,
    tipo_producto_otro = b.tipo_producto_otro,
    necesita_asesoramiento = b.necesita_asesoramiento,
    donde_colocados = b.donde_colocados,
    digital_o_impresion = b.digital_o_impresion,
    cantidades = b.cantidades,
    objetivo_proyecto = COALESCE(b.objetivo_proyecto, objetivo_proyecto),
    material_logo = b.material_logo,
    material_textos = b.material_textos,
    material_imagenes = b.material_imagenes,
    tiene_referencias = b.tiene_referencias,
    referencias_links = b.referencias_links,
    brief_publico = COALESCE(b.brief_publico, brief_publico),
    estilo_diseno = COALESCE(b.estilo_diseno, estilo_diseno),
    referencias = COALESCE(b.referencias, referencias),
    fecha_limite_brief = b.fecha_limite_brief,
    es_urgencia = b.es_urgencia
  FROM public.briefs_publicos b
  WHERE ordenes_trabajo.id = p_id_orden AND b.id = v_brief_id;
END;
$$;

-- Comentarios
COMMENT ON TABLE public.briefs_publicos IS 'Briefs públicos completados por clientes antes de crear la OP';
COMMENT ON COLUMN public.briefs_publicos.token IS 'Token único para acceso público al formulario de brief';
COMMENT ON COLUMN public.briefs_publicos.id_orden_asociada IS 'ID de la orden asociada (se asigna cuando se crea la OP)';
COMMENT ON COLUMN public.briefs_publicos.completado IS 'Indica si el cliente completó el formulario';

