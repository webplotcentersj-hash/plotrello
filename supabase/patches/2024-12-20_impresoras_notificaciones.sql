BEGIN;

-- ============================================
-- FUNCIÓN PARA NOTIFICAR A USUARIOS DE TALLER GRÁFICO
-- ============================================

CREATE OR REPLACE FUNCTION public.notificar_usuarios_taller_grafico(
  titulo varchar(255),
  descripcion text,
  tipo_notificacion varchar(50) DEFAULT 'warning'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
  notification_count integer := 0;
BEGIN
  -- Obtener todos los usuarios con rol taller-grafico
  FOR user_record IN 
    SELECT id, nombre FROM public.usuarios WHERE rol = 'taller-grafico'
  LOOP
    BEGIN
      INSERT INTO public.user_notifications (
        user_id, title, description, type, is_read
      ) VALUES (
        user_record.id,
        titulo,
        descripcion,
        tipo_notificacion,
        false
      );
      notification_count := notification_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error creando notificación para usuario %: %', 
        user_record.nombre, SQLERRM;
    END;
  END LOOP;
  
  IF notification_count > 0 THEN
    RAISE NOTICE '✅ Notificaciones enviadas a % usuarios de Taller Gráfico', notification_count;
  END IF;
END;
$$;

-- ============================================
-- TRIGGER PARA NOTIFICAR CAMBIOS DE ESTADO CRÍTICOS
-- ============================================

CREATE OR REPLACE FUNCTION public.notificar_cambio_estado_impresora()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notificar cuando una impresora entra en mantenimiento o fuera de servicio
  IF NEW.estado IN ('Mantenimiento', 'Fuera de Servicio') AND 
     OLD.estado NOT IN ('Mantenimiento', 'Fuera de Servicio') THEN
    PERFORM public.notificar_usuarios_taller_grafico(
      format('⚠️ Impresora %s en %s', NEW.nombre, NEW.estado),
      format('La impresora %s (%s) ha cambiado su estado a "%s".', 
        NEW.nombre, COALESCE(NEW.modelo, 'Sin modelo'), NEW.estado),
      'warning'
    );
  END IF;
  
  -- Notificar cuando una impresora vuelve a estar disponible después de mantenimiento
  IF NEW.estado = 'Disponible' AND 
     OLD.estado IN ('Mantenimiento', 'Fuera de Servicio') THEN
    PERFORM public.notificar_usuarios_taller_grafico(
      format('✅ Impresora %s Disponible', NEW.nombre),
      format('La impresora %s (%s) está nuevamente disponible para uso.', 
        NEW.nombre, COALESCE(NEW.modelo, 'Sin modelo')),
      'success'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_notificar_cambio_estado_impresora ON public.impresoras;

CREATE TRIGGER trigger_notificar_cambio_estado_impresora
AFTER UPDATE OF estado ON public.impresoras
FOR EACH ROW
WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
EXECUTE FUNCTION public.notificar_cambio_estado_impresora();

-- ============================================
-- FUNCIÓN PARA VERIFICAR OCUPACIÓN ALTA Y NOTIFICAR
-- Esta función se puede llamar periódicamente o desde un trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.verificar_ocupacion_impresoras()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  impresora_record record;
BEGIN
  -- Verificar impresoras con ocupación mayor al 90% hoy
  FOR impresora_record IN
    SELECT 
      id,
      nombre,
      modelo,
      porcentaje_ocupacion_hoy,
      estado_impresora
    FROM public.v_impresoras_ocupacion
    WHERE porcentaje_ocupacion_hoy >= 90
      AND estado_impresora NOT IN ('Mantenimiento', 'Fuera de Servicio')
  LOOP
    -- Notificar solo una vez al día (verificar si ya se notificó hoy)
    IF NOT EXISTS (
      SELECT 1 FROM public.user_notifications
      WHERE title LIKE format('%%%s%%', impresora_record.nombre)
        AND description LIKE '%ocupación%'
        AND timestamp >= CURRENT_DATE
        LIMIT 1
    ) THEN
      PERFORM public.notificar_usuarios_taller_grafico(
        format('🔴 Impresora %s muy ocupada', impresora_record.nombre),
        format('La impresora %s (%s) tiene una ocupación del %.1f%% hoy. Considera redistribuir trabajos.', 
          impresora_record.nombre, 
          COALESCE(impresora_record.modelo, 'Sin modelo'),
          impresora_record.porcentaje_ocupacion_hoy),
        'error'
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================
-- TRIGGER PARA NOTIFICAR CUANDO LA OCUPACIÓN SE ACTUALIZA
-- Se ejecuta cuando se actualiza la vista (a través de cambios en órdenes)
-- ============================================

-- Nota: Como las vistas no pueden tener triggers directos, 
-- podemos crear un trigger en la tabla impresora_uso que verifique la ocupación

CREATE OR REPLACE FUNCTION public.verificar_ocupacion_despues_uso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ocupacion_record record;
BEGIN
  -- Esperar un poco antes de verificar (para que la vista se actualice)
  -- En producción, esto se puede hacer con un job programado
  
  -- Verificar ocupación de la impresora afectada
  SELECT porcentaje_ocupacion_hoy, estado_impresora
  INTO ocupacion_record
  FROM public.v_impresoras_ocupacion
  WHERE id = NEW.id_impresora;
  
  -- Si la ocupación es muy alta y no se ha notificado hoy
  IF ocupacion_record.porcentaje_ocupacion_hoy >= 90 
     AND ocupacion_record.estado_impresora NOT IN ('Mantenimiento', 'Fuera de Servicio') THEN
    -- Verificar si ya se notificó hoy
    IF NOT EXISTS (
      SELECT 1 FROM public.user_notifications
      WHERE title LIKE format('%%%s%%', (SELECT nombre FROM public.impresoras WHERE id = NEW.id_impresora))
        AND description LIKE '%ocupación%'
        AND timestamp >= CURRENT_DATE
        LIMIT 1
    ) THEN
      PERFORM public.notificar_usuarios_taller_grafico(
        format('🔴 Impresora %s muy ocupada', (SELECT nombre FROM public.impresoras WHERE id = NEW.id_impresora)),
        format('La impresora %s ha alcanzado una ocupación del %.1f%%.', 
          (SELECT nombre FROM public.impresoras WHERE id = NEW.id_impresora),
          ocupacion_record.porcentaje_ocupacion_hoy),
        'error'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger en impresora_uso (solo para INSERT, cuando se asigna un nuevo trabajo)
DROP TRIGGER IF EXISTS trigger_verificar_ocupacion_despues_uso ON public.impresora_uso;

CREATE TRIGGER trigger_verificar_ocupacion_despues_uso
AFTER INSERT ON public.impresora_uso
FOR EACH ROW
EXECUTE FUNCTION public.verificar_ocupacion_despues_uso();

COMMIT;

