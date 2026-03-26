-- Protocolos y bases: escritura vía RPC (login por RPC sin Supabase Auth JWT).
-- El cliente usa solo la anon key; auth.uid() no mapea a public.usuarios.id.
-- Las políticas con auth.uid()::text::integer fallan o no aplican → violación RLS al INSERT.
--
-- Solución: RPC SECURITY DEFINER que valida p_usuario_id contra public.usuarios (roles permitidos)
-- y escribe/elimina filas. Se revoca el INSERT/UPDATE/DELETE directo en tabla para roles comunes.

BEGIN;

-- Quitar política de escritura directa (solo pasará por RPC)
DROP POLICY IF EXISTS "protocolos_bases_write_hr_admin" ON public.protocolos_bases;

CREATE OR REPLACE FUNCTION public.crear_protocolo_base(
  p_usuario_id integer,
  p_titulo text,
  p_categoria text,
  p_tipo text,
  p_tags text[],
  p_archivo_url text,
  p_archivo_nombre text,
  p_file_mime text,
  p_contenido_texto text
)
RETURNS public.protocolos_bases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.protocolos_bases;
  v_nombre text;
BEGIN
  IF p_usuario_id IS NULL OR p_titulo IS NULL OR trim(p_titulo) = '' THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('recursos-humanos', 'administracion', 'gerencia')
  ) THEN
    RAISE EXCEPTION 'No autorizado para cargar protocolos o bases';
  END IF;

  SELECT u.nombre INTO v_nombre FROM public.usuarios u WHERE u.id = p_usuario_id;

  INSERT INTO public.protocolos_bases (
    titulo,
    categoria,
    tipo,
    tags,
    archivo_url,
    archivo_nombre,
    file_mime,
    contenido_texto,
    creado_por,
    creado_por_nombre
  )
  VALUES (
    trim(p_titulo),
    NULLIF(trim(COALESCE(p_categoria, '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_tipo, '')), ''), 'protocolo'),
    COALESCE(p_tags, '{}'::text[]),
    p_archivo_url,
    p_archivo_nombre,
    p_file_mime,
    p_contenido_texto,
    p_usuario_id,
    v_nombre
  )
  RETURNING * INTO r;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.eliminar_protocolo_base(
  p_id uuid,
  p_usuario_id integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id IS NULL OR p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('recursos-humanos', 'administracion', 'gerencia')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.protocolos_bases WHERE id = p_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_protocolo_base(
  integer, text, text, text, text[], text, text, text, text
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.eliminar_protocolo_base(uuid, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.crear_protocolo_base IS
  'Alta de protocolo/base: valida usuarios.id y rol RRHH/admin/gerencia (app sin JWT Supabase Auth).';

COMMIT;
