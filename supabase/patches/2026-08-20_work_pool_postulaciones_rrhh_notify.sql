-- Plot Design Afines: puente RRHH → work_pool_solicitudes + notificaciones a admins

BEGIN;

ALTER TABLE public.work_pool_solicitudes
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'formulario',
  ADD COLUMN IF NOT EXISTS id_rrhh_postulacion bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_pool_solicitudes_origen_check'
  ) THEN
    ALTER TABLE public.work_pool_solicitudes
      ADD CONSTRAINT work_pool_solicitudes_origen_check
      CHECK (origen IN ('formulario', 'rrhh'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS work_pool_solicitudes_id_rrhh_uidx
  ON public.work_pool_solicitudes (id_rrhh_postulacion)
  WHERE id_rrhh_postulacion IS NOT NULL;

CREATE INDEX IF NOT EXISTS work_pool_solicitudes_rubro_estado_idx
  ON public.work_pool_solicitudes (rubro, estado);

COMMENT ON COLUMN public.work_pool_solicitudes.origen IS
  'formulario = /postulacion-operarios; rrhh = espejo desde rrhh_postulaciones (diseño)';
COMMENT ON COLUMN public.work_pool_solicitudes.id_rrhh_postulacion IS
  'FK lógica a rrhh_postulaciones.id cuando origen = rrhh';

-- ─── Helpers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rrhh_postulacion_es_diseno(
  p_puesto text,
  p_categoria text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    lower(coalesce(p_categoria, '')) LIKE '%dise%'
    OR lower(coalesce(p_puesto, '')) LIKE '%diseñ%'
    OR lower(coalesce(p_puesto, '')) LIKE '%disen%'
    OR lower(coalesce(p_puesto, '')) LIKE '%diseñador%'
    OR lower(coalesce(p_puesto, '')) LIKE '%disenador%';
$$;

CREATE OR REPLACE FUNCTION public.work_pool_nivel_desde_puesto_rrhh(p_puesto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_puesto, '')) LIKE '%senior%' THEN 'semi_senior'
    WHEN lower(coalesce(p_puesto, '')) LIKE '%junior%' THEN 'junior'
    WHEN lower(coalesce(p_puesto, '')) LIKE '%ux%' OR lower(coalesce(p_puesto, '')) LIKE '%ui%' THEN 'junior'
    ELSE 'junior'
  END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_notificar_admins_postulacion(
  p_titulo text,
  p_descripcion text,
  p_rubro text DEFAULT 'diseno',
  p_related_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_roles text[];
BEGIN
  IF p_rubro = 'diseno' THEN
    v_roles := ARRAY['admin', 'gerencia', 'presupuestos', 'diseno'];
  ELSE
    v_roles := ARRAY['admin', 'gerencia', 'presupuestos', 'instalaciones', 'metalurgica'];
  END IF;

  INSERT INTO public.user_notifications (
    user_id, title, description, type, is_read, origen, related_id
  )
  SELECT
    u.id,
    trim(p_titulo),
    NULLIF(trim(p_descripcion), ''),
    'info',
    false,
    'work_pool_postulacion',
    p_related_id
  FROM public.usuarios u
  WHERE COALESCE(u.activo, true) = true
    AND u.rol = ANY (v_roles);
END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_mirror_rrhh_postulacion(
  p_id_rrhh bigint,
  p_notify boolean DEFAULT true
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r public.rrhh_postulaciones%ROWTYPE;
  v_id integer;
  v_nivel text;
  v_exp text;
BEGIN
  SELECT * INTO r FROM public.rrhh_postulaciones WHERE id = p_id_rrhh;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Postulación RRHH no encontrada';
  END IF;

  IF NOT public.rrhh_postulacion_es_diseno(r.puesto, r.categoria_puesto) THEN
    RAISE EXCEPTION 'La postulación no es de diseño; no se envía a Plot Design';
  END IF;

  SELECT s.id INTO v_id
  FROM public.work_pool_solicitudes s
  WHERE s.id_rrhh_postulacion = p_id_rrhh
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Evitar duplicar por mismo email pendiente en diseño
  SELECT s.id INTO v_id
  FROM public.work_pool_solicitudes s
  WHERE s.estado = 'pendiente'
    AND (s.rubro = 'diseno' OR s.tipo = 'diseno')
    AND lower(s.email) = lower(r.email)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.work_pool_solicitudes
    SET id_rrhh_postulacion = p_id_rrhh,
        origen = 'rrhh',
        updated_at = now()
    WHERE id = v_id
      AND id_rrhh_postulacion IS NULL;
    RETURN v_id;
  END IF;

  v_nivel := public.work_pool_nivel_desde_puesto_rrhh(r.puesto);
  v_exp := COALESCE(
    NULLIF(trim(r.mensaje), ''),
    'Postulación vía RRHH · ' || COALESCE(NULLIF(trim(r.puesto), ''), 'Diseño')
  );

  INSERT INTO public.work_pool_solicitudes (
    tipo, rubro, nivel, nombre_completo, email, telefono,
    experiencia, mensaje, skills, cv_url, cv_nombre,
    estado, origen, id_rrhh_postulacion, notas_admin
  ) VALUES (
    'diseno',
    'diseno',
    v_nivel,
    trim(r.nombre),
    lower(trim(r.email)),
    NULLIF(trim(r.telefono), ''),
    v_exp,
    NULLIF(trim(r.mensaje), ''),
    ARRAY[]::text[],
    NULLIF(trim(r.cv_url), ''),
    NULLIF(trim(r.cv_nombre), ''),
    'pendiente',
    'rrhh',
    p_id_rrhh,
    'Importado desde RRHH /postulaciones #' || p_id_rrhh::text
  )
  RETURNING id INTO v_id;

  IF p_notify THEN
    PERFORM public.work_pool_notificar_admins_postulacion(
      '[Plot Design] Nueva postulación',
      trim(r.nombre) || ' · ' || COALESCE(NULLIF(trim(r.puesto), ''), 'Diseño') || ' (desde RRHH)',
      'diseno',
      v_id
    );
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_postulacion_es_diseno(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_pool_nivel_desde_puesto_rrhh(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.work_pool_notificar_admins_postulacion(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.work_pool_mirror_rrhh_postulacion(bigint, boolean) TO authenticated;

-- ─── work_pool_enviar_solicitud: notificar admins ───────────────────────────

CREATE OR REPLACE FUNCTION public.work_pool_enviar_solicitud(
  p_rubro text,
  p_nivel text,
  p_nombre_completo text,
  p_email text,
  p_experiencia text,
  p_telefono text DEFAULT NULL::text,
  p_documento text DEFAULT NULL::text,
  p_titulo_texto text DEFAULT NULL::text,
  p_referencias text DEFAULT NULL::text,
  p_portfolio_url text DEFAULT NULL::text,
  p_mensaje text DEFAULT NULL::text,
  p_skills text[] DEFAULT '{}'::text[],
  p_zona_cobertura text DEFAULT NULL::text,
  p_cv_url text DEFAULT NULL::text,
  p_cv_nombre text DEFAULT NULL::text,
  p_titulo_url text DEFAULT NULL::text,
  p_titulo_nombre text DEFAULT NULL::text,
  p_titulo_universitario_url text DEFAULT NULL::text,
  p_titulo_universitario_nombre text DEFAULT NULL::text,
  p_libreta_url text DEFAULT NULL::text,
  p_libreta_nombre text DEFAULT NULL::text,
  p_portfolio_archivo_url text DEFAULT NULL::text,
  p_portfolio_archivo_nombre text DEFAULT NULL::text
)
RETURNS TABLE(id integer, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id integer;
  v_tipo text;
  v_prefijo text;
BEGIN
  IF p_rubro NOT IN ('diseno', 'instalaciones', 'metalurgica') THEN
    RAISE EXCEPTION 'rubro inválido';
  END IF;
  IF p_nivel NOT IN ('estudiante', 'junior', 'semi_senior', 'titulado', 'experto') THEN
    RAISE EXCEPTION 'nivel inválido';
  END IF;
  IF NULLIF(trim(p_nombre_completo), '') IS NULL OR NULLIF(trim(p_email), '') IS NULL THEN
    RAISE EXCEPTION 'nombre y email son obligatorios';
  END IF;
  IF NULLIF(trim(p_experiencia), '') IS NULL THEN
    RAISE EXCEPTION 'la experiencia es obligatoria';
  END IF;
  IF NULLIF(trim(p_cv_url), '') IS NULL THEN
    RAISE EXCEPTION 'el CV es obligatorio';
  END IF;

  v_tipo := CASE WHEN p_rubro = 'diseno' THEN 'diseno' ELSE 'bolsa' END;

  IF p_nivel IN ('semi_senior', 'titulado', 'experto') AND NULLIF(trim(p_titulo_url), '') IS NULL THEN
    RAISE EXCEPTION 'el título o certificación es obligatorio para este nivel';
  END IF;

  IF p_rubro = 'diseno' THEN
    IF p_nivel = 'estudiante' AND NULLIF(trim(p_libreta_url), '') IS NULL THEN
      RAISE EXCEPTION 'los estudiantes de diseño deben adjuntar la libreta universitaria';
    END IF;
    IF p_nivel IN ('semi_senior', 'titulado', 'experto')
      AND NULLIF(trim(p_titulo_universitario_url), '') IS NULL THEN
      RAISE EXCEPTION 'el título universitario es obligatorio para diseñadores semi-senior, titulados o expertos';
    END IF;
    IF NULLIF(trim(p_portfolio_url), '') IS NULL AND NULLIF(trim(p_portfolio_archivo_url), '') IS NULL THEN
      RAISE EXCEPTION 'el portafolio (archivo o URL) es obligatorio para diseño';
    END IF;
  END IF;

  IF p_nivel IN ('experto', 'titulado') AND NULLIF(trim(p_referencias), '') IS NULL THEN
    RAISE EXCEPTION 'las referencias son obligatorias para nivel titulado o experto';
  END IF;

  IF p_nivel = 'semi_senior' AND p_rubro <> 'diseno' AND NULLIF(trim(p_referencias), '') IS NULL THEN
    RAISE EXCEPTION 'las referencias son obligatorias para semi-senior en instalaciones o metalúrgica';
  END IF;

  INSERT INTO public.work_pool_solicitudes (
    tipo, rubro, nivel, nombre_completo, email, telefono, documento,
    titulo_texto, experiencia, referencias, portfolio_url, mensaje, skills, zona_cobertura,
    cv_url, cv_nombre, titulo_url, titulo_nombre,
    titulo_universitario_url, titulo_universitario_nombre,
    libreta_url, libreta_nombre, portfolio_archivo_url, portfolio_archivo_nombre,
    origen
  ) VALUES (
    v_tipo,
    p_rubro,
    p_nivel,
    trim(p_nombre_completo),
    lower(trim(p_email)),
    NULLIF(trim(p_telefono), ''),
    NULLIF(trim(p_documento), ''),
    NULLIF(trim(p_titulo_texto), ''),
    trim(p_experiencia),
    NULLIF(trim(p_referencias), ''),
    NULLIF(trim(p_portfolio_url), ''),
    NULLIF(trim(p_mensaje), ''),
    COALESCE(p_skills, '{}'),
    NULLIF(trim(p_zona_cobertura), ''),
    NULLIF(trim(p_cv_url), ''),
    NULLIF(trim(p_cv_nombre), ''),
    NULLIF(trim(p_titulo_url), ''),
    NULLIF(trim(p_titulo_nombre), ''),
    NULLIF(trim(p_titulo_universitario_url), ''),
    NULLIF(trim(p_titulo_universitario_nombre), ''),
    NULLIF(trim(p_libreta_url), ''),
    NULLIF(trim(p_libreta_nombre), ''),
    NULLIF(trim(p_portfolio_archivo_url), ''),
    NULLIF(trim(p_portfolio_archivo_nombre), ''),
    'formulario'
  )
  RETURNING work_pool_solicitudes.id INTO v_id;

  v_prefijo := CASE WHEN p_rubro = 'diseno' THEN '[Plot Design]' ELSE '[Bolsa Plot]' END;
  PERFORM public.work_pool_notificar_admins_postulacion(
    v_prefijo || ' Nueva postulación',
    trim(p_nombre_completo) || ' · ' || p_rubro || ' / ' || p_nivel,
    p_rubro,
    v_id
  );

  RETURN QUERY SELECT v_id, 'pendiente'::text;
END;
$$;

-- ─── Dual-write desde CV público ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.crear_postulacion_cv_public(
  p_nombre text,
  p_email text,
  p_telefono text,
  p_puesto text,
  p_categoria_puesto text,
  p_mensaje text,
  p_cv_url text,
  p_cv_nombre text,
  p_cv_mime text,
  p_honeypot text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id bigint;
  v_nombre text;
  v_email text;
  v_puesto text;
  v_cv_url text;
  v_recientes integer;
BEGIN
  IF coalesce(trim(p_honeypot), '') <> '' THEN RETURN 0; END IF;
  v_nombre := trim(p_nombre);
  v_email := lower(trim(p_email));
  v_puesto := trim(p_puesto);
  v_cv_url := trim(p_cv_url);
  IF length(v_nombre) < 2 THEN RAISE EXCEPTION 'Nombre inválido'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Email inválido'; END IF;
  IF length(v_puesto) < 2 THEN RAISE EXCEPTION 'Puesto requerido'; END IF;
  IF v_cv_url = '' OR v_cv_url !~* '^https?://' THEN RAISE EXCEPTION 'URL de CV inválida'; END IF;
  SELECT COUNT(*)::integer INTO v_recientes FROM public.rrhh_postulaciones p
   WHERE lower(p.email) = v_email AND p.created_at > now() - interval '1 hour';
  IF v_recientes >= 5 THEN RAISE EXCEPTION 'Demasiados envíos recientes desde este email. Intentá más tarde.'; END IF;
  INSERT INTO public.rrhh_postulaciones (nombre, email, telefono, puesto, categoria_puesto, mensaje, cv_url, cv_nombre, cv_mime, estado)
  VALUES (v_nombre, v_email, nullif(trim(p_telefono), ''), v_puesto, nullif(trim(p_categoria_puesto), ''), nullif(trim(p_mensaje), ''), v_cv_url, nullif(trim(p_cv_nombre), ''), nullif(trim(p_cv_mime), ''), 'nuevo')
  RETURNING id INTO v_id;

  IF public.rrhh_postulacion_es_diseno(v_puesto, p_categoria_puesto) THEN
    PERFORM public.work_pool_mirror_rrhh_postulacion(v_id, true);
  END IF;

  RETURN v_id;
END;
$$;

-- ─── Dual-write desde formulario externo ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.crear_postulacion_formulario_externo(
  p_nombre text,
  p_email text,
  p_telefono text,
  p_puesto text,
  p_categoria_puesto text,
  p_formulario jsonb,
  p_honeypot text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id bigint;
  v_nombre text;
  v_email text;
  v_puesto text;
  v_frase text;
  v_confirm_puesto text;
  v_recientes integer;
  v_metadata jsonb;
BEGIN
  IF coalesce(trim(p_honeypot), '') <> '' THEN
    RETURN 0;
  END IF;

  v_nombre := trim(p_nombre);
  v_email := lower(trim(p_email));
  v_puesto := trim(p_puesto);
  v_frase := trim(coalesce(p_formulario->>'frase_compromiso', ''));
  v_confirm_puesto := trim(coalesce(p_formulario->>'confirmacion_puesto', ''));

  IF length(v_nombre) < 2 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;
  IF length(v_puesto) < 2 THEN
    RAISE EXCEPTION 'Puesto requerido';
  END IF;
  IF v_frase <> 'Comprendo el compromiso' THEN
    RAISE EXCEPTION 'Debe escribir exactamente: Comprendo el compromiso';
  END IF;
  IF lower(v_confirm_puesto) <> lower(v_puesto) THEN
    RAISE EXCEPTION 'El nombre del puesto no coincide con la convocatoria';
  END IF;

  SELECT COUNT(*)::integer INTO v_recientes
    FROM public.rrhh_postulaciones p
   WHERE lower(p.email) = v_email
     AND p.created_at > now() - interval '1 hour';

  IF v_recientes >= 8 THEN
    RAISE EXCEPTION 'Demasiados envíos recientes desde este email. Intentá más tarde.';
  END IF;

  v_metadata := jsonb_build_object(
    'tipo', 'formulario_externo',
    'slug', coalesce(p_formulario->>'slug', ''),
    'respuestas', coalesce(p_formulario->'respuestas', '{}'::jsonb),
    'enviado_at', now()
  );

  INSERT INTO public.rrhh_postulaciones (
    nombre, email, telefono, puesto, categoria_puesto, mensaje,
    cv_url, cv_nombre, cv_mime, estado, metadata_ia
  ) VALUES (
    v_nombre,
    v_email,
    nullif(trim(p_telefono), ''),
    v_puesto,
    nullif(trim(p_categoria_puesto), ''),
    nullif(trim(coalesce(p_formulario->>'resumen', '')), ''),
    NULL,
    NULL,
    NULL,
    'nuevo',
    v_metadata
  )
  RETURNING id INTO v_id;

  IF public.rrhh_postulacion_es_diseno(v_puesto, p_categoria_puesto) THEN
    PERFORM public.work_pool_mirror_rrhh_postulacion(v_id, true);
  END IF;

  RETURN v_id;
END;
$$;

-- Backfill abiertas de diseño → Afines (sin spam de notificaciones)
INSERT INTO public.work_pool_solicitudes (
  tipo, rubro, nivel, nombre_completo, email, telefono,
  experiencia, mensaje, skills, cv_url, cv_nombre,
  estado, origen, id_rrhh_postulacion, notas_admin
)
SELECT
  'diseno',
  'diseno',
  public.work_pool_nivel_desde_puesto_rrhh(r.puesto),
  trim(r.nombre),
  lower(trim(r.email)),
  NULLIF(trim(r.telefono), ''),
  COALESCE(
    NULLIF(trim(r.mensaje), ''),
    'Postulación vía RRHH · ' || COALESCE(NULLIF(trim(r.puesto), ''), 'Diseño')
  ),
  NULLIF(trim(r.mensaje), ''),
  ARRAY[]::text[],
  NULLIF(trim(r.cv_url), ''),
  NULLIF(trim(r.cv_nombre), ''),
  'pendiente',
  'rrhh',
  r.id,
  'Importado desde RRHH /postulaciones #' || r.id::text
FROM public.rrhh_postulaciones r
WHERE r.estado IN ('nuevo', 'en_revision')
  AND public.rrhh_postulacion_es_diseno(r.puesto, r.categoria_puesto)
  AND NOT EXISTS (
    SELECT 1 FROM public.work_pool_solicitudes s
    WHERE s.id_rrhh_postulacion = r.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.work_pool_solicitudes s
    WHERE s.estado = 'pendiente'
      AND (s.rubro = 'diseno' OR s.tipo = 'diseno')
      AND lower(s.email) = lower(r.email)
  );

COMMIT;
