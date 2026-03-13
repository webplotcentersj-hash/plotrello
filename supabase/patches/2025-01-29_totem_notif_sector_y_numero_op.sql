-- Notificaciones del tótem: solo al sector elegido y con número de OP real (no id interno)
CREATE OR REPLACE FUNCTION public.crear_atencion_mostrador(
  p_cliente_nombre varchar(255),
  p_tipo text,
  p_usuario_id integer,
  p_usuario_nombre varchar(100),
  p_orden_id integer DEFAULT NULL,
  p_cliente_id integer DEFAULT NULL,
  p_notas text DEFAULT NULL,
  p_sector_destino text DEFAULT NULL,
  p_orden_numero_op text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id integer;
  v_titulo text;
  v_descripcion text;
  v_user record;
  v_rol_sector text;
BEGIN
  IF p_tipo NOT IN ('virtual', 'consulta', 'venta') THEN
    RAISE EXCEPTION 'Tipo de atención inválido: %. Debe ser virtual, consulta o venta', p_tipo;
  END IF;

  INSERT INTO public.atenciones_mostrador (
    cliente_nombre,
    tipo,
    usuario_id,
    usuario_nombre,
    orden_id,
    cliente_id,
    notas,
    fecha_atencion
  )
  VALUES (
    p_cliente_nombre,
    p_tipo,
    p_usuario_id,
    p_usuario_nombre,
    p_orden_id,
    p_cliente_id,
    p_notas,
    now()
  )
  RETURNING id INTO v_new_id;

  v_titulo := 'Cliente en tótem esperando atención';
  -- Solo incluir número de OP si nos lo pasan (nunca el id interno)
  v_descripcion := coalesce(p_cliente_nombre, 'Cliente') || ' se registró desde el tótem';
  IF p_orden_numero_op IS NOT NULL AND trim(p_orden_numero_op) <> '' THEN
    v_descripcion := v_descripcion || ' por la OP ' || trim(p_orden_numero_op);
  ELSIF p_orden_id IS NOT NULL THEN
    v_descripcion := v_descripcion || ' (orden interna)';
  END IF;
  IF p_notas IS NOT NULL AND trim(p_notas) <> '' THEN
    v_descripcion := v_descripcion || E'.\n\n' || p_notas;
  ELSE
    v_descripcion := v_descripcion || '.';
  END IF;

  -- Mapear sector (chips al buscar trabajo) al rol en BD: solo Mostrador, Diseño, Instalaciones, Caja
  v_rol_sector := CASE lower(trim(coalesce(p_sector_destino, '')))
    WHEN 'mostrador' THEN 'mostrador'
    WHEN 'diseño' THEN 'diseno'
    WHEN 'diseno' THEN 'diseno'
    WHEN 'instalaciones' THEN 'instalaciones'
    WHEN 'caja' THEN 'caja'
    ELSE NULL
  END;

  IF v_rol_sector IS NOT NULL THEN
    -- Notificar solo a usuarios del sector elegido
    FOR v_user IN
      SELECT id FROM public.usuarios WHERE rol = v_rol_sector
    LOOP
      INSERT INTO public.user_notifications (
        user_id,
        title,
        description,
        type,
        is_read,
        orden_id
      ) VALUES (
        v_user.id,
        v_titulo,
        v_descripcion,
        'mention',
        false,
        p_orden_id
      );
    END LOOP;
  ELSE
    -- Sin sector (llamada desde app): notificar a mostrador, caja y administración
    FOR v_user IN
      SELECT id FROM public.usuarios
      WHERE rol IN ('mostrador', 'caja', 'administracion')
    LOOP
      INSERT INTO public.user_notifications (
        user_id,
        title,
        description,
        type,
        is_read,
        orden_id
      ) VALUES (
        v_user.id,
        v_titulo,
        v_descripcion,
        'mention',
        false,
        p_orden_id
      );
    END LOOP;
  END IF;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.crear_atencion_mostrador IS 'Crea atención de mostrador; si p_sector_destino viene del tótem, notifica solo a ese sector; p_orden_numero_op es el número visible de OP (nunca el id interno).';
