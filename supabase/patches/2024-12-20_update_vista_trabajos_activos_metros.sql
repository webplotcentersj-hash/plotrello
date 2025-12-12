BEGIN;

-- Actualizar vista para incluir metros_cuadrados
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
ORDER BY iu.fecha_inicio DESC;

COMMIT;

