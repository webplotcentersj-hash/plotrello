-- Agregar columna fecha_entrega_estimada y campos de tracking a pedidos_compras

BEGIN;

-- Agregar columna fecha_entrega_estimada si no existe
ALTER TABLE public.pedidos_compras
ADD COLUMN IF NOT EXISTS fecha_entrega_estimada timestamptz;

-- Agregar columnas de tracking de entrega si no existen
ALTER TABLE public.pedidos_compras
ADD COLUMN IF NOT EXISTS fecha_entrega_real timestamptz,
ADD COLUMN IF NOT EXISTS estado_entrega varchar(50),
ADD COLUMN IF NOT EXISTS tracking_number varchar(100),
ADD COLUMN IF NOT EXISTS transportista varchar(100);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_pedidos_compras_fecha_entrega_estimada 
ON public.pedidos_compras(fecha_entrega_estimada);

CREATE INDEX IF NOT EXISTS idx_pedidos_compras_estado_entrega 
ON public.pedidos_compras(estado_entrega);

-- Comentarios para documentación
COMMENT ON COLUMN public.pedidos_compras.fecha_entrega_estimada IS 'Fecha estimada de entrega del pedido al proveedor externo.';
COMMENT ON COLUMN public.pedidos_compras.fecha_entrega_real IS 'Fecha real de entrega del pedido.';
COMMENT ON COLUMN public.pedidos_compras.estado_entrega IS 'Estado de la entrega: Pendiente, En Tránsito, Parcialmente Entregado, Listo para Retirar, Entregado, Retrasado.';
COMMENT ON COLUMN public.pedidos_compras.tracking_number IS 'Número de tracking del envío.';
COMMENT ON COLUMN public.pedidos_compras.transportista IS 'Nombre de la empresa transportista.';

COMMIT;

