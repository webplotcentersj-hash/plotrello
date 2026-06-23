-- Zona horaria Argentina (Buenos Aires) en registrar_marcacion_tablet

CREATE OR REPLACE FUNCTION public.registrar_marcacion_tablet(
  p_id_usuario integer,
  p_tipo text DEFAULT NULL,
  p_hora timestamptz DEFAULT now(),
  p_foto_url text DEFAULT NULL,
  p_confianza numeric DEFAULT NULL,
  p_detalle text DEFAULT NULL,
  p_dispositivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login text;
  v_nombre text;
  v_apellido text;
  v_fecha date;
  v_tipo text;
  v_entrada timestamptz;
  v_salida timestamptz;
  v_horas numeric(5, 2);
  v_esperada time;
  v_tolerancia integer := 15;
  v_tarde boolean := false;
  v_minutos_tarde integer := 0;
  v_tipo_registro text := 'normal';
  v_obs text;
  v_existe boolean;
BEGIN
  IF p_id_usuario IS NULL THEN
    RAISE EXCEPTION 'id_usuario requerido';
  END IF;

  SELECT u.nombre INTO v_login FROM public.usuarios u WHERE u.id = p_id_usuario;
  IF v_login IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
  IF public.es_usuario_rrhh_generico(v_login) THEN
    RAISE EXCEPTION 'Cuenta no habilitada para marcación';
  END IF;

  SELECT l.nombre, l.apellido
  INTO v_nombre, v_apellido
  FROM public.legajos_empleados l
  WHERE l.id_usuario = p_id_usuario;

  v_fecha := (p_hora AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

  SELECT a.hora_entrada, a.hora_salida
  INTO v_entrada, v_salida
  FROM public.asistencia a
  WHERE a.id_usuario = p_id_usuario AND a.fecha = v_fecha;

  v_tipo := lower(trim(coalesce(p_tipo, '')));
  IF v_tipo NOT IN ('entrada', 'salida') THEN
    IF v_entrada IS NULL THEN
      v_tipo := 'entrada';
    ELSIF v_salida IS NULL THEN
      v_tipo := 'salida';
    ELSE
      v_tipo := 'salida';
    END IF;
  END IF;

  IF v_tipo = 'entrada' AND v_entrada IS NOT NULL THEN
    RAISE EXCEPTION 'Ya registraste entrada hoy (%).', to_char(v_entrada AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI');
  END IF;

  SELECT hf.hora_entrada
  INTO v_esperada
  FROM public.horarios_empleados hf
  WHERE hf.id_usuario = p_id_usuario
    AND hf.tipo_horario = 'fijo'
    AND hf.dia_semana IS NULL
    AND hf.fecha_inicio = date_trunc('month', v_fecha)::date
    AND COALESCE(hf.activo, true)
  ORDER BY hf.id DESC
  LIMIT 1;

  IF v_tipo = 'entrada' THEN
    IF v_esperada IS NOT NULL THEN
      v_minutos_tarde := GREATEST(
        0,
        (
          EXTRACT(EPOCH FROM ((p_hora AT TIME ZONE 'America/Argentina/Buenos_Aires')::time - v_esperada)) / 60
        )::integer - v_tolerancia
      );
      IF v_minutos_tarde > 0 THEN
        v_tarde := true;
        v_tipo_registro := 'tarde';
        v_obs := format('Tardanza %s min (tablet).', v_minutos_tarde);
      END IF;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.asistencia a
      WHERE a.id_usuario = p_id_usuario AND a.fecha = v_fecha
    ) INTO v_existe;

    IF v_existe THEN
      UPDATE public.asistencia
      SET
        hora_entrada = p_hora,
        tipo_registro = v_tipo_registro,
        observaciones = COALESCE(v_obs, observaciones),
        updated_at = now()
      WHERE id_usuario = p_id_usuario AND fecha = v_fecha;
    ELSE
      INSERT INTO public.asistencia (
        id_usuario, fecha, hora_entrada, hora_salida, horas_trabajadas,
        tipo_registro, observaciones, updated_at
      )
      VALUES (
        p_id_usuario, v_fecha, p_hora, NULL, NULL,
        v_tipo_registro, v_obs, now()
      );
    END IF;
  ELSE
    IF v_entrada IS NULL THEN
      RAISE EXCEPTION 'No hay entrada registrada hoy. Marcá entrada primero.';
    END IF;

    v_salida := p_hora;
    v_horas := round(
      (EXTRACT(EPOCH FROM (v_salida - v_entrada)) / 3600.0)::numeric,
      2
    );
    IF v_horas < 0 THEN
      v_horas := 0;
    END IF;

    UPDATE public.asistencia
    SET
      hora_salida = v_salida,
      horas_trabajadas = v_horas,
      updated_at = now()
    WHERE id_usuario = p_id_usuario AND fecha = v_fecha;
  END IF;

  INSERT INTO public.rrhh_reloj_tablet_marcaciones (
    id_usuario, tipo, marcado_at, foto_url,
    verificacion_confianza, verificacion_detalle, dispositivo_id
  )
  VALUES (
    p_id_usuario, v_tipo, p_hora, p_foto_url,
    p_confianza, p_detalle, p_dispositivo
  );

  RETURN jsonb_build_object(
    'id_usuario', p_id_usuario,
    'nombre', trim(coalesce(v_nombre, '') || ' ' || coalesce(v_apellido, '')),
    'login', v_login,
    'tipo', v_tipo,
    'fecha', v_fecha,
    'hora', p_hora,
    'hora_argentina', to_char(p_hora AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI'),
    'tarde', v_tarde,
    'minutos_tarde', v_minutos_tarde,
    'horas_trabajadas', v_horas,
    'mensaje', CASE
      WHEN v_tipo = 'entrada' AND v_tarde THEN format('Entrada registrada · %s min de tardanza', v_minutos_tarde)
      WHEN v_tipo = 'entrada' THEN 'Entrada registrada'
      ELSE format('Salida registrada · %s hs trabajadas', coalesce(v_horas::text, '0'))
    END
  );
END;
$$;
