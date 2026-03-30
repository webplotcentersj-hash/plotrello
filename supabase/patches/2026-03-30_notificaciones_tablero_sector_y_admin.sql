-- Notificaciones del tablero: SOLO quienes están ligados a ESA ficha/OP.
-- Sectores tomados de orden_sectores + sectores.nombre; si la OP no tiene filas aún, se usa ordenes_trabajo.sector.
-- Incluye operario asignado, nombre_creador (resuelto a usuario) e id_usuario_creador.
-- NO se notifica a usuarios de sectores que no forman parte de esa ficha.
-- Cambios de etapa (TG, imprenta, metal, inst): solo usuarios de ese sector si la ficha lo incluye, + operario/creador (no a todos los sectores de la ficha).

BEGIN;

-- ============================================
-- get_users_by_sector (sin admin/gerencia en el roster de sector)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_users_by_sector(sector_nombre text)
RETURNS TABLE (user_id integer, user_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_exists boolean := false;
BEGIN
  IF sector_nombre IS NULL OR trim(sector_nombre) = '' THEN
    RETURN;
  END IF;

  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM information_schema."tables"
      WHERE table_schema = 'public'
        AND table_name = 'usuario_sectores'
    ) INTO table_exists;
  EXCEPTION WHEN OTHERS THEN
    table_exists := false;
  END;

  IF table_exists THEN
    BEGIN
      RETURN QUERY
      EXECUTE format('
        SELECT DISTINCT u.id::integer AS user_id, u.nombre::text AS user_nombre
        FROM public.usuarios u
        INNER JOIN public.usuario_sectores us ON u.id = us.usuario_id
        INNER JOIN public.sectores s ON us.sector_id = s.id
        WHERE s.nombre = %L
          AND u.rol IS NOT NULL
          AND u.rol NOT IN (''administracion'', ''gerencia'')
        ORDER BY u.nombre
      ', sector_nombre);
      RETURN;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error usando usuario_sectores, usando fallback: %', SQLERRM;
      table_exists := false;
    END;
  END IF;

  IF NOT table_exists THEN
    RETURN QUERY
    SELECT
      u.id::integer AS user_id,
      u.nombre::text AS user_nombre
    FROM public.usuarios u
    WHERE u.rol IS NOT NULL
      AND u.rol NOT IN ('administracion', 'gerencia')
      AND (
        (sector_nombre = 'Taller de Imprenta' AND (u.rol = 'imprenta' OR u.rol = 'taller-grafico')) OR
        (sector_nombre = 'Taller Gráfico' AND u.rol = 'taller-grafico') OR
        (sector_nombre = 'Metalúrgica' AND u.rol = 'metalurgica') OR
        (sector_nombre = 'Mostrador' AND u.rol = 'mostrador') OR
        (sector_nombre = 'Caja' AND u.rol = 'caja') OR
        (sector_nombre = 'Diseño Gráfico' AND u.rol = 'diseno') OR
        (sector_nombre = 'Instalaciones' AND u.rol = 'instalaciones') OR
        (sector_nombre = 'Asesor Técnico' AND u.rol = 'asesor-tecnico') OR
        (sector_nombre = 'Presupuestos' AND (u.rol = 'presupuestos' OR u.rol = 'asesor-tecnico'))
      )
    ORDER BY u.nombre;
  END IF;

  RETURN;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error crítico en get_users_by_sector para sector "%": %', sector_nombre, SQLERRM;
  RETURN;
END;
$$;

-- Nombres de sector asignados a la OP (tabla orden_sectores) o, si no hay filas, el sector único de la orden
CREATE OR REPLACE FUNCTION public.ficha_sector_nombres(p_orden_id integer)
RETURNS TABLE (nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sec_tab boolean;
  one text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orden_sectores'
  ) INTO sec_tab;

  IF sec_tab AND EXISTS (SELECT 1 FROM public.orden_sectores os WHERE os.id_orden = p_orden_id) THEN
    RETURN QUERY
    SELECT DISTINCT s.nombre::text
    FROM public.orden_sectores os
    JOIN public.sectores s ON s.id = os.id_sector
    WHERE os.id_orden = p_orden_id;
    RETURN;
  END IF;

  SELECT NULLIF(trim(o.sector), '') INTO one
  FROM public.ordenes_trabajo o
  WHERE o.id = p_orden_id;

  IF one IS NOT NULL THEN
    RETURN QUERY SELECT one::text;
  END IF;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.orden_incluye_sector(p_orden_id integer, p_sector text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  want text := trim(COALESCE(p_sector, ''));
BEGIN
  IF want = '' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.ficha_sector_nombres(p_orden_id) f
    WHERE trim(f.nombre) = want
  );
END;
$$;

-- Destinatarios para eventos generales de la ficha (estado, comentario, nueva OP, asignación a terceros)
CREATE OR REPLACE FUNCTION public.ficha_notification_recipients(
  p_orden_id integer,
  p_operario_nombre text,
  p_creador_nombre text
)
RETURNS TABLE (user_id integer, user_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id::integer, u.nombre::text
  FROM public.usuarios u
  WHERE u.id IN (
    SELECT g.user_id
    FROM public.ficha_sector_nombres(p_orden_id) fn
    CROSS JOIN LATERAL public.get_users_by_sector(fn.nombre) g
    UNION
    SELECT public.get_user_id_from_nombre(NULLIF(trim(p_operario_nombre), ''))
    UNION
    SELECT public.get_user_id_from_nombre(NULLIF(trim(p_creador_nombre), ''))
    UNION
    SELECT o.id_usuario_creador
    FROM public.ordenes_trabajo o
    WHERE o.id = p_orden_id AND o.id_usuario_creador IS NOT NULL
  )
  ORDER BY u.nombre;
END;
$$;

-- Solo el sector donde ocurrió el cambio de etapa (si la ficha lo tiene) + operario/creador
CREATE OR REPLACE FUNCTION public.ficha_etapa_notification_recipients(
  p_orden_id integer,
  p_sector_evento text,
  p_operario_nombre text,
  p_creador_nombre text
)
RETURNS TABLE (user_id integer, user_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.orden_incluye_sector(p_orden_id, p_sector_evento) THEN
    RETURN QUERY
    SELECT u.id::integer, u.nombre::text
    FROM public.usuarios u
    WHERE u.id IN (
      SELECT public.get_user_id_from_nombre(NULLIF(trim(p_operario_nombre), ''))
      UNION
      SELECT public.get_user_id_from_nombre(NULLIF(trim(p_creador_nombre), ''))
      UNION
      SELECT o.id_usuario_creador
      FROM public.ordenes_trabajo o
      WHERE o.id = p_orden_id AND o.id_usuario_creador IS NOT NULL
    )
    ORDER BY u.nombre;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id::integer, u.nombre::text
  FROM public.usuarios u
  WHERE u.id IN (
    SELECT g.user_id
    FROM public.get_users_by_sector(trim(p_sector_evento)) g
    UNION
    SELECT public.get_user_id_from_nombre(NULLIF(trim(p_operario_nombre), ''))
    UNION
    SELECT public.get_user_id_from_nombre(NULLIF(trim(p_creador_nombre), ''))
    UNION
    SELECT o.id_usuario_creador
    FROM public.ordenes_trabajo o
    WHERE o.id = p_orden_id AND o.id_usuario_creador IS NOT NULL
  )
  ORDER BY u.nombre;
END;
$$;

-- Compatibilidad: otros objetos pueden seguir llamando board_order_notification_recipients
CREATE OR REPLACE FUNCTION public.board_notification_recipients(sector_nombre text)
RETURNS TABLE (user_id integer, user_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.get_users_by_sector(NULLIF(trim(sector_nombre), ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.board_order_notification_recipients(
  p_sector text,
  p_operario_nombre text,
  p_creador_nombre text
)
RETURNS TABLE (user_id integer, user_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.get_users_by_sector(NULLIF(trim(p_sector), ''))
  UNION ALL
  SELECT u.id, u.nombre FROM public.usuarios u
  WHERE u.id IN (
    SELECT public.get_user_id_from_nombre(NULLIF(trim(p_operario_nombre), ''))
    UNION
    SELECT public.get_user_id_from_nombre(NULLIF(trim(p_creador_nombre), ''))
  );
END;
$$;

-- ============================================
-- notify_new_orden
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_new_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
BEGIN
  BEGIN
    FOR user_record IN
      SELECT * FROM public.ficha_notification_recipients(NEW.id, NEW.operario_asignado, NEW.nombre_creador)
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, orden_id, is_read
        ) VALUES (
          user_record.user_id,
          '📋 Nueva orden en el tablero',
          format(
            'Se creó la orden #%s (%s).%s',
            NEW.numero_op,
            NEW.cliente,
            CASE WHEN trim(COALESCE(NEW.sector, '')) <> ''
              THEN format(' Sector actual: "%s".', trim(NEW.sector))
              ELSE ''
            END
          ),
          'success',
          NEW.id,
          false
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error notificación nueva OP usuario %: %', user_record.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error crítico notify_new_orden: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- ============================================
-- notify_estado_change
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_estado_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
  notification_desc text;
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    notification_desc := format(
      'La orden #%s (%s) cambió de "%s" a "%s".',
      NEW.numero_op,
      NEW.cliente,
      OLD.estado,
      NEW.estado
    );

    FOR r IN
      SELECT * FROM public.ficha_notification_recipients(NEW.id, NEW.operario_asignado, NEW.nombre_creador)
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (user_id, title, description, type, orden_id, is_read)
        VALUES (r.user_id, 'Estado de orden actualizado', notification_desc, 'info', NEW.id, false);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error notificación estado %: %', r.user_id, SQLERRM;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- notify_operario_assignment
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_operario_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id_destino integer;
  operario_nombre text;
  r record;
BEGIN
  IF NEW.operario_asignado IS NOT NULL
     AND trim(NEW.operario_asignado) <> ''
     AND (OLD.operario_asignado IS NULL OR trim(OLD.operario_asignado) <> trim(NEW.operario_asignado))
  THEN
    operario_nombre := trim(NEW.operario_asignado);
    BEGIN
      user_id_destino := public.get_user_id_from_nombre(operario_nombre);
    EXCEPTION WHEN OTHERS THEN
      user_id_destino := NULL;
    END;

    IF user_id_destino IS NOT NULL THEN
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, orden_id, is_read, "timestamp"
        ) VALUES (
          user_id_destino,
          'Nueva orden asignada',
          format('Te asignaron la orden #%s: %s', NEW.numero_op, COALESCE(NEW.cliente, 'Sin cliente')),
          'success',
          NEW.id,
          false,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error notificación asignación directa %: %', user_id_destino, SQLERRM;
      END;
    END IF;

    FOR r IN
      SELECT * FROM public.ficha_notification_recipients(NEW.id, NEW.operario_asignado, NEW.nombre_creador)
    LOOP
      CONTINUE WHEN r.user_id IS NOT DISTINCT FROM user_id_destino;
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, orden_id, is_read, "timestamp"
        ) VALUES (
          r.user_id,
          'Asignación en una ficha',
          format(
            'La orden #%s (%s) quedó asignada a %s.',
            NEW.numero_op,
            COALESCE(NEW.cliente, 'Sin cliente'),
            operario_nombre
          ),
          'info',
          NEW.id,
          false,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error notificación asignación ficha %: %', r.user_id, SQLERRM;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- notify_new_comment
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  orden_data record;
  r record;
  mention_match text[];
  mentioned_user_id integer;
  author_id integer;
  base_desc text;
BEGIN
  SELECT o.numero_op, o.cliente, o.operario_asignado, o.nombre_creador
  INTO orden_data
  FROM public.ordenes_trabajo o
  WHERE o.id = NEW.id_orden;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  author_id := public.get_user_id_from_nombre(trim(NEW.usuario_nombre));
  base_desc := format(
    '%s comentó en la orden #%s (%s)',
    NEW.usuario_nombre,
    orden_data.numero_op,
    orden_data.cliente
  );

  FOR r IN
    SELECT * FROM public.ficha_notification_recipients(
      NEW.id_orden,
      orden_data.operario_asignado,
      orden_data.nombre_creador
    )
  LOOP
    CONTINUE WHEN r.user_id IS NOT DISTINCT FROM author_id;
    BEGIN
      INSERT INTO public.user_notifications (user_id, title, description, type, orden_id, is_read)
      VALUES (r.user_id, 'Nuevo comentario', base_desc, 'info', NEW.id_orden, false);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error notificación comentario %: %', r.user_id, SQLERRM;
    END;
  END LOOP;

  IF NEW.comentario IS NOT NULL AND NEW.comentario ~ '@' THEN
    FOR mention_match IN
      SELECT regexp_matches(COALESCE(NEW.comentario, ''), '@([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)', 'g')
    LOOP
      mentioned_user_id := public.get_user_id_from_nombre(mention_match[1]);
      CONTINUE WHEN mentioned_user_id IS NULL;
      CONTINUE WHEN mentioned_user_id IS NOT DISTINCT FROM author_id;
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, orden_id, is_read
        ) VALUES (
          mentioned_user_id,
          'Te mencionaron',
          format('%s te mencionó en la orden #%s', NEW.usuario_nombre, orden_data.numero_op),
          'mention',
          NEW.id_orden,
          false
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error notificación mención %: %', mentioned_user_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- Etapas: solo sector del evento si está en la ficha
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_cambio_etapa_taller_grafico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
  operario_nombre text;
  notification_title text := 'Cambio de etapa en Taller Gráfico';
  notification_desc text;
BEGIN
  IF OLD.etapa_taller_grafico IS DISTINCT FROM NEW.etapa_taller_grafico
     AND NEW.etapa_taller_grafico IS NOT NULL THEN
    BEGIN
      operario_nombre := COALESCE(NULLIF(trim(NEW.operario_asignado), ''), NULLIF(trim(NEW.usuario_trabajando_nombre), ''));
    EXCEPTION WHEN undefined_column THEN
      operario_nombre := NULLIF(trim(NEW.usuario_trabajando_nombre), '');
    END;

    notification_desc := format(
      'La orden #%s (%s) cambió de etapa: "%s" → "%s"',
      NEW.numero_op,
      NEW.cliente,
      COALESCE(OLD.etapa_taller_grafico, 'Sin etapa'),
      NEW.etapa_taller_grafico
    );

    FOR r IN
      SELECT * FROM public.ficha_etapa_notification_recipients(
        NEW.id,
        'Taller Gráfico',
        operario_nombre,
        NEW.nombre_creador
      )
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (user_id, title, description, type, orden_id, is_read)
        VALUES (r.user_id, notification_title, notification_desc, 'info', NEW.id, false);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error notif etapa TG %: %', r.user_id, SQLERRM;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_cambio_etapa_taller_imprenta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
  operario_nombre text;
  notification_title text := 'Cambio de etapa en Taller de Imprenta';
  notification_desc text;
BEGIN
  IF OLD.etapa_taller_imprenta IS DISTINCT FROM NEW.etapa_taller_imprenta
     AND NEW.etapa_taller_imprenta IS NOT NULL THEN
    BEGIN
      operario_nombre := COALESCE(NULLIF(trim(NEW.operario_asignado), ''), NULLIF(trim(NEW.usuario_trabajando_nombre), ''));
    EXCEPTION WHEN undefined_column THEN
      operario_nombre := NULLIF(trim(NEW.usuario_trabajando_nombre), '');
    END;

    notification_desc := format(
      'La orden #%s (%s) cambió de etapa: "%s" → "%s"',
      NEW.numero_op,
      NEW.cliente,
      COALESCE(OLD.etapa_taller_imprenta, 'Sin etapa'),
      NEW.etapa_taller_imprenta
    );

    FOR r IN
      SELECT * FROM public.ficha_etapa_notification_recipients(
        NEW.id,
        'Taller de Imprenta',
        operario_nombre,
        NEW.nombre_creador
      )
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (user_id, title, description, type, orden_id, is_read)
        VALUES (r.user_id, notification_title, notification_desc, 'info', NEW.id, false);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error notif etapa imprenta %: %', r.user_id, SQLERRM;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_cambio_etapa_metalurgica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
  operario_nombre text;
  notification_title text := 'Cambio de etapa en Metalúrgica';
  notification_desc text;
BEGIN
  IF OLD.etapa_metalurgica IS DISTINCT FROM NEW.etapa_metalurgica
     AND NEW.etapa_metalurgica IS NOT NULL THEN
    BEGIN
      operario_nombre := COALESCE(NULLIF(trim(NEW.operario_asignado), ''), NULLIF(trim(NEW.usuario_trabajando_nombre), ''));
    EXCEPTION WHEN undefined_column THEN
      operario_nombre := NULLIF(trim(NEW.usuario_trabajando_nombre), '');
    END;

    notification_desc := format(
      'La orden #%s (%s) cambió de etapa: "%s" → "%s"',
      NEW.numero_op,
      NEW.cliente,
      COALESCE(OLD.etapa_metalurgica, 'Sin etapa'),
      NEW.etapa_metalurgica
    );

    FOR r IN
      SELECT * FROM public.ficha_etapa_notification_recipients(
        NEW.id,
        'Metalúrgica',
        operario_nombre,
        NEW.nombre_creador
      )
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (user_id, title, description, type, orden_id, is_read)
        VALUES (r.user_id, notification_title, notification_desc, 'info', NEW.id, false);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error notif etapa metal %: %', r.user_id, SQLERRM;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_cambio_etapa_instalaciones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
  operario_nombre text;
  notification_title text := 'Cambio de etapa en Instalaciones';
  notification_desc text;
BEGIN
  IF OLD.etapa_instalaciones IS DISTINCT FROM NEW.etapa_instalaciones
     AND NEW.etapa_instalaciones IS NOT NULL THEN
    BEGIN
      operario_nombre := COALESCE(NULLIF(trim(NEW.operario_asignado), ''), NULLIF(trim(NEW.usuario_trabajando_nombre), ''));
    EXCEPTION WHEN undefined_column THEN
      operario_nombre := NULLIF(trim(NEW.usuario_trabajando_nombre), '');
    END;

    notification_desc := format(
      'La orden #%s (%s) cambió de etapa: "%s" → "%s"',
      NEW.numero_op,
      NEW.cliente,
      COALESCE(OLD.etapa_instalaciones, 'Sin etapa'),
      NEW.etapa_instalaciones
    );

    FOR r IN
      SELECT * FROM public.ficha_etapa_notification_recipients(
        NEW.id,
        'Instalaciones',
        operario_nombre,
        NEW.nombre_creador
      )
    LOOP
      BEGIN
        INSERT INTO public.user_notifications (user_id, title, description, type, orden_id, is_read)
        VALUES (r.user_id, notification_title, notification_desc, 'info', NEW.id, false);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error notif etapa inst %: %', r.user_id, SQLERRM;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
