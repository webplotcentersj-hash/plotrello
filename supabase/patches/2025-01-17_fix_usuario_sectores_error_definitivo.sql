-- Fix definitivo para el error "relation usuario_sectores does not exist"
-- Este parche asegura que get_users_by_sector y notify_new_orden nunca fallen
-- incluso si la tabla usuario_sectores no existe

BEGIN;

-- ============================================
-- FUNCIÓN: get_users_by_sector (versión ultra-robusta)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_users_by_sector(sector_nombre text)
RETURNS TABLE (user_id integer, user_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_exists boolean := false;
BEGIN
  -- Intentar verificar si la tabla existe (con manejo de errores)
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'usuario_sectores'
    ) INTO table_exists;
  EXCEPTION WHEN OTHERS THEN
    -- Si falla la verificación, asumir que no existe
    table_exists := false;
  END;
  
  -- Si la tabla existe, intentar usarla con SQL dinámico
  IF table_exists THEN
    BEGIN
      -- Usar SQL dinámico para evitar errores de compilación
      RETURN QUERY
      EXECUTE format('
        SELECT DISTINCT u.id::integer AS user_id, u.nombre::text AS user_nombre
        FROM public.usuarios u
        INNER JOIN public.usuario_sectores us ON u.id = us.usuario_id
        INNER JOIN public.sectores s ON us.sector_id = s.id
        WHERE s.nombre = %L
        ORDER BY u.nombre
      ', sector_nombre);
    EXCEPTION WHEN OTHERS THEN
      -- Si hay error, usar fallback (no retornar nada aquí, se maneja abajo)
      RAISE WARNING 'Error usando usuario_sectores, usando fallback: %', SQLERRM;
      table_exists := false;
    END;
  END IF;
  
  -- Fallback: mapeo de sectores a roles (si la tabla no existe o hubo error)
  IF NOT table_exists THEN
    RETURN QUERY
    SELECT 
      u.id::integer AS user_id, 
      u.nombre::text AS user_nombre
    FROM public.usuarios u
    WHERE 
      -- Mapeo de sectores a roles
      (
        (sector_nombre = 'Taller de Imprenta' AND (u.rol = 'imprenta' OR u.rol = 'taller-grafico')) OR
        (sector_nombre = 'Taller Gráfico' AND u.rol = 'taller-grafico') OR
        (sector_nombre = 'Metalúrgica' AND u.rol = 'metalurgica') OR
        (sector_nombre = 'Mostrador' AND u.rol = 'mostrador') OR
        (sector_nombre = 'Caja' AND u.rol = 'caja') OR
        (sector_nombre = 'Diseño Gráfico' AND (u.rol = 'diseno' OR u.rol = 'administracion')) OR
        (sector_nombre = 'Instalaciones' AND u.rol = 'instalaciones') OR
        (sector_nombre = 'Asesor Técnico' AND (u.rol = 'asesor-tecnico' OR u.rol = 'administracion')) OR
        (sector_nombre = 'Presupuestos' AND (u.rol = 'presupuestos' OR u.rol = 'asesor-tecnico' OR u.rol = 'administracion'))
      )
    ORDER BY u.nombre;
  END IF;
  
  -- Si llegamos aquí sin retornar nada, retornar vacío (no fallar)
  RETURN;
EXCEPTION WHEN OTHERS THEN
  -- Última línea de defensa: si todo falla, retornar vacío
  RAISE WARNING 'Error crítico en get_users_by_sector para sector "%": %', sector_nombre, SQLERRM;
  RETURN;
END;
$$;

-- ============================================
-- FUNCIÓN: notify_new_orden (versión ultra-robusta)
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_new_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
  notification_count integer := 0;
  sector_text text;
BEGIN
  -- Envolver TODO en un bloque de excepción para que NUNCA falle la inserción
  BEGIN
    -- Obtener el sector de forma segura
    sector_text := COALESCE(NEW.sector, '');
    
    -- Si hay un sector asignado, notificar a todos los usuarios de ese sector
    IF sector_text != '' THEN
      BEGIN
        -- Intentar obtener usuarios del sector (con manejo de errores)
        BEGIN
          FOR user_record IN 
            SELECT * FROM public.get_users_by_sector(sector_text)
          LOOP
            BEGIN
              INSERT INTO public.user_notifications (
                user_id, title, description, type, orden_id, is_read
              ) VALUES (
                user_record.user_id,
                '📋 Nueva orden en tu sector',
                format('Se creó la orden #%s (%s) en el sector "%s"', 
                  NEW.numero_op, NEW.cliente, sector_text),
                'success',
                NEW.id,
                false
              );
              notification_count := notification_count + 1;
            EXCEPTION WHEN OTHERS THEN
              RAISE WARNING 'Error creando notificación para usuario % (sector %): %', 
                user_record.user_nombre, sector_text, SQLERRM;
            END;
          END LOOP;
        EXCEPTION WHEN OTHERS THEN
          -- Si get_users_by_sector falla completamente, solo registrar el warning
          RAISE WARNING 'Error obteniendo usuarios del sector "%s" para notificaciones: %', sector_text, SQLERRM;
        END;
        
        IF notification_count > 0 THEN
          RAISE NOTICE '✅ Notificaciones enviadas a % usuarios del sector "%s"', notification_count, sector_text;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error en bloque de notificaciones por sector: %', SQLERRM;
      END;
    END IF;
    
    -- También notificar al operario asignado específicamente (si es diferente de los usuarios del sector)
    IF NEW.operario_asignado IS NOT NULL AND trim(NEW.operario_asignado) != '' THEN
      BEGIN
        DECLARE
          user_id_destino integer;
          already_notified boolean := false;
        BEGIN
          -- Verificar si ya fue notificado como parte del sector (con manejo de errores)
          BEGIN
            SELECT EXISTS (
              SELECT 1 FROM public.get_users_by_sector(COALESCE(sector_text, '')) g
              WHERE g.user_nombre = NEW.operario_asignado
            ) INTO already_notified;
          EXCEPTION WHEN OTHERS THEN
            -- Si falla, asumir que no fue notificado
            already_notified := false;
          END;
          
          -- Si no fue notificado como parte del sector, notificar específicamente
          IF NOT already_notified THEN
            BEGIN
              user_id_destino := public.get_user_id_from_nombre(NEW.operario_asignado);
            EXCEPTION WHEN OTHERS THEN
              user_id_destino := NULL;
            END;
            
            IF user_id_destino IS NOT NULL THEN
              BEGIN
                INSERT INTO public.user_notifications (
                  user_id, title, description, type, orden_id, is_read
                ) VALUES (
                  user_id_destino,
                  'Nueva orden asignada',
                  format('Te asignaron la orden #%s: %s', NEW.numero_op, NEW.cliente),
                  'success',
                  NEW.id,
                  false
                );
              EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Error creando notificación para operario asignado: %', SQLERRM;
              END;
            END IF;
          END IF;
        END;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error en lógica de notificación para operario asignado: %', SQLERRM;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Si hay un error crítico, solo registrar el warning pero NO fallar la inserción
    RAISE WARNING 'Error crítico en trigger notify_new_orden (no se bloquea la inserción): %', SQLERRM;
  END;
  
  -- SIEMPRE retornar NEW para que la inserción continúe, sin importar qué errores ocurrieron
  RETURN NEW;
END;
$$;

-- Recrear el trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ordenes_trabajo'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_notify_new_orden ON public.ordenes_trabajo;
    CREATE TRIGGER trigger_notify_new_orden
      AFTER INSERT ON public.ordenes_trabajo
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_new_orden();
    
    RAISE NOTICE '✅ Trigger de nueva orden actualizado (versión ultra-robusta)';
  END IF;
END $$;

COMMIT;

