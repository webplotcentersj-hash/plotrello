-- Permite eliminar una prueba aunque tenga asignaciones: CASCADE borra
-- pruebas_asignaciones, pruebas_respuestas (via asignaciones) y pruebas_preguntas.
-- Aplica despues de 2026-03-28_pruebas_vf_editar_eliminar_obtener.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.rrhh_prueba_eliminar(p_usuario_id integer, p_id_prueba uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._rrhh_es_gestor_pruebas(p_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_id_prueba IS NULL THEN
    RAISE EXCEPTION 'Prueba requerida';
  END IF;

  DELETE FROM public.pruebas_conocimiento WHERE id = p_id_prueba;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prueba no encontrada';
  END IF;
  RETURN true;
END;
$$;

COMMIT;
