-- Borrado lógico de OPs: la fila permanece en ordenes_trabajo con eliminada=true y motivo_eliminacion.
-- La vista de auditoría expone motivo_eliminacion desde la orden (join) para listados y reportes.
--
-- Nota: no usar CREATE OR REPLACE VIEW si cambia el número/orden de columnas respecto a la vista
-- existente (PostgreSQL 42P16). Se hace DROP + CREATE. CASCADE solo si otra vista depende de esta.
BEGIN;

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS eliminada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion text,
  ADD COLUMN IF NOT EXISTS fecha_eliminacion timestamptz;

COMMENT ON COLUMN public.ordenes_trabajo.eliminada IS 'true = OP borrada lógicamente; no se usa DELETE en la app.';
COMMENT ON COLUMN public.ordenes_trabajo.motivo_eliminacion IS 'Motivo ingresado al eliminar desde la app.';
COMMENT ON COLUMN public.ordenes_trabajo.fecha_eliminacion IS 'Momento en que se marcó como eliminada.';

CREATE INDEX IF NOT EXISTS idx_ordenes_eliminada ON public.ordenes_trabajo (eliminada) WHERE eliminada = true;

-- Misma lista de columnas que 2025-01-25_sistema_auditoria_profesional.sql, más motivo al final.
DROP VIEW IF EXISTS public.vista_auditoria_completa CASCADE;

CREATE VIEW public.vista_auditoria_completa AS
SELECT
  h.id,
  h.id_orden,
  o.numero_op,
  o.cliente,
  h.id_usuario,
  h.nombre_usuario,
  u.rol AS rol_usuario,
  h.estado_anterior,
  h.estado_nuevo,
  h.comentario,
  h.accion_tipo,
  h.cambios_detallados,
  h.ip_address,
  h.user_agent,
  h.timestamp,
  h.metadata,
  EXTRACT(EPOCH FROM (now() - h.timestamp)) AS segundos_desde_cambio,
  o.motivo_eliminacion
FROM public.historial_movimientos h
LEFT JOIN public.ordenes_trabajo o ON h.id_orden = o.id
LEFT JOIN public.usuarios u ON h.id_usuario = u.id
ORDER BY h.timestamp DESC;

GRANT SELECT ON public.vista_auditoria_completa TO authenticated;
GRANT SELECT ON public.vista_auditoria_completa TO anon;

COMMIT;
