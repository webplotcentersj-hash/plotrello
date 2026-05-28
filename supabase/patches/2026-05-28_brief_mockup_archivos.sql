-- Mockup y archivos del brief público → Storage + Plot Lab + enlaces al crear OP

CREATE TABLE IF NOT EXISTS public.briefs_publicos_archivos (
  id serial PRIMARY KEY,
  id_brief integer NOT NULL REFERENCES public.briefs_publicos(id) ON DELETE CASCADE,
  url text NOT NULL,
  nombre_archivo text,
  tipo text,
  tamaño bigint,
  uploaded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefs_archivos_brief ON public.briefs_publicos_archivos(id_brief);
CREATE INDEX IF NOT EXISTS idx_briefs_archivos_mockup ON public.briefs_publicos_archivos(id_brief)
  WHERE tipo = 'mockup_vista_previa' OR lower(coalesce(nombre_archivo, '')) LIKE 'mockup-vista-previa%';

INSERT INTO storage.buckets (id, name, public)
VALUES ('briefs-publicos', 'briefs-publicos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Briefs publicos upload" ON storage.objects;
CREATE POLICY "Briefs publicos upload"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'briefs-publicos');

DROP POLICY IF EXISTS "Briefs publicos read" ON storage.objects;
CREATE POLICY "Briefs publicos read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'briefs-publicos');

CREATE OR REPLACE FUNCTION public.brief_mockup_url(p_id_brief integer)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT a.url
  FROM public.briefs_publicos_archivos a
  WHERE a.id_brief = p_id_brief
    AND (
      a.tipo = 'mockup_vista_previa'
      OR lower(coalesce(a.nombre_archivo, '')) LIKE 'mockup-vista-previa%'
    )
  ORDER BY a.uploaded_at DESC NULLS LAST, a.id DESC
  LIMIT 1;
$$;

-- obtener_brief_por_token (+ mockup_url)
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
  WHERE b.token = p_token;
END;
$$;

-- listar_briefs_pendientes (+ mockup_url)
DROP FUNCTION IF EXISTS public.listar_briefs_pendientes();

CREATE OR REPLACE FUNCTION public.listar_briefs_pendientes()
RETURNS TABLE (
  id integer,
  token varchar,
  cliente_nombre_completo text,
  cliente_empresa text,
  telefono_cliente text,
  email_cliente text,
  tipo_producto_servicio text[],
  objetivo_proyecto text,
  brief_publico text,
  donde_colocados text,
  estilo_diseno text,
  fecha_creacion timestamp,
  fecha_completado timestamp,
  completado boolean,
  es_urgencia boolean,
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
    b.objetivo_proyecto,
    b.brief_publico,
    b.donde_colocados,
    b.estilo_diseno,
    b.fecha_creacion,
    b.fecha_completado,
    b.completado,
    b.es_urgencia,
    public.brief_mockup_url(b.id) AS mockup_url
  FROM public.briefs_publicos b
  WHERE b.id_orden_asociada IS NULL
  ORDER BY b.fecha_completado DESC NULLS LAST, b.fecha_creacion DESC;
END;
$$;

-- Asociar brief → OP: copiar campos, spec en descripción, archivos → enlaces_adjuntos
DROP FUNCTION IF EXISTS public.asociar_brief_a_orden(varchar, integer);

CREATE OR REPLACE FUNCTION public.asociar_brief_a_orden(
  p_token_brief varchar,
  p_id_orden integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brief_id integer;
  v_email text;
  v_cliente_id integer;
  v_numero_op varchar(255);
  v_spec text := '';
  v_mockup_url text;
  archivo_record RECORD;
  b RECORD;
BEGIN
  SELECT bp.* INTO b
  FROM public.briefs_publicos bp
  WHERE bp.token = p_token_brief;

  IF b.id IS NULL THEN
    RAISE EXCEPTION 'Brief no encontrado';
  END IF;

  v_brief_id := b.id;
  v_email := b.email_cliente;

  UPDATE public.briefs_publicos
  SET id_orden_asociada = p_id_orden
  WHERE id = v_brief_id;

  IF b.tipo_producto_otro IS NOT NULL AND trim(b.tipo_producto_otro) <> '' THEN
    v_spec := v_spec || E'\n[Otro producto]\n' || trim(b.tipo_producto_otro);
  END IF;
  IF b.objetivo_proyecto IS NOT NULL AND trim(b.objetivo_proyecto) <> '' THEN
    v_spec := v_spec || E'\n[Objetivo]\n' || trim(b.objetivo_proyecto);
  END IF;
  IF b.brief_publico IS NOT NULL AND trim(b.brief_publico) <> '' THEN
    v_spec := v_spec || E'\n[Brief cliente]\n' || trim(b.brief_publico);
  END IF;
  IF b.donde_colocados IS NOT NULL AND trim(b.donde_colocados) <> '' THEN
    v_spec := v_spec || E'\n[Ubicación / uso]\n' || trim(b.donde_colocados);
  END IF;
  IF b.digital_o_impresion IS NOT NULL AND trim(b.digital_o_impresion) <> '' THEN
    v_spec := v_spec || E'\n[Formato]\n' || trim(b.digital_o_impresion);
  END IF;
  IF b.cantidades IS NOT NULL AND trim(b.cantidades) <> '' THEN
    v_spec := v_spec || E'\n[Cantidades]\n' || trim(b.cantidades);
  END IF;
  IF b.estilo_diseno IS NOT NULL AND trim(b.estilo_diseno) <> '' THEN
    v_spec := v_spec || E'\n[Estilo]\n' || trim(b.estilo_diseno);
  END IF;
  IF b.referencias IS NOT NULL AND trim(b.referencias) <> '' THEN
    v_spec := v_spec || E'\n[Referencias]\n' || trim(b.referencias);
  END IF;
  IF b.referencias_links IS NOT NULL AND trim(b.referencias_links) <> '' THEN
    v_spec := v_spec || E'\n[Links referencia]\n' || trim(b.referencias_links);
  END IF;

  v_mockup_url := public.brief_mockup_url(v_brief_id);
  IF v_mockup_url IS NOT NULL THEN
    v_spec := v_spec || E'\n[Mockup vista previa]\n' || v_mockup_url;
  END IF;

  UPDATE public.ordenes_trabajo ot
  SET
    cliente_nombre_completo = b.cliente_nombre_completo,
    cliente_empresa = b.cliente_empresa,
    telefono_cliente = COALESCE(b.telefono_cliente, ot.telefono_cliente),
    email_cliente = COALESCE(b.email_cliente, ot.email_cliente),
    tipo_producto_servicio = b.tipo_producto_servicio,
    tipo_producto_otro = b.tipo_producto_otro,
    necesita_asesoramiento = b.necesita_asesoramiento,
    donde_colocados = b.donde_colocados,
    digital_o_impresion = b.digital_o_impresion,
    cantidades = b.cantidades,
    objetivo_proyecto = COALESCE(b.objetivo_proyecto, ot.objetivo_proyecto),
    material_logo = b.material_logo,
    material_textos = b.material_textos,
    material_imagenes = b.material_imagenes,
    tiene_referencias = b.tiene_referencias,
    referencias_links = b.referencias_links,
    brief_publico = COALESCE(b.brief_publico, ot.brief_publico),
    estilo_diseno = COALESCE(b.estilo_diseno, ot.estilo_diseno),
    referencias = COALESCE(b.referencias, ot.referencias),
    fecha_limite_brief = b.fecha_limite_brief,
    es_urgencia = b.es_urgencia,
    descripcion = trim(
      COALESCE(ot.descripcion, '') ||
      CASE WHEN trim(v_spec) <> '' THEN E'\n\n--- Brief portal cliente ---' || v_spec ELSE '' END
    ),
    etiquetas = (
      SELECT array_agg(DISTINCT e)
      FROM unnest(COALESCE(ot.etiquetas, ARRAY[]::text[]) || ARRAY['Brief portal']::text[]) AS e
    )
  WHERE ot.id = p_id_orden;

  FOR archivo_record IN
    SELECT * FROM public.briefs_publicos_archivos ba
    WHERE ba.id_brief = v_brief_id
  LOOP
    INSERT INTO public.enlaces_adjuntos (id_orden, titulo, url)
    VALUES (
      p_id_orden,
      CASE
        WHEN archivo_record.tipo = 'mockup_vista_previa'
          OR lower(coalesce(archivo_record.nombre_archivo, '')) LIKE 'mockup-vista-previa%'
          THEN 'Mockup brief · ' || COALESCE(b.cliente_nombre_completo, 'Cliente')
        WHEN archivo_record.tipo = 'referencia_cliente'
          THEN 'Referencia brief · ' || coalesce(archivo_record.nombre_archivo, 'imagen')
        ELSE coalesce(archivo_record.nombre_archivo, 'Archivo brief')
      END,
      archivo_record.url
    );
  END LOOP;

  v_cliente_id := NULL;
  IF v_email IS NOT NULL AND length(trim(v_email)) > 0 THEN
    SELECT c.id INTO v_cliente_id
    FROM public.clientes c
    WHERE lower(c.email) = lower(trim(v_email))
    ORDER BY c.id DESC
    LIMIT 1;
  END IF;

  SELECT numero_op INTO v_numero_op
  FROM public.ordenes_trabajo
  WHERE id = p_id_orden;

  IF v_cliente_id IS NOT NULL THEN
    BEGIN
      PERFORM public.crear_notificacion_cliente(
        v_cliente_id,
        'op_desde_brief',
        'Tu brief ahora es una OP',
        'Creamos la OP ' || COALESCE(v_numero_op, p_id_orden::text) || ' a partir de tu brief.',
        NULL,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error notificación asociar_brief_a_orden: %', SQLERRM;
    END;
  END IF;
END;
$$;

COMMENT ON TABLE public.briefs_publicos_archivos IS 'Archivos del brief público (mockup, referencias)';
COMMENT ON FUNCTION public.brief_mockup_url IS 'URL del mockup más reciente de un brief';
