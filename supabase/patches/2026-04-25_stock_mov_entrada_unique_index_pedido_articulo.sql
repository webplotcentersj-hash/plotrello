-- Idempotencia recepción stock: a lo sumo una fila Entrada por (pedido, artículo).
-- Ejecutar solo si NO tenés duplicados históricos con el mismo par.
-- Si falla por duplicados, limpiá datos o no uses este índice (la app ya evita duplicar).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_mov_entrada_pedido_articulo
ON public.stock_movimientos (id_pedido_compra, id_articulo_stock)
WHERE tipo_movimiento = 'Entrada'
  AND id_pedido_compra IS NOT NULL
  AND id_articulo_stock IS NOT NULL;

COMMIT;
