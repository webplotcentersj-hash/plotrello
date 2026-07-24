-- Horario de sábado personalizado por empleado (default 09:00–14:00 si null).
-- Caso conocido: Claudia Gutierrez → 06:30–13:00.

ALTER TABLE public.horarios_empleados
  ADD COLUMN IF NOT EXISTS sabado_entrada time,
  ADD COLUMN IF NOT EXISTS sabado_salida time;

COMMENT ON COLUMN public.horarios_empleados.sabado_entrada IS
  'Entrada sábado personalizada; null = 09:00 (estándar empresa).';
COMMENT ON COLUMN public.horarios_empleados.sabado_salida IS
  'Salida sábado personalizada; null = 14:00 (estándar empresa).';

DROP FUNCTION IF EXISTS public.upsert_horario_fijo(integer, time, time, numeric, text, date, boolean);

CREATE OR REPLACE FUNCTION public.upsert_horario_fijo(
  p_id_usuario integer,
  p_hora_entrada time,
  p_hora_salida time,
  p_horas_semanales numeric DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_mes date DEFAULT NULL,
  p_trabaja_sabado boolean DEFAULT true,
  p_sabado_entrada time DEFAULT NULL,
  p_sabado_salida time DEFAULT NULL
)
RETURNS public.horarios_empleados
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.horarios_empleados;
  v_mes date := COALESCE(date_trunc('month', p_mes)::date, date_trunc('month', now())::date);
  v_prev_sab_e time;
  v_prev_sab_s time;
BEGIN
  SELECT h.sabado_entrada, h.sabado_salida
    INTO v_prev_sab_e, v_prev_sab_s
  FROM public.horarios_empleados h
  WHERE h.id_usuario = p_id_usuario
    AND h.tipo_horario = 'fijo'
    AND h.dia_semana IS NULL
    AND COALESCE(h.activo, true)
  ORDER BY h.fecha_inicio DESC NULLS LAST
  LIMIT 1;

  DELETE FROM public.horarios_empleados
  WHERE id_usuario = p_id_usuario
    AND tipo_horario = 'fijo'
    AND dia_semana IS NULL
    AND fecha_inicio = v_mes;

  INSERT INTO public.horarios_empleados (
    id_usuario, tipo_horario, dia_semana, hora_entrada, hora_salida,
    horas_semanales, observaciones, activo, fecha_inicio, trabaja_sabado,
    sabado_entrada, sabado_salida
  )
  VALUES (
    p_id_usuario, 'fijo', NULL, p_hora_entrada, p_hora_salida,
    p_horas_semanales, p_observaciones, true, v_mes, COALESCE(p_trabaja_sabado, true),
    COALESCE(p_sabado_entrada, v_prev_sab_e),
    COALESCE(p_sabado_salida, v_prev_sab_s)
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_horario_fijo(integer, time, time, numeric, text, date, boolean, time, time)
  TO anon, authenticated, service_role;

UPDATE public.horarios_empleados
SET sabado_entrada = '06:30'::time,
    sabado_salida = '13:00'::time
WHERE id_usuario = 63
  AND tipo_horario = 'fijo'
  AND dia_semana IS NULL
  AND COALESCE(activo, true);
