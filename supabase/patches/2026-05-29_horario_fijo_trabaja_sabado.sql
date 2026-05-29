-- ============================================================
-- Horario fijo: marca si el empleado trabaja sábado.
--   trabaja_sabado = true  -> Lun-Sáb (el sábado cuenta jornada normal, extra solo el excedente)
--   trabaja_sabado = false -> Lun-Vie (todo lo trabajado el sábado es extra)
-- El domingo sigue siendo todo extra (config).
-- ============================================================

ALTER TABLE public.horarios_empleados
  ADD COLUMN IF NOT EXISTS trabaja_sabado boolean DEFAULT true;

DROP FUNCTION IF EXISTS public.upsert_horario_fijo(integer, time, time, numeric, text, date);

CREATE OR REPLACE FUNCTION public.upsert_horario_fijo(
  p_id_usuario integer,
  p_hora_entrada time,
  p_hora_salida time,
  p_horas_semanales numeric DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_mes date DEFAULT NULL,
  p_trabaja_sabado boolean DEFAULT true
)
RETURNS public.horarios_empleados
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result public.horarios_empleados;
  v_mes date := COALESCE(date_trunc('month', p_mes)::date, date_trunc('month', now())::date);
BEGIN
  DELETE FROM public.horarios_empleados
  WHERE id_usuario = p_id_usuario
    AND tipo_horario = 'fijo'
    AND dia_semana IS NULL
    AND fecha_inicio = v_mes;

  INSERT INTO public.horarios_empleados (
    id_usuario, tipo_horario, dia_semana, hora_entrada, hora_salida,
    horas_semanales, observaciones, activo, fecha_inicio, trabaja_sabado
  )
  VALUES (
    p_id_usuario, 'fijo', NULL, p_hora_entrada, p_hora_salida,
    p_horas_semanales, p_observaciones, true, v_mes, COALESCE(p_trabaja_sabado, true)
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_horario_fijo(integer, time, time, numeric, text, date, boolean)
  TO anon, authenticated, service_role;
