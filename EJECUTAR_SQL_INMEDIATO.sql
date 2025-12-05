-- ============================================
-- FIX COMPLETO: Movimiento de fichas
-- Ejecutar este script en Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Corregir función de sincronización
-- NO debe sincronizar estado ni sector cuando se mueven fichas
-- ============================================
CREATE OR REPLACE FUNCTION public.sincronizar_fichas_duplicadas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ⚠️ IMPORTANTE: Solo sincronizar datos, NO estado ni sector
  -- Las fichas duplicadas se mueven INDEPENDIENTEMENTE
  IF NEW.es_duplicado = false AND OLD.es_duplicado = false THEN
    -- Solo sincronizar campos de datos, NO estado/sector
    UPDATE public.ordenes_trabajo
    SET
      descripcion = NEW.descripcion,
      prioridad = NEW.prioridad,
      fecha_entrega = NEW.fecha_entrega,
      materiales = NEW.materiales,
      telefono_cliente = NEW.telefono_cliente,
      email_cliente = NEW.email_cliente,
      direccion_cliente = NEW.direccion_cliente,
      whatsapp_link = NEW.whatsapp_link,
      ubicacion_link = NEW.ubicacion_link,
      drive_link = NEW.drive_link,
      foto_url = NEW.foto_url,
      dni_cuit = NEW.dni_cuit,
      operario_asignado = NEW.operario_asignado,
      complejidad = NEW.complejidad
      -- ⚠️ EXPLÍCITAMENTE NO sincronizar:
      -- - estado (cada ficha se mueve independientemente)
      -- - sector (cada ficha está en su sector)
      -- - es_duplicado (no cambiar)
      -- - id_orden_original (no cambiar)
    WHERE id_orden_original = NEW.id
      AND es_duplicado = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 2: Asegurar que el trigger solo se ejecute en cambios de datos
-- NO en cambios de estado o sector
-- ============================================
DROP TRIGGER IF EXISTS trigger_sincronizar_duplicados ON public.ordenes_trabajo;

CREATE TRIGGER trigger_sincronizar_duplicados
  AFTER UPDATE ON public.ordenes_trabajo
  FOR EACH ROW
  WHEN (
    -- Solo sincronizar cuando cambian campos de DATOS
    -- ⚠️ EXPLÍCITAMENTE EXCLUIR estado y sector
    (OLD.descripcion IS DISTINCT FROM NEW.descripcion) OR
    (OLD.prioridad IS DISTINCT FROM NEW.prioridad) OR
    (OLD.fecha_entrega IS DISTINCT FROM NEW.fecha_entrega) OR
    (OLD.materiales IS DISTINCT FROM NEW.materiales) OR
    (OLD.telefono_cliente IS DISTINCT FROM NEW.telefono_cliente) OR
    (OLD.email_cliente IS DISTINCT FROM NEW.email_cliente) OR
    (OLD.direccion_cliente IS DISTINCT FROM NEW.direccion_cliente) OR
    (OLD.whatsapp_link IS DISTINCT FROM NEW.whatsapp_link) OR
    (OLD.ubicacion_link IS DISTINCT FROM NEW.ubicacion_link) OR
    (OLD.drive_link IS DISTINCT FROM NEW.drive_link) OR
    (OLD.foto_url IS DISTINCT FROM NEW.foto_url) OR
    (OLD.dni_cuit IS DISTINCT FROM NEW.dni_cuit) OR
    (OLD.operario_asignado IS DISTINCT FROM NEW.operario_asignado) OR
    (OLD.complejidad IS DISTINCT FROM NEW.complejidad)
    -- ⚠️ NO incluir estado ni sector aquí
  )
  EXECUTE FUNCTION public.sincronizar_fichas_duplicadas();

-- ============================================
-- PASO 3: Corregir el trigger de unificación
-- Solo debe ejecutarse cuando el nuevo estado es "Finalizado en Taller"
-- ============================================
DROP TRIGGER IF EXISTS trigger_unificar_fichas ON public.ordenes_trabajo;

CREATE TRIGGER trigger_unificar_fichas
  AFTER UPDATE ON public.ordenes_trabajo
  FOR EACH ROW
  WHEN (
    -- ⚠️ IMPORTANTE: Solo ejecutar cuando:
    -- 1. El estado cambió
    -- 2. Y el nuevo estado es "Finalizado en Taller"
    (OLD.estado IS DISTINCT FROM NEW.estado)
    AND NEW.estado = 'Finalizado en Taller'
  )
  EXECUTE FUNCTION public.unificar_fichas_completadas();

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FIX COMPLETO APLICADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   - Sincronización NO afecta estado/sector';
  RAISE NOTICE '   - Trigger solo se ejecuta en cambios de datos';
  RAISE NOTICE '   - Unificación solo en "Finalizado en Taller"';
  RAISE NOTICE '   - Fichas duplicadas se mueven libremente';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

