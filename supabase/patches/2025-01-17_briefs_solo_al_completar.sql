-- Modificar sistema de briefs para que solo se creen cuando el cliente los complete
-- En lugar de crear el brief al generar el link, solo se guarda el token
-- El brief se crea cuando el cliente guarda el formulario por primera vez

-- ============================================
-- 1. CREAR TABLA DE TOKENS PENDIENTES
-- ============================================
CREATE TABLE IF NOT EXISTS public.briefs_tokens_pendientes (
  id SERIAL PRIMARY KEY,
  token varchar(255) UNIQUE NOT NULL,
  creado_por integer REFERENCES public.usuarios(id),
  fecha_creacion timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefs_tokens_pendientes_token ON public.briefs_tokens_pendientes(token);
CREATE INDEX IF NOT EXISTS idx_briefs_tokens_pendientes_creado_por ON public.briefs_tokens_pendientes(creado_por);

-- ============================================
-- 2. MODIFICAR FUNCIÓN crear_brief_publico
-- ============================================
-- Ahora solo crea el token en la tabla de pendientes, NO crea el brief completo
DROP FUNCTION IF EXISTS public.crear_brief_publico(integer);

CREATE OR REPLACE FUNCTION public.crear_brief_publico(
  p_creado_por integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
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
    
    -- Verificar que no exista en ninguna de las dos tablas
    SELECT EXISTS(
      SELECT 1 FROM public.briefs_publicos WHERE token = v_token
      UNION
      SELECT 1 FROM public.briefs_tokens_pendientes WHERE token = v_token
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  -- Crear solo el token pendiente, NO el brief completo
  INSERT INTO public.briefs_tokens_pendientes (token, creado_por, fecha_creacion)
  VALUES (v_token, p_creado_por, NOW());
  
  RETURN v_token;
END;
$$;

-- ============================================
-- 3. MODIFICAR FUNCIÓN actualizar_brief_publico_completo
-- ============================================
-- Ahora crea el brief si el token está pendiente, o actualiza si ya existe
DROP FUNCTION IF EXISTS public.actualizar_brief_publico_completo(
  varchar, text, text, text, text, text[], text, boolean, text, text, text, text, text, text, boolean, text, text, text, text, date, boolean
);

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
DECLARE
  v_token_pendiente_id integer;
  v_creado_por integer;
  v_brief_exists boolean;
BEGIN
  -- Verificar si el token está en pendientes
  SELECT id, creado_por INTO v_token_pendiente_id, v_creado_por
  FROM public.briefs_tokens_pendientes
  WHERE token = p_token;
  
  -- Verificar si el brief ya existe
  SELECT EXISTS(SELECT 1 FROM public.briefs_publicos WHERE token = p_token) INTO v_brief_exists;
  
  IF v_token_pendiente_id IS NOT NULL THEN
    -- Token está pendiente: crear el brief completo
    INSERT INTO public.briefs_publicos (
      token,
      creado_por,
      cliente_nombre_completo,
      cliente_empresa,
      telefono_cliente,
      email_cliente,
      tipo_producto_servicio,
      tipo_producto_otro,
      necesita_asesoramiento,
      donde_colocados,
      digital_o_impresion,
      cantidades,
      objetivo_proyecto,
      material_logo,
      material_textos,
      material_imagenes,
      tiene_referencias,
      referencias_links,
      brief_publico,
      estilo_diseno,
      referencias,
      fecha_limite_brief,
      es_urgencia,
      completado,
      fecha_creacion,
      fecha_completado,
      fecha_actualizacion
    ) VALUES (
      p_token,
      v_creado_por,
      p_cliente_nombre_completo,
      p_cliente_empresa,
      p_telefono_cliente,
      p_email_cliente,
      p_tipo_producto_servicio,
      p_tipo_producto_otro,
      p_necesita_asesoramiento,
      p_donde_colocados,
      p_digital_o_impresion,
      p_cantidades,
      p_objetivo_proyecto,
      p_material_logo,
      p_material_textos,
      p_material_imagenes,
      p_tiene_referencias,
      p_referencias_links,
      p_brief_publico,
      p_estilo_diseno,
      p_referencias,
      p_fecha_limite_brief,
      p_es_urgencia,
      true, -- Completado
      NOW(), -- fecha_creacion
      NOW(), -- fecha_completado
      NOW()  -- fecha_actualizacion
    );
    
    -- Eliminar el token de pendientes
    DELETE FROM public.briefs_tokens_pendientes WHERE id = v_token_pendiente_id;
    
  ELSIF v_brief_exists THEN
    -- Brief ya existe: actualizar normalmente
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
      fecha_completado = COALESCE(fecha_completado, NOW()),
      fecha_actualizacion = NOW()
    WHERE token = p_token;
  ELSE
    -- Token no existe en ninguna tabla
    RAISE EXCEPTION 'Token de brief no válido';
  END IF;
END;
$$;

-- ============================================
-- 4. MODIFICAR FUNCIÓN obtener_brief_por_token
-- ============================================
-- Debe verificar también en tokens pendientes para permitir acceso al formulario
DROP FUNCTION IF EXISTS public.obtener_brief_por_token(varchar);

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
  LEFT JOIN public.ordenes_trabajo o ON o.id = b.id_orden_asociada
  WHERE b.token = p_token
  
  UNION ALL
  
  -- Si el token está pendiente, retornar un registro vacío para permitir acceso al formulario
  SELECT 
    NULL::integer as id,
    tp.token,
    NULL::text as cliente_nombre_completo,
    NULL::text as cliente_empresa,
    NULL::text as telefono_cliente,
    NULL::text as email_cliente,
    NULL::text[] as tipo_producto_servicio,
    NULL::text as tipo_producto_otro,
    false as necesita_asesoramiento,
    NULL::text as donde_colocados,
    NULL::text as digital_o_impresion,
    NULL::text as cantidades,
    NULL::text as objetivo_proyecto,
    NULL::text as material_logo,
    NULL::text as material_textos,
    NULL::text as material_imagenes,
    false as tiene_referencias,
    NULL::text as referencias_links,
    NULL::text as brief_publico,
    NULL::text as estilo_diseno,
    NULL::text as referencias,
    NULL::date as fecha_limite_brief,
    false as es_urgencia,
    NULL::integer as id_orden_asociada,
    false as completado,
    NULL::varchar as numero_op,
    NULL::varchar as cliente
  FROM public.briefs_tokens_pendientes tp
  WHERE tp.token = p_token
  AND NOT EXISTS (
    SELECT 1 FROM public.briefs_publicos WHERE token = p_token
  );
END;
$$;

-- ============================================
-- 5. ACTUALIZAR FUNCIÓN listar_briefs_pendientes
-- ============================================
-- Asegurar que solo muestre briefs completados
DROP FUNCTION IF EXISTS public.listar_briefs_pendientes();

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
    AND b.completado = true  -- Solo mostrar briefs completados
  ORDER BY b.fecha_creacion DESC;
END;
$$;

-- ============================================
-- 6. COMENTARIOS
-- ============================================
COMMENT ON TABLE public.briefs_tokens_pendientes IS 'Tokens de briefs generados pero aún no completados por el cliente';
COMMENT ON COLUMN public.briefs_tokens_pendientes.token IS 'Token único para acceso público al formulario de brief';
COMMENT ON FUNCTION public.crear_brief_publico IS 'Crea solo un token pendiente, NO crea el brief completo. El brief se crea cuando el cliente guarda el formulario.';
COMMENT ON FUNCTION public.actualizar_brief_publico_completo IS 'Crea el brief si el token está pendiente, o actualiza si ya existe. Solo se crea cuando el cliente guarda el formulario.';
COMMENT ON FUNCTION public.listar_briefs_pendientes IS 'Lista todos los briefs públicos completados que aún no tienen una OP asociada';

