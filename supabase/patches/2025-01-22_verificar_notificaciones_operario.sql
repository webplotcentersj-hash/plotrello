-- ============================================
-- Verificar y asegurar notificaciones cuando se asigna un operario
-- ============================================

-- Verificar que la función get_user_id_from_nombre existe y funciona
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'get_user_id_from_nombre'
  ) THEN
    RAISE EXCEPTION 'La función get_user_id_from_nombre no existe';
  END IF;
  
  RAISE NOTICE '✅ Función get_user_id_from_nombre existe';
END $$;

-- Asegurar que la función notify_operario_assignment existe y está actualizada
CREATE OR REPLACE FUNCTION public.notify_operario_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id_destino integer;
  operario_nombre text;
BEGIN
  -- Solo notificar si el operario cambió y no es NULL
  IF NEW.operario_asignado IS NOT NULL 
     AND trim(NEW.operario_asignado) != ''
     AND (OLD.operario_asignado IS NULL OR trim(OLD.operario_asignado) != trim(NEW.operario_asignado)) THEN
    
    operario_nombre := trim(NEW.operario_asignado);
    RAISE NOTICE '🔔 Intentando notificar asignación de operario: % para OP #%', operario_nombre, NEW.numero_op;
    
    -- Intentar obtener el user_id del operario
    BEGIN
      user_id_destino := public.get_user_id_from_nombre(operario_nombre);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error obteniendo user_id para operario %: %', operario_nombre, SQLERRM;
      user_id_destino := NULL;
    END;
    
    IF user_id_destino IS NOT NULL THEN
      BEGIN
        INSERT INTO public.user_notifications (
          user_id, title, description, type, orden_id, is_read, timestamp
        ) VALUES (
          user_id_destino,
          'Nueva orden asignada',
          format('Te asignaron la orden #%s: %s', NEW.numero_op, COALESCE(NEW.cliente, 'Sin cliente')),
          'success',
          NEW.id,
          false,
          NOW()
        );
        RAISE NOTICE '✅ Notificación creada para usuario ID: % (operario: %)', user_id_destino, operario_nombre;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creando notificación de asignación para usuario %: %', user_id_destino, SQLERRM;
      END;
    ELSE
      RAISE WARNING '⚠️ No se encontró user_id para operario asignado: % (OP #%)', operario_nombre, NEW.numero_op;
      RAISE NOTICE '💡 Sugerencia: Verificar que el nombre "%" existe en la tabla usuarios.nombre', operario_nombre;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Asegurar que el trigger existe y está activo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ordenes_trabajo'
  ) THEN
    -- Eliminar trigger existente si existe
    DROP TRIGGER IF EXISTS trigger_notify_operario_assignment ON public.ordenes_trabajo;
    
    -- Crear el trigger
    CREATE TRIGGER trigger_notify_operario_assignment
      AFTER UPDATE ON public.ordenes_trabajo
      FOR EACH ROW
      WHEN (
        (OLD.operario_asignado IS NULL OR trim(OLD.operario_asignado) != trim(NEW.operario_asignado)) 
        AND NEW.operario_asignado IS NOT NULL
        AND trim(NEW.operario_asignado) != ''
      )
      EXECUTE FUNCTION public.notify_operario_assignment();
    
    RAISE NOTICE '✅ Trigger trigger_notify_operario_assignment creado/actualizado';
  ELSE
    RAISE WARNING '⚠️ La tabla ordenes_trabajo no existe';
  END IF;
END $$;

-- Verificar que el trigger está activo
DO $$
DECLARE
  trigger_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND trigger_name = 'trigger_notify_operario_assignment'
      AND event_object_table = 'ordenes_trabajo'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ Trigger trigger_notify_operario_assignment está activo';
  ELSE
    RAISE WARNING '⚠️ Trigger trigger_notify_operario_assignment NO está activo';
  END IF;
END $$;

-- Mostrar información de usuarios para debugging
DO $$
DECLARE
  usuario_record record;
  total_usuarios integer := 0;
BEGIN
  RAISE NOTICE '📋 Usuarios disponibles en la tabla usuarios:';
  FOR usuario_record IN 
    SELECT id, nombre, rol 
    FROM public.usuarios 
    ORDER BY nombre
    LIMIT 20
  LOOP
    total_usuarios := total_usuarios + 1;
    RAISE NOTICE '   - ID: %, Nombre: "%", Rol: %', 
      usuario_record.id, 
      usuario_record.nombre, 
      usuario_record.rol;
  END LOOP;
  
  IF total_usuarios = 0 THEN
    RAISE WARNING '⚠️ No se encontraron usuarios en la tabla usuarios';
  ELSE
    RAISE NOTICE '✅ Total de usuarios mostrados: %', total_usuarios;
  END IF;
END $$;

