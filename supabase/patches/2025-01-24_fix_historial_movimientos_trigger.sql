-- Fix: Trigger automático para registrar todos los cambios en historial_movimientos
-- Incluye cambios de estado, operario, sector y otros campos relevantes
-- Mejora la trazabilidad especialmente para cambios de usuarios

BEGIN;

-- Función para registrar cambios en historial_movimientos
CREATE OR REPLACE FUNCTION public.registrar_historial_movimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_actual_id integer;
  usuario_actual_nombre varchar(255);
  estado_anterior_val varchar(50);
  estado_nuevo_val varchar(50);
  operario_anterior_val varchar(255);
  operario_nuevo_val varchar(255);
  sector_anterior_val varchar(100);
  sector_nuevo_val varchar(100);
  comentario_historial text;
  hay_cambio_importante boolean := false;
BEGIN
  -- Obtener información del usuario actual
  -- Intentar obtener desde el contexto de sesión primero
  BEGIN
    usuario_actual_nombre := current_setting('app.current_user_name', true);
  EXCEPTION WHEN OTHERS THEN
    usuario_actual_nombre := NULL;
  END;
  
  -- Si no hay usuario en el contexto, intentar obtener desde operario_asignado o usuario_trabajando_nombre
  IF usuario_actual_nombre IS NULL OR usuario_actual_nombre = '' THEN
    usuario_actual_nombre := COALESCE(
      NULLIF(trim(NEW.operario_asignado), ''),
      NULLIF(trim(NEW.usuario_trabajando_nombre), ''),
      NULLIF(trim(NEW.nombre_creador), ''),
      'Sistema'
    );
  END IF;
  
  -- Intentar obtener ID del usuario
  IF usuario_actual_nombre IS NOT NULL AND usuario_actual_nombre != 'Sistema' THEN
    SELECT id INTO usuario_actual_id
    FROM public.usuarios
    WHERE nombre = usuario_actual_nombre
    LIMIT 1;
  END IF;
  
  -- Si no se encontró ID, buscar un usuario por defecto o crear uno temporal
  -- Usar el primer usuario disponible como fallback, o NULL si no hay ninguno
  IF usuario_actual_id IS NULL THEN
    SELECT id INTO usuario_actual_id
    FROM public.usuarios
    ORDER BY id
    LIMIT 1;
    
    -- Si aún no hay usuario, no podemos insertar (la FK lo requiere)
    -- En este caso, usar el nombre del sistema pero sin ID válido
    IF usuario_actual_id IS NULL THEN
      -- No registrar el historial si no hay usuarios en la BD
      RETURN NEW;
    END IF;
  END IF;
  
  -- Obtener valores anteriores y nuevos
  estado_anterior_val := OLD.estado;
  estado_nuevo_val := NEW.estado;
  operario_anterior_val := COALESCE(OLD.operario_asignado, '');
  operario_nuevo_val := COALESCE(NEW.operario_asignado, '');
  sector_anterior_val := COALESCE(OLD.sector, '');
  sector_nuevo_val := COALESCE(NEW.sector, '');
  
  -- Construir comentario descriptivo del cambio
  comentario_historial := '';
  
  -- Verificar cambios de estado
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    hay_cambio_importante := true;
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    comentario_historial := comentario_historial || 'Estado: ' || COALESCE(OLD.estado, 'N/A') || ' → ' || COALESCE(NEW.estado, 'N/A');
  END IF;
  
  -- Verificar cambios de operario (usuario asignado)
  IF trim(COALESCE(OLD.operario_asignado, '')) IS DISTINCT FROM trim(COALESCE(NEW.operario_asignado, '')) THEN
    hay_cambio_importante := true;
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    IF NEW.operario_asignado IS NULL OR trim(NEW.operario_asignado) = '' THEN
      comentario_historial := comentario_historial || 'Operario desasignado';
    ELSIF OLD.operario_asignado IS NULL OR trim(OLD.operario_asignado) = '' THEN
      comentario_historial := comentario_historial || 'Operario asignado: ' || trim(NEW.operario_asignado);
    ELSE
      comentario_historial := comentario_historial || 'Operario: ' || trim(OLD.operario_asignado) || ' → ' || trim(NEW.operario_asignado);
    END IF;
    
    -- Si cambió el operario, actualizar el usuario del historial con el nuevo operario
    IF NEW.operario_asignado IS NOT NULL AND trim(NEW.operario_asignado) != '' THEN
      usuario_actual_nombre := trim(NEW.operario_asignado);
      -- Intentar obtener ID del nuevo operario
      SELECT id INTO usuario_actual_id
      FROM public.usuarios
      WHERE nombre = usuario_actual_nombre
      LIMIT 1;
      -- Si no se encuentra, usar el primero disponible
      IF usuario_actual_id IS NULL THEN
        SELECT id INTO usuario_actual_id
        FROM public.usuarios
        ORDER BY id
        LIMIT 1;
        IF usuario_actual_id IS NULL THEN
          RETURN NEW;
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Verificar cambios de sector
  IF OLD.sector IS DISTINCT FROM NEW.sector THEN
    hay_cambio_importante := true;
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    comentario_historial := comentario_historial || 'Sector: ' || COALESCE(OLD.sector, 'N/A') || ' → ' || COALESCE(NEW.sector, 'N/A');
  END IF;
  
  -- Verificar cambios de prioridad
  IF OLD.prioridad IS DISTINCT FROM NEW.prioridad THEN
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    comentario_historial := comentario_historial || 'Prioridad: ' || COALESCE(OLD.prioridad, 'N/A') || ' → ' || COALESCE(NEW.prioridad, 'N/A');
  END IF;
  
  -- Solo registrar si hay un cambio importante (estado, operario o sector)
  IF hay_cambio_importante THEN
    INSERT INTO public.historial_movimientos (
      id_orden,
      id_usuario,
      nombre_usuario,
      estado_anterior,
      estado_nuevo,
      timestamp,
      comentario
    ) VALUES (
      NEW.id,
      usuario_actual_id,
      usuario_actual_nombre,
      estado_anterior_val,
      estado_nuevo_val,
      now(),
      CASE 
        WHEN comentario_historial != '' THEN comentario_historial
        ELSE 'Cambio registrado'
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_registrar_historial_movimiento ON public.ordenes_trabajo;

-- Crear trigger que se ejecuta después de cada UPDATE
CREATE TRIGGER trigger_registrar_historial_movimiento
  AFTER UPDATE ON public.ordenes_trabajo
  FOR EACH ROW
  WHEN (
    -- Solo registrar si hay cambios relevantes
    (OLD.estado IS DISTINCT FROM NEW.estado) OR
    (trim(COALESCE(OLD.operario_asignado, '')) IS DISTINCT FROM trim(COALESCE(NEW.operario_asignado, ''))) OR
    (OLD.sector IS DISTINCT FROM NEW.sector) OR
    (OLD.prioridad IS DISTINCT FROM NEW.prioridad)
  )
  EXECUTE FUNCTION public.registrar_historial_movimiento();

COMMIT;

