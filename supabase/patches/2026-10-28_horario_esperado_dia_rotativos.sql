-- Hora de entrada esperada del día: override (turnos) → rotativo → horario fijo (c/ sábado).
-- Usada por tablet reloj (registrar_marcacion_tablet) y auditoría.

BEGIN;

CREATE OR REPLACE FUNCTION public.obtener_hora_entrada_fijo_vigente(
  p_id_usuario integer,
  p_fecha date
)
RETURNS time without time zone
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dow integer;
  v_entrada time;
  v_ciclo integer;
  v_ancla date;
  v_fase integer;
  v_id_rotacion integer;
  v_idx integer;
  v_franco boolean;
  v_slot_entrada time;
  v_trabaja_sab boolean;
  v_sab_entrada time;
  v_modo_sab text;
  v_semana_iso integer;
BEGIN
  IF p_id_usuario IS NULL OR p_fecha IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1) Ajuste / intercambio del día
  SELECT t.hora_entrada
  INTO v_entrada
  FROM public.turnos t
  WHERE t.id_usuario = p_id_usuario
    AND t.fecha = p_fecha
    AND t.hora_entrada IS NOT NULL
  ORDER BY t.id DESC
  LIMIT 1;

  IF v_entrada IS NOT NULL THEN
    RETURN v_entrada;
  END IF;

  -- 2) Turno rotativo activo ese día
  SELECT
    r.id,
    r.ciclo_dias,
    r.fecha_ancla,
    a.fase_offset
  INTO v_id_rotacion, v_ciclo, v_ancla, v_fase
  FROM public.rrhh_turnos_rotacion_asignados a
  JOIN public.rrhh_turnos_rotacion r ON r.id = a.id_rotacion
  WHERE a.id_usuario = p_id_usuario
    AND a.activo = true
    AND r.activo = true
    AND a.fecha_desde <= p_fecha
    AND (a.fecha_hasta IS NULL OR a.fecha_hasta >= p_fecha)
  ORDER BY a.fecha_desde DESC, a.id DESC
  LIMIT 1;

  IF v_id_rotacion IS NOT NULL AND v_ciclo IS NOT NULL AND v_ancla IS NOT NULL THEN
    v_idx := ((p_fecha - v_ancla) + COALESCE(v_fase, 0)) % v_ciclo;
    IF v_idx < 0 THEN
      v_idx := v_idx + v_ciclo;
    END IF;

    SELECT s.es_franco, s.hora_entrada
    INTO v_franco, v_slot_entrada
    FROM public.rrhh_turnos_rotacion_slots s
    WHERE s.id_rotacion = v_id_rotacion
      AND s.dia_offset = v_idx
    LIMIT 1;

    IF COALESCE(v_franco, false) THEN
      RETURN NULL;
    END IF;
    IF v_slot_entrada IS NOT NULL THEN
      RETURN v_slot_entrada;
    END IF;
    RETURN NULL;
  END IF;

  -- 3) Horario fijo (Horarios reloj)
  v_dow := EXTRACT(DOW FROM p_fecha)::integer;

  IF v_dow = 0 THEN
    RETURN NULL;
  END IF;

  SELECT
    hf.hora_entrada,
    COALESCE(hf.trabaja_sabado, true),
    hf.sabado_entrada
  INTO v_entrada, v_trabaja_sab, v_sab_entrada
  FROM public.horarios_empleados hf
  WHERE hf.id_usuario = p_id_usuario
    AND hf.tipo_horario = 'fijo'
    AND hf.dia_semana IS NULL
    AND COALESCE(hf.activo, true)
    AND hf.fecha_inicio <= date_trunc('month', p_fecha)::date
  ORDER BY hf.fecha_inicio DESC, hf.id DESC
  LIMIT 1;

  IF v_entrada IS NULL AND v_sab_entrada IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_dow = 6 THEN
    IF NOT COALESCE(v_trabaja_sab, true) THEN
      RETURN NULL;
    END IF;
    SELECT s.modo INTO v_modo_sab
    FROM public.rrhh_sabado_medio s
    WHERE s.id_usuario = p_id_usuario;
    v_modo_sab := COALESCE(v_modo_sab, 'todos');
    IF v_modo_sab IN ('par', 'impar') THEN
      v_semana_iso := EXTRACT(WEEK FROM p_fecha)::integer;
      IF v_modo_sab = 'par' AND (v_semana_iso % 2) <> 0 THEN
        RETURN NULL;
      END IF;
      IF v_modo_sab = 'impar' AND (v_semana_iso % 2) = 0 THEN
        RETURN NULL;
      END IF;
    END IF;
    RETURN COALESCE(v_sab_entrada, TIME '09:00');
  END IF;

  RETURN v_entrada;
END;
$function$;

COMMENT ON FUNCTION public.obtener_hora_entrada_fijo_vigente(integer, date) IS
  'Entrada esperada del día: turnos (override) → rotativo → horario fijo (sábado c/ sabado_medio).';

GRANT EXECUTE ON FUNCTION public.obtener_hora_entrada_fijo_vigente(integer, date)
  TO anon, authenticated, service_role;

COMMIT;
