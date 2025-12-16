-- Agregar token único para acceso público al brief
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS brief_token varchar(255) UNIQUE;

-- Índice para búsqueda rápida por token
CREATE INDEX IF NOT EXISTS idx_ordenes_brief_token ON public.ordenes_trabajo(brief_token) WHERE brief_token IS NOT NULL;

-- Función para generar token único
CREATE OR REPLACE FUNCTION public.generar_brief_token(p_id_orden integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_exists boolean;
BEGIN
  -- Generar token único (base64 de id_orden + timestamp + random)
  LOOP
    v_token := encode(
      gen_random_bytes(32),
      'base64'
    );
    v_token := translate(v_token, '/+', '_-'); -- URL-safe
    v_token := substring(v_token from 1 for 32); -- Limitar longitud
    
    -- Verificar que no exista
    SELECT EXISTS(SELECT 1 FROM public.ordenes_trabajo WHERE brief_token = v_token) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  -- Asignar token a la orden
  UPDATE public.ordenes_trabajo
  SET brief_token = v_token
  WHERE id = p_id_orden;
  
  RETURN v_token;
END;
$$;

-- Función para obtener orden por token de brief
CREATE OR REPLACE FUNCTION public.obtener_orden_por_brief_token(p_token varchar(255))
RETURNS TABLE (
  id integer,
  numero_op varchar(255),
  cliente varchar(255),
  brief_publico text,
  objetivo_proyecto text,
  publico_objetivo text,
  estilo_diseno text,
  referencias text,
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
    o.brief_publico,
    o.objetivo_proyecto,
    o.publico_objetivo,
    o.estilo_diseno,
    o.referencias,
    o.deadline_brief
  FROM public.ordenes_trabajo o
  WHERE o.brief_token = p_token;
END;
$$;

-- Función para actualizar brief desde formulario público
CREATE OR REPLACE FUNCTION public.actualizar_brief_publico(
  p_token varchar(255),
  p_brief_publico text,
  p_objetivo_proyecto text DEFAULT NULL,
  p_publico_objetivo text DEFAULT NULL,
  p_estilo_diseno text DEFAULT NULL,
  p_referencias text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ordenes_trabajo
  SET 
    brief_publico = p_brief_publico,
    objetivo_proyecto = COALESCE(p_objetivo_proyecto, objetivo_proyecto),
    publico_objetivo = COALESCE(p_publico_objetivo, publico_objetivo),
    estilo_diseno = COALESCE(p_estilo_diseno, estilo_diseno),
    referencias = COALESCE(p_referencias, referencias)
  WHERE brief_token = p_token;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token de brief no válido';
  END IF;
END;
$$;

-- Comentarios
COMMENT ON COLUMN public.ordenes_trabajo.brief_token IS 'Token único para acceso público al formulario de brief';
COMMENT ON FUNCTION public.generar_brief_token IS 'Genera un token único para el brief público de una orden';
COMMENT ON FUNCTION public.obtener_orden_por_brief_token IS 'Obtiene los datos de una orden por su token de brief';
COMMENT ON FUNCTION public.actualizar_brief_publico IS 'Actualiza el brief público desde el formulario del cliente';

