-- ============================================================
-- Horario fijo por MES: se guarda un horario fijo por empleado y por mes,
-- usando fecha_inicio = primer día del mes como clave de período.
-- El reloj usa el horario del mes que se importa. Persiste hasta cambiarse.
-- ============================================================

-- Migrar horarios fijos existentes (sin mes) al mes actual.
UPDATE public.horarios_empleados
SET fecha_inicio = date_trunc('month', now())::date
WHERE tipo_horario = 'fijo' AND dia_semana IS NULL AND fecha_inicio IS NULL;

-- Reemplazar la función previa (firma sin mes).
DROP FUNCTION IF EXISTS public.upsert_horario_fijo(integer, time, time, numeric, text);

CREATE OR REPLACE FUNCTION public.upsert_horario_fijo(
  p_id_usuario integer,
  p_hora_entrada time,
  p_hora_salida time,
  p_horas_semanales numeric DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_mes date DEFAULT NULL
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
    horas_semanales, observaciones, activo, fecha_inicio
  )
  VALUES (
    p_id_usuario, 'fijo', NULL, p_hora_entrada, p_hora_salida,
    p_horas_semanales, p_observaciones, true, v_mes
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_horario_fijo(integer, time, time, numeric, text, date)
  TO anon, authenticated, service_role;

-- Eliminar el horario fijo de un empleado para un mes.
CREATE OR REPLACE FUNCTION public.eliminar_horario_fijo(
  p_id_usuario integer,
  p_mes date DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mes date := COALESCE(date_trunc('month', p_mes)::date, date_trunc('month', now())::date);
BEGIN
  DELETE FROM public.horarios_empleados
  WHERE id_usuario = p_id_usuario
    AND tipo_horario = 'fijo'
    AND dia_semana IS NULL
    AND fecha_inicio = v_mes;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_horario_fijo(integer, date)
  TO anon, authenticated, service_role;
