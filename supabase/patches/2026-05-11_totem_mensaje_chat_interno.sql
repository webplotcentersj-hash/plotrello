-- Tótem / mostrador: mensaje visible en el canal de chat interno correcto + chat_canal en la notificación
-- Requiere usuario id=1 (Totem autoservicio) y rooms de chat 1–7 alineados con la app.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'chat_canal'
  ) THEN
    ALTER TABLE public.user_notifications
    ADD COLUMN chat_canal text NULL;
    COMMENT ON COLUMN public.user_notifications.chat_canal IS 'Canal del chat interno (/chat?canal=) donde se publicó el aviso (tótem / mostrador).';
  END IF;
END$$;

-- Varias migraciones definieron firmas distintas (7 vs 9 args); hay que borrar todas antes de recrear.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
      n.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS drop_stmt
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'crear_atencion_mostrador'
  LOOP
    EXECUTE r.drop_stmt;
  END LOOP;
END$$;

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
  v_key text;
  v_room_id integer;
  v_chat_canal text;
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

  v_key := btrim(coalesce(p_sector_destino, ''));

  -- room_id alineado con src/services/api.ts chatChannelToRoom y ChatPage
  v_room_id := CASE v_key
    WHEN 'Diseño' THEN 2
    WHEN 'Diseño gráfico' THEN 2
    WHEN 'Presupuestos y asesoramiento' THEN 5
    WHEN 'Recepción de pedidos' THEN 5
    WHEN 'Caja / Entrega de pedidos' THEN 5
    WHEN 'Marketing y comunicación' THEN 5
    WHEN 'Base de operaciones' THEN 6
    WHEN 'Mostrador' THEN 5
    WHEN 'Caja' THEN 5
    WHEN 'Instalaciones' THEN 5
    ELSE
      CASE lower(v_key)
        WHEN 'mostrador' THEN 5
        WHEN 'diseno' THEN 2
        WHEN 'diseño' THEN 2
        WHEN 'caja' THEN 5
        WHEN 'instalaciones' THEN 5
        ELSE 5
      END
  END;

  v_chat_canal := CASE v_room_id
    WHEN 1 THEN 'general'
    WHEN 2 THEN 'diseno'
    WHEN 3 THEN 'recursos-humanos'
    WHEN 4 THEN 'metalurgica'
    WHEN 5 THEN 'mostrador'
    WHEN 6 THEN 'taller-grafico'
    WHEN 7 THEN 'random'
    ELSE 'mostrador'
  END;

  -- Rol en tabla usuarios para filtrar destinatarios (incluye textos del tótem)
  v_rol_sector := CASE v_key
    WHEN 'Diseño' THEN 'diseno'
    WHEN 'Diseño gráfico' THEN 'diseno'
    WHEN 'Presupuestos y asesoramiento' THEN 'mostrador'
    WHEN 'Recepción de pedidos' THEN 'mostrador'
    WHEN 'Caja / Entrega de pedidos' THEN 'caja'
    WHEN 'Marketing y comunicación' THEN 'mostrador'
    WHEN 'Base de operaciones' THEN 'taller-grafico'
    WHEN 'Mostrador' THEN 'mostrador'
    WHEN 'Caja' THEN 'caja'
    WHEN 'Instalaciones' THEN 'instalaciones'
    ELSE
      CASE lower(v_key)
        WHEN 'mostrador' THEN 'mostrador'
        WHEN 'diseno' THEN 'diseno'
        WHEN 'diseño' THEN 'diseno'
        WHEN 'caja' THEN 'caja'
        WHEN 'instalaciones' THEN 'instalaciones'
        ELSE NULL
      END
  END;

  -- Un solo mensaje en el canal que corresponde al sector elegido
  INSERT INTO public.chat_messages (
    room_id,
    id_usuario,
    nombre_usuario,
    mensaje,
    reply_to_id,
    estado_entrega,
    reacciones
  ) VALUES (
    v_room_id,
    1,
    'Tótem',
    v_titulo || E'\n\n' || v_descripcion,
    NULL,
    'sent',
    '{}'::jsonb
  );

  IF v_rol_sector IS NOT NULL THEN
    FOR v_user IN
      SELECT id FROM public.usuarios WHERE rol = v_rol_sector
    LOOP
      INSERT INTO public.user_notifications (
        user_id,
        title,
        description,
        type,
        is_read,
        orden_id,
        chat_canal
      ) VALUES (
        v_user.id,
        v_titulo,
        v_descripcion,
        'mention',
        false,
        p_orden_id,
        v_chat_canal
      );
    END LOOP;
  ELSE
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
        orden_id,
        chat_canal
      ) VALUES (
        v_user.id,
        v_titulo,
        v_descripcion,
        'mention',
        false,
        p_orden_id,
        v_chat_canal
      );
    END LOOP;
  END IF;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.crear_atencion_mostrador IS 'Crea atención de mostrador; publica mensaje en chat interno (room por sector); notifica con chat_canal; p_orden_numero_op es el número visible de OP.';
