-- ============================================================
-- Horario fijo por empleado (un único registro estándar).
-- Se usa como referencia de entrada esperada (puntualidad) y
-- jornada esperada (horas extra). Persiste hasta que se cambie.
-- Convención: tipo_horario='fijo' y dia_semana IS NULL.
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_horario_fijo(
  p_id_usuario integer,
  p_hora_entrada time,
  p_hora_salida time,
  p_horas_semanales numeric DEFAULT NULL,
  p_observaciones text DEFAULT NULL
)
RETURNS public.horarios_empleados
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result public.horarios_empleados;
BEGIN
  -- Reemplaza el horario fijo estándar existente del empleado.
  DELETE FROM public.horarios_empleados
  WHERE id_usuario = p_id_usuario
    AND tipo_horario = 'fijo'
    AND dia_semana IS NULL;

  INSERT INTO public.horarios_empleados (
    id_usuario, tipo_horario, dia_semana, hora_entrada, hora_salida,
    horas_semanales, observaciones, activo
  )
  VALUES (
    p_id_usuario, 'fijo', NULL, p_hora_entrada, p_hora_salida,
    p_horas_semanales, p_observaciones, true
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_horario_fijo(integer, time, time, numeric, text)
  TO anon, authenticated, service_role;
