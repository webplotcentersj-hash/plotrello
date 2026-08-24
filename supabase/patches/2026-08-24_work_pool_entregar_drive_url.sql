-- Entrega: link de Google Drive obligatorio (metadata.entrega_drive_url)
CREATE OR REPLACE FUNCTION public.work_pool_entregar_job(
  p_id_job integer,
  p_id_usuario integer,
  p_notas text DEFAULT NULL,
  p_drive_url text DEFAULT NULL
)
RETURNS TABLE (id integer, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asignado integer;
  v_estado text;
  v_drive text;
BEGIN
  SELECT j.estado, j.id_usuario_asignado INTO v_estado, v_asignado
  FROM public.work_pool_jobs j WHERE j.id = p_id_job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trabajo no encontrado'; END IF;
  IF v_estado NOT IN ('en_curso', 'asignado', 'cambios') THEN
    RAISE EXCEPTION 'No se puede entregar en estado %', v_estado;
  END IF;
  IF v_asignado IS NOT NULL AND v_asignado <> p_id_usuario THEN
    RAISE EXCEPTION 'Este trabajo está asignado a otro operario';
  END IF;

  v_drive := nullif(trim(coalesce(p_drive_url, '')), '');
  IF v_drive IS NULL THEN
    RAISE EXCEPTION 'Para entregar necesitás el link de Google Drive con el trabajo';
  END IF;
  IF v_drive !~* '^https?://' THEN
    v_drive := 'https://' || v_drive;
  END IF;
  IF v_drive !~* 'https?://([^/]+\.)?(google\.com|googledrive\.com)/' THEN
    RAISE EXCEPTION 'El link tiene que ser de Google Drive (drive.google.com o docs.google.com)';
  END IF;

  UPDATE public.work_pool_jobs j
  SET estado = 'entregado',
      notas_entrega = nullif(trim(coalesce(p_notas, '')), ''),
      metadata = coalesce(j.metadata, '{}'::jsonb) || jsonb_build_object('entrega_drive_url', v_drive),
      entregado_at = now(),
      updated_at = now()
  WHERE j.id = p_id_job;

  PERFORM public.work_pool_log_event(
    p_id_job,
    'entregado',
    coalesce('Drive: ' || v_drive || coalesce(E'\n' || nullif(trim(coalesce(p_notas, '')), ''), ''), v_drive),
    p_id_usuario
  );

  RETURN QUERY SELECT j.id, j.estado FROM public.work_pool_jobs j WHERE j.id = p_id_job;
END;
$$;

COMMENT ON FUNCTION public.work_pool_entregar_job(integer, integer, text, text) IS
  'Marca job entregado; exige p_drive_url (Google Drive) y lo guarda en metadata.entrega_drive_url.';
