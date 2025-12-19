-- Agregar notificaciones automáticas al sistema de revisiones

-- ============================================
-- ACTUALIZAR: Función solicitar_revision_orden con notificaciones
-- ============================================
CREATE OR REPLACE FUNCTION public.solicitar_revision_orden(
  p_id_orden integer,
  p_usuario_revisor_id integer,
  p_usuario_revisor_nombre varchar(100),
  p_comentarios text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id integer;
  v_orden_data record;
  v_usuario_solicitante_id integer;
  v_usuario_solicitante_nombre text;
BEGIN
  -- Obtener datos de la orden (sin restricciones de sector - funciona en todos los sectores)
  SELECT numero_op, cliente, operario_asignado, nombre_creador, sector
  INTO v_orden_data
  FROM public.ordenes_trabajo
  WHERE id = p_id_orden;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada: %', p_id_orden;
  END IF;
  
  -- Obtener usuario que solicita (desde el contexto de la sesión o parámetro)
  -- Por ahora, intentamos obtenerlo del operario o creador de la orden
  IF v_orden_data.operario_asignado IS NOT NULL THEN
    v_usuario_solicitante_id := public.get_user_id_from_nombre(v_orden_data.operario_asignado);
    v_usuario_solicitante_nombre := v_orden_data.operario_asignado;
  ELSIF v_orden_data.nombre_creador IS NOT NULL THEN
    v_usuario_solicitante_id := public.get_user_id_from_nombre(v_orden_data.nombre_creador);
    v_usuario_solicitante_nombre := v_orden_data.nombre_creador;
  END IF;

  -- Crear registro de revisión
  INSERT INTO public.revisiones_orden (
    id_orden,
    usuario_revisor_id,
    usuario_revisor_nombre,
    estado_revision,
    comentarios
  )
  VALUES (
    p_id_orden,
    p_usuario_revisor_id,
    p_usuario_revisor_nombre,
    'en_revision',
    p_comentarios
  )
  RETURNING id INTO v_new_id;

  -- Actualizar estado de revisión en la orden
  UPDATE public.ordenes_trabajo
  SET estado_revision = 'en_revision'
  WHERE id = p_id_orden;

  -- 🔔 NOTIFICAR AL REVISOR
  BEGIN
    INSERT INTO public.user_notifications (
      user_id, title, description, type, orden_id, is_read
    ) VALUES (
      p_usuario_revisor_id,
      '📋 Nueva revisión solicitada',
      format('Se solicitó tu revisión para la orden #%s (%s) del sector %s%s', 
        v_orden_data.numero_op, 
        v_orden_data.cliente,
        COALESCE(v_orden_data.sector, 'Sin sector'),
        CASE WHEN p_comentarios IS NOT NULL AND trim(p_comentarios) != '' 
          THEN format(E'\n\nComentarios: %s', p_comentarios)
          ELSE ''
        END),
      'info',
      p_id_orden,
      false
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creando notificación para revisor: %', SQLERRM;
  END;

  -- 🔔 NOTIFICAR AL OPERARIO/CREADOR (si es diferente del revisor)
  IF v_usuario_solicitante_id IS NOT NULL AND v_usuario_solicitante_id != p_usuario_revisor_id THEN
    BEGIN
      INSERT INTO public.user_notifications (
        user_id, title, description, type, orden_id, is_read
      ) VALUES (
        v_usuario_solicitante_id,
        '✅ Revisión solicitada',
        format('Solicitaste revisión de la orden #%s (%s) a %s', 
          v_orden_data.numero_op, 
          v_orden_data.cliente,
          p_usuario_revisor_nombre),
        'success',
        p_id_orden,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error creando notificación para solicitante: %', SQLERRM;
    END;
  END IF;

  RETURN v_new_id;
END;
$$;

-- ============================================
-- ACTUALIZAR: Función aprobar_revision_orden con notificaciones
-- ============================================
CREATE OR REPLACE FUNCTION public.aprobar_revision_orden(
  p_id_revision integer,
  p_comentarios text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id_orden integer;
  v_revision_data record;
  v_orden_data record;
  v_usuario_notificar_id integer;
BEGIN
  -- Obtener datos de la revisión
  SELECT id_orden, usuario_revisor_id, usuario_revisor_nombre
  INTO v_revision_data
  FROM public.revisiones_orden
  WHERE id = p_id_revision;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revisión no encontrada: %', p_id_revision;
  END IF;
  
  v_id_orden := v_revision_data.id_orden;

  -- Obtener datos de la orden (sin restricciones de sector - funciona en todos los sectores)
  SELECT numero_op, cliente, operario_asignado, nombre_creador, sector
  INTO v_orden_data
  FROM public.ordenes_trabajo
  WHERE id = v_id_orden;

  -- Actualizar revisión
  UPDATE public.revisiones_orden
  SET estado_revision = 'aprobado',
      comentarios = COALESCE(p_comentarios, comentarios),
      fecha_aprobacion = now()
  WHERE id = p_id_revision;

  -- Actualizar estado de revisión en la orden
  UPDATE public.ordenes_trabajo
  SET estado_revision = 'aprobado'
  WHERE id = v_id_orden;

  -- 🔔 NOTIFICAR AL OPERARIO/CREADOR DE LA ORDEN (la otra parte)
  -- Priorizar operario, si no existe, notificar al creador
  IF v_orden_data.operario_asignado IS NOT NULL AND trim(v_orden_data.operario_asignado) != '' THEN
    v_usuario_notificar_id := public.get_user_id_from_nombre(v_orden_data.operario_asignado);
  ELSIF v_orden_data.nombre_creador IS NOT NULL AND trim(v_orden_data.nombre_creador) != '' THEN
    v_usuario_notificar_id := public.get_user_id_from_nombre(v_orden_data.nombre_creador);
  END IF;

  -- Notificar al operario/creador (si existe y es diferente del revisor)
  IF v_usuario_notificar_id IS NOT NULL AND v_usuario_notificar_id != v_revision_data.usuario_revisor_id THEN
    BEGIN
      INSERT INTO public.user_notifications (
        user_id, title, description, type, orden_id, is_read
      ) VALUES (
        v_usuario_notificar_id,
        '✅ Revisión aprobada',
        format('La orden #%s (%s) del sector %s fue aprobada por %s%s', 
          v_orden_data.numero_op, 
          v_orden_data.cliente,
          COALESCE(v_orden_data.sector, 'Sin sector'),
          v_revision_data.usuario_revisor_nombre,
          CASE WHEN p_comentarios IS NOT NULL AND trim(p_comentarios) != '' 
            THEN format(E'\n\nComentarios: %s', p_comentarios)
            ELSE ''
          END),
        'success',
        v_id_orden,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error creando notificación de aprobación: %', SQLERRM;
    END;
  END IF;

  -- 🔔 NOTIFICAR AL REVISOR (confirmación)
  BEGIN
    INSERT INTO public.user_notifications (
      user_id, title, description, type, orden_id, is_read
    ) VALUES (
      v_revision_data.usuario_revisor_id,
      '✅ Revisión aprobada',
      format('Aprobaste la revisión de la orden #%s (%s) del sector %s', 
        v_orden_data.numero_op, 
        v_orden_data.cliente,
        COALESCE(v_orden_data.sector, 'Sin sector')),
      'success',
      v_id_orden,
      false
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creando notificación de confirmación para revisor: %', SQLERRM;
  END;
END;
$$;

-- ============================================
-- ACTUALIZAR: Función rechazar_revision_orden con notificaciones
-- ============================================
CREATE OR REPLACE FUNCTION public.rechazar_revision_orden(
  p_id_revision integer,
  p_comentarios text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id_orden integer;
  v_revision_data record;
  v_orden_data record;
  v_usuario_notificar_id integer;
BEGIN
  IF p_comentarios IS NULL OR trim(p_comentarios) = '' THEN
    RAISE EXCEPTION 'Los comentarios son requeridos al rechazar una revisión';
  END IF;

  -- Obtener datos de la revisión
  SELECT id_orden, usuario_revisor_id, usuario_revisor_nombre
  INTO v_revision_data
  FROM public.revisiones_orden
  WHERE id = p_id_revision;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revisión no encontrada: %', p_id_revision;
  END IF;
  
  v_id_orden := v_revision_data.id_orden;

  -- Obtener datos de la orden (sin restricciones de sector - funciona en todos los sectores)
  SELECT numero_op, cliente, operario_asignado, nombre_creador, sector
  INTO v_orden_data
  FROM public.ordenes_trabajo
  WHERE id = v_id_orden;

  -- Actualizar revisión
  UPDATE public.revisiones_orden
  SET estado_revision = 'requiere_cambios',
      comentarios = p_comentarios
  WHERE id = p_id_revision;

  -- Actualizar estado de revisión en la orden
  UPDATE public.ordenes_trabajo
  SET estado_revision = 'requiere_cambios'
  WHERE id = v_id_orden;

  -- 🔔 NOTIFICAR AL OPERARIO/CREADOR DE LA ORDEN (la otra parte - requiere cambios)
  -- Priorizar operario, si no existe, notificar al creador
  IF v_orden_data.operario_asignado IS NOT NULL AND trim(v_orden_data.operario_asignado) != '' THEN
    v_usuario_notificar_id := public.get_user_id_from_nombre(v_orden_data.operario_asignado);
  ELSIF v_orden_data.nombre_creador IS NOT NULL AND trim(v_orden_data.nombre_creador) != '' THEN
    v_usuario_notificar_id := public.get_user_id_from_nombre(v_orden_data.nombre_creador);
  END IF;

  -- Notificar al operario/creador (si existe y es diferente del revisor)
  IF v_usuario_notificar_id IS NOT NULL AND v_usuario_notificar_id != v_revision_data.usuario_revisor_id THEN
    BEGIN
      INSERT INTO public.user_notifications (
        user_id, title, description, type, orden_id, is_read
      ) VALUES (
        v_usuario_notificar_id,
        '⚠️ Revisión requiere cambios',
        format('La orden #%s (%s) del sector %s requiere cambios según %s\n\nCambios solicitados:\n%s', 
          v_orden_data.numero_op, 
          v_orden_data.cliente,
          COALESCE(v_orden_data.sector, 'Sin sector'),
          v_revision_data.usuario_revisor_nombre,
          p_comentarios),
        'warning',
        v_id_orden,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error creando notificación de rechazo: %', SQLERRM;
    END;
  END IF;

  -- 🔔 NOTIFICAR AL REVISOR (confirmación)
  BEGIN
    INSERT INTO public.user_notifications (
      user_id, title, description, type, orden_id, is_read
    ) VALUES (
      v_revision_data.usuario_revisor_id,
      '⚠️ Revisión rechazada',
      format('Rechazaste la revisión de la orden #%s (%s) del sector %s solicitando cambios', 
        v_orden_data.numero_op, 
        v_orden_data.cliente,
        COALESCE(v_orden_data.sector, 'Sin sector')),
      'warning',
      v_id_orden,
      false
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creando notificación de confirmación para revisor: %', SQLERRM;
  END;
END;
$$;

-- Comentarios actualizados
COMMENT ON FUNCTION public.solicitar_revision_orden IS 'Solicita una revisión para una orden (funciona en todos los sectores) y notifica al revisor y al solicitante';
COMMENT ON FUNCTION public.aprobar_revision_orden IS 'Aprueba una revisión (funciona en todos los sectores) y notifica al operario/creador de la orden y al revisor';
COMMENT ON FUNCTION public.rechazar_revision_orden IS 'Rechaza una revisión solicitando cambios (funciona en todos los sectores) y notifica al operario/creador de la orden y al revisor';

