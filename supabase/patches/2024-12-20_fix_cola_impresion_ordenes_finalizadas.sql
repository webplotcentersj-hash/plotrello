BEGIN;

-- Actualizar vista para excluir trabajos cuyas órdenes ya están finalizadas
CREATE OR REPLACE VIEW public.v_impresora_trabajos_activos AS
SELECT 
  iu.id as uso_id,
  iu.id_impresora,
  iu.id_orden,
  iu.fecha_inicio,
  iu.fecha_fin,
  iu.horas_usadas,
  iu.metros_cuadrados,
  iu.estado as estado_uso,
  iu.operario,
  iu.created_at,
  i.nombre as nombre_impresora,
  i.modelo as modelo_impresora,
  i.estado as estado_impresora,
  ot.numero_op,
  ot.cliente,
  ot.descripcion,
  ot.sector,
  ot.estado as estado_orden
FROM public.impresora_uso iu
INNER JOIN public.impresoras i ON iu.id_impresora = i.id
LEFT JOIN public.ordenes_trabajo ot ON iu.id_orden = ot.id
WHERE iu.estado = 'En Proceso'
  AND ot.estado NOT IN ('Finalizado en Taller', 'Almacén de Entrega', 'Entregado o Instalado')
ORDER BY iu.fecha_inicio ASC;

-- Función para finalizar automáticamente usos de impresora cuando la orden llega a estados finales
CREATE OR REPLACE FUNCTION public.finalizar_usos_impresora_orden_finalizada()
RETURNS TRIGGER AS $$
DECLARE
  uso_record RECORD;
BEGIN
  -- Si la orden llega a un estado final, finalizar todos los usos activos de impresora
  IF NEW.estado IN ('Finalizado en Taller', 'Almacén de Entrega', 'Entregado o Instalado')
     AND (OLD.estado IS NULL OR OLD.estado NOT IN ('Finalizado en Taller', 'Almacén de Entrega', 'Entregado o Instalado')) THEN
    
    -- Finalizar todos los usos activos para esta orden
    FOR uso_record IN 
      SELECT id, id_impresora 
      FROM public.impresora_uso 
      WHERE id_orden = NEW.id 
        AND estado = 'En Proceso'
    LOOP
      -- Finalizar el uso
      UPDATE public.impresora_uso
      SET 
        fecha_fin = now(),
        estado = 'Completado'
      WHERE id = uso_record.id;
      
      -- Verificar si hay otros usos activos para esta impresora
      IF NOT EXISTS (
        SELECT 1 FROM public.impresora_uso
        WHERE id_impresora = uso_record.id_impresora
          AND estado = 'En Proceso'
          AND id != uso_record.id
      ) THEN
        -- No hay más trabajos, cambiar a "Disponible"
        UPDATE public.impresoras
        SET estado = 'Disponible'
        WHERE id = uso_record.id_impresora;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para finalizar usos automáticamente
DROP TRIGGER IF EXISTS trigger_finalizar_usos_impresora_orden_finalizada ON public.ordenes_trabajo;

CREATE TRIGGER trigger_finalizar_usos_impresora_orden_finalizada
AFTER UPDATE OF estado ON public.ordenes_trabajo
FOR EACH ROW
EXECUTE FUNCTION public.finalizar_usos_impresora_orden_finalizada();

COMMIT;

