-- Mejoras reloj tablet: estado del día en empleados, bloqueo salida duplicada, revocar anon en RPCs

DROP FUNCTION IF EXISTS public.listar_empleados_reloj_tablet();

CREATE OR REPLACE FUNCTION public.listar_empleados_reloj_tablet()
RETURNS TABLE (
  id_usuario integer,
  nombre text,
  apellido text,
  sector text,
  foto_url text,
  login text,
  entrada_hoy text,
  salida_hoy text,
  tiene_foto_legajo boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS id_usuario,
    COALESCE(NULLIF(trim(l.nombre), ''), '') AS nombre,
    COALESCE(NULLIF(trim(l.apellido), ''), '') AS apellido,
    COALESCE(NULLIF(trim(l.sector), ''), '') AS sector,
    l.foto_url,
    u.nombre AS login,
    CASE
      WHEN a.hora_entrada IS NOT NULL THEN to_char(a.hora_entrada AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI')
      ELSE NULL
    END AS entrada_hoy,
    CASE
      WHEN a.hora_salida IS NOT NULL THEN to_char(a.hora_salida AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI')
      ELSE NULL
    END AS salida_hoy,
    COALESCE(NULLIF(trim(l.foto_url), ''), '') <> '' AS tiene_foto_legajo
  FROM public.usuarios u
  INNER JOIN public.legajos_empleados l ON l.id_usuario = u.id
  LEFT JOIN public.asistencia a
    ON a.id_usuario = u.id
    AND a.fecha = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  WHERE COALESCE(u.activo, true)
    AND NOT public.es_usuario_rrhh_generico(u.nombre)
  ORDER BY l.apellido, l.nombre, u.nombre;
$$;

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
  v_hora_argentina text;
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
  v_hora_argentina := to_char(p_hora AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI');

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
      RAISE EXCEPTION 'Ya completaste entrada y salida hoy (% / %).',
        to_char(v_entrada AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI'),
        to_char(v_salida AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI');
    END IF;
  END IF;

  IF v_tipo = 'entrada' AND v_entrada IS NOT NULL THEN
    RAISE EXCEPTION 'Ya registraste entrada hoy (%).', to_char(v_entrada AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI');
  END IF;

  IF v_tipo = 'salida' AND v_salida IS NOT NULL THEN
    RAISE EXCEPTION 'Ya registraste salida hoy (%).', to_char(v_salida AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI');
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
    'hora_argentina', v_hora_argentina,
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

REVOKE EXECUTE ON FUNCTION public.listar_empleados_reloj_tablet() FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_marcacion_tablet(integer, text, timestamptz, text, numeric, text, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.listar_empleados_reloj_tablet() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_marcacion_tablet(integer, text, timestamptz, text, numeric, text, text) TO authenticated, service_role;

-- Listado de auditoría para RRHH (solo service_role vía API staff)
CREATE OR REPLACE FUNCTION public.listar_marcaciones_tablet_rango(
  p_desde date,
  p_hasta date
)
RETURNS TABLE (
  id bigint,
  id_usuario integer,
  empleado text,
  sector text,
  tipo text,
  marcado_at timestamptz,
  hora_argentina text,
  verificacion_confianza numeric,
  verificacion_detalle text,
  dispositivo_id text,
  foto_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.id_usuario,
    trim(coalesce(l.apellido, '') || ', ' || coalesce(l.nombre, '')) AS empleado,
    coalesce(l.sector, '') AS sector,
    m.tipo,
    m.marcado_at,
    to_char(m.marcado_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI') AS hora_argentina,
    m.verificacion_confianza,
    m.verificacion_detalle,
    m.dispositivo_id,
    m.foto_url
  FROM public.rrhh_reloj_tablet_marcaciones m
  LEFT JOIN public.legajos_empleados l ON l.id_usuario = m.id_usuario
  WHERE (m.marcado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN p_desde AND p_hasta
  ORDER BY m.marcado_at DESC;
$$;

REVOKE ALL ON FUNCTION public.listar_marcaciones_tablet_rango(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_marcaciones_tablet_rango(date, date) TO service_role;
