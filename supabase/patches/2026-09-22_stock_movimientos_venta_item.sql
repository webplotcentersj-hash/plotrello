-- Stock de ventas: un descuento por ítem, y devolución al eliminarlo.
--
-- Antes: agregar un ítem descontaba stock sin registro de qué ítem lo descontó (doble clic =
-- doble descuento) y eliminarlo no devolvía nada.
-- Ahora el movimiento 'Venta' queda atado al ítem y es único: si se reintenta, no descuenta de nuevo.
-- La devolución se registra como movimiento 'Devolución' del mismo ítem.
-- Idempotente.

BEGIN;

ALTER TABLE public.stock_movimientos
  ADD COLUMN IF NOT EXISTS id_venta_item integer,
  ADD COLUMN IF NOT EXISTS id_venta integer;

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_mov_venta_item
  ON public.stock_movimientos (id_venta_item)
  WHERE id_venta_item IS NOT NULL AND tipo_movimiento = 'Venta';

CREATE INDEX IF NOT EXISTS idx_stock_mov_venta ON public.stock_movimientos (id_venta);

COMMENT ON COLUMN public.stock_movimientos.id_venta_item IS
  'Ítem de venta que generó el movimiento. Único para tipo Venta: evita descontar dos veces el mismo ítem.';

COMMIT;
