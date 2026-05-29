-- ============================================================
-- Importación de asistencia desde el reloj biométrico
-- Upsert en lote sobre public.asistencia (UNIQUE id_usuario, fecha).
-- Recibe un arreglo JSON de registros ya calculados desde el front.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_asistencia_reloj(p_registros jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg jsonb;
  v_insertados integer := 0;
  v_actualizados integer := 0;
  v_existe boolean;
  v_id_usuario integer;
  v_fecha date;
BEGIN
  IF p_registros IS NULL OR jsonb_typeof(p_registros) <> 'array' THEN
    RAISE EXCEPTION 'p_registros debe ser un arreglo JSON';
  END IF;

  FOR v_reg IN SELECT * FROM jsonb_array_elements(p_registros)
  LOOP
    v_id_usuario := (v_reg->>'id_usuario')::integer;
    v_fecha := (v_reg->>'fecha')::date;

    IF v_id_usuario IS NULL OR v_fecha IS NULL THEN
      CONTINUE;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.asistencia
      WHERE id_usuario = v_id_usuario AND fecha = v_fecha
    ) INTO v_existe;

    INSERT INTO public.asistencia (
      id_usuario, fecha, hora_entrada, hora_salida,
      horas_trabajadas, tipo_registro, observaciones, updated_at
    )
    VALUES (
      v_id_usuario,
      v_fecha,
      NULLIF(v_reg->>'hora_entrada', '')::timestamptz,
      NULLIF(v_reg->>'hora_salida', '')::timestamptz,
      NULLIF(v_reg->>'horas_trabajadas', '')::numeric,
      COALESCE(NULLIF(v_reg->>'tipo_registro', ''), 'normal'),
      NULLIF(v_reg->>'observaciones', ''),
      now()
    )
    ON CONFLICT (id_usuario, fecha) DO UPDATE SET
      hora_entrada = EXCLUDED.hora_entrada,
      hora_salida = EXCLUDED.hora_salida,
      horas_trabajadas = EXCLUDED.horas_trabajadas,
      tipo_registro = EXCLUDED.tipo_registro,
      observaciones = EXCLUDED.observaciones,
      updated_at = now();

    IF v_existe THEN
      v_actualizados := v_actualizados + 1;
    ELSE
      v_insertados := v_insertados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'insertados', v_insertados,
    'actualizados', v_actualizados,
    'total', v_insertados + v_actualizados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_asistencia_reloj(jsonb) TO anon, authenticated, service_role;
