-- Crear sistema de notificaciones para cambios de etapa en Taller de Imprenta
-- Similar al sistema de Taller Gráfico e Instalaciones

BEGIN;

-- Función para crear notificación cuando cambia la etapa de Taller de Imprenta
CREATE OR REPLACE FUNCTION public.notify_cambio_etapa_taller_imprenta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  operario_id integer;
  operario_nombre varchar(255);
  admin_ids integer[];
  gerencia_ids integer[];
  usuario_cambio_nombre varchar(255);
BEGIN
  -- Solo procesar si cambió la etapa
  IF OLD.etapa_taller_imprenta IS DISTINCT FROM NEW.etapa_taller_imprenta THEN
    
    -- Obtener nombre del usuario que hizo el cambio
    -- Intentar obtener desde el contexto de sesión o usar el operario asignado
    BEGIN
      usuario_cambio_nombre := COALESCE(
        current_setting('app.current_user_name', true),
        NULLIF(trim(NEW.operario_asignado), ''),
        NULLIF(trim(NEW.usuario_trabajando_nombre), ''),
        NULLIF(trim(NEW.nombre_creador), ''),
        'Sistema'
      );
    EXCEPTION WHEN undefined_column THEN
      -- Si operario_asignado no existe, usar solo usuario_trabajando_nombre
      usuario_cambio_nombre := COALESCE(
        current_setting('app.current_user_name', true),
        NULLIF(trim(NEW.usuario_trabajando_nombre), ''),
        NULLIF(trim(NEW.nombre_creador), ''),
        'Sistema'
      );
    END;
    
    -- Obtener ID del operario asignado (si existe)
    IF NEW.operario_asignado IS NOT NULL AND trim(NEW.operario_asignado) != '' THEN
      SELECT id INTO operario_id
      FROM public.usuarios
      WHERE nombre = trim(NEW.operario_asignado)
      LIMIT 1;
      
      operario_nombre := trim(NEW.operario_asignado);
    ELSIF NEW.usuario_trabajando_nombre IS NOT NULL AND trim(NEW.usuario_trabajando_nombre) != '' THEN
      SELECT id INTO operario_id
      FROM public.usuarios
      WHERE nombre = trim(NEW.usuario_trabajando_nombre)
      LIMIT 1;
      
      operario_nombre := trim(NEW.usuario_trabajando_nombre);
    END IF;
    
    -- Obtener IDs de administradores y gerencia
    SELECT ARRAY_AGG(id) INTO admin_ids
    FROM public.usuarios
    WHERE rol IN ('administracion', 'gerencia');
    
    -- Crear notificación para el operario asignado (si existe y no es quien hizo el cambio)
    IF operario_id IS NOT NULL AND operario_nombre != usuario_cambio_nombre THEN
      INSERT INTO public.notificaciones (
        id_usuario,
        tipo,
        titulo,
        mensaje,
        id_orden,
        leida,
        created_at
      ) VALUES (
        operario_id,
        'cambio_etapa_taller_imprenta',
        'Cambio de etapa en Taller de Imprenta',
        format('La OP #%s cambió a la etapa "%s" en Taller de Imprenta', 
               NEW.numero_op, 
               COALESCE(NEW.etapa_taller_imprenta, 'Sin etapa')),
        NEW.id,
        false,
        now()
      );
    END IF;
    
    -- Crear notificaciones para administradores y gerencia
    IF admin_ids IS NOT NULL AND array_length(admin_ids, 1) > 0 THEN
      INSERT INTO public.notificaciones (
        id_usuario,
        tipo,
        titulo,
        mensaje,
        id_orden,
        leida,
        created_at
      )
      SELECT 
        unnest(admin_ids),
        'cambio_etapa_taller_imprenta',
        'Cambio de etapa en Taller de Imprenta',
        format('La OP #%s cambió a la etapa "%s" en Taller de Imprenta (por %s)', 
               NEW.numero_op, 
               COALESCE(NEW.etapa_taller_imprenta, 'Sin etapa'),
               usuario_cambio_nombre),
        NEW.id,
        false,
        now();
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para notificar cambios de etapa
DROP TRIGGER IF EXISTS trigger_notify_cambio_etapa_taller_imprenta ON public.ordenes_trabajo;
CREATE TRIGGER trigger_notify_cambio_etapa_taller_imprenta
  AFTER UPDATE ON public.ordenes_trabajo
  FOR EACH ROW
  WHEN (OLD.etapa_taller_imprenta IS DISTINCT FROM NEW.etapa_taller_imprenta)
  EXECUTE FUNCTION public.notify_cambio_etapa_taller_imprenta();

COMMIT;

