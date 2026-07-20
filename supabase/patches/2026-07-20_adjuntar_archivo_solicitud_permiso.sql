-- Adjuntar certificado/foto a una solicitud de permiso existente
CREATE OR REPLACE FUNCTION public.adjuntar_archivo_solicitud_permiso(
  p_id integer,
  p_id_usuario integer,
  p_archivo_adjunto_url text
)
RETURNS public.solicitudes_permisos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.solicitudes_permisos;
  v_rol text;
BEGIN
  IF p_archivo_adjunto_url IS NULL OR length(trim(p_archivo_adjunto_url)) = 0 THEN
    RAISE EXCEPTION 'URL de adjunto vacía';
  END IF;

  SELECT rol::text INTO v_rol FROM public.usuarios WHERE id = p_id_usuario;

  UPDATE public.solicitudes_permisos s
  SET
    archivo_adjunto_url = trim(p_archivo_adjunto_url),
    updated_at = now()
  WHERE s.id = p_id
    AND (
      s.id_usuario = p_id_usuario
      OR v_rol IN ('recursos-humanos', 'administracion', 'gerencia')
    )
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'No se pudo adjuntar el archivo a la solicitud';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjuntar_archivo_solicitud_permiso(integer, integer, text) TO anon, authenticated, service_role;
