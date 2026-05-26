-- Comercio omnicanal Fase 0: catálogo comercial enlazado a stock + trazabilidad pedidos
-- Aplicar en el proyecto Supabase principal (Plotrello).

BEGIN;

-- ---------------------------------------------------------------------------
-- articulos_empresa: comercio por canal
-- ---------------------------------------------------------------------------
ALTER TABLE public.articulos_empresa
  ADD COLUMN IF NOT EXISTS id_articulo_stock integer,
  ADD COLUMN IF NOT EXISTS modo_venta text NOT NULL DEFAULT 'ambos',
  ADD COLUMN IF NOT EXISTS controla_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unidades_por_venta numeric(12, 4) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS visible_portal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_web_publica boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_totem boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_stickers boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.articulos_empresa.id_articulo_stock IS
  'ID del artículo en la BD de stock (sin FK cross-project).';
COMMENT ON COLUMN public.articulos_empresa.modo_venta IS
  'compra | cotizacion | ambos';
COMMENT ON COLUMN public.articulos_empresa.controla_stock IS
  'Si true, las ventas/pedidos tipo compra descuentan stock vía app.';
COMMENT ON COLUMN public.articulos_empresa.unidades_por_venta IS
  'Unidades de stock consumidas por cada unidad vendida (ej. 10 hojas por pack).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'articulos_empresa_modo_venta_check'
  ) THEN
    ALTER TABLE public.articulos_empresa
      ADD CONSTRAINT articulos_empresa_modo_venta_check
      CHECK (modo_venta IN ('compra', 'cotizacion', 'ambos'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_articulos_empresa_id_stock
  ON public.articulos_empresa(id_articulo_stock)
  WHERE id_articulo_stock IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articulos_empresa_visible_portal
  ON public.articulos_empresa(visible_portal) WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_articulos_empresa_visible_totem
  ON public.articulos_empresa(visible_totem) WHERE activo = true;

-- Migrar visible_clientes → visible_portal; habilitar tótem si ya era visible al cliente
UPDATE public.articulos_empresa
SET
  visible_portal = COALESCE(visible_clientes, true),
  visible_totem = COALESCE(visible_clientes, false)
WHERE visible_portal IS DISTINCT FROM COALESCE(visible_clientes, true)
   OR visible_totem IS DISTINCT FROM COALESCE(visible_clientes, false);

-- ---------------------------------------------------------------------------
-- stock_movimientos: trazabilidad pedido cliente
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_movimientos
  ADD COLUMN IF NOT EXISTS id_pedido_cliente integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_movimientos_id_pedido_cliente_fkey'
  ) THEN
    ALTER TABLE public.stock_movimientos
      ADD CONSTRAINT stock_movimientos_id_pedido_cliente_fkey
      FOREIGN KEY (id_pedido_cliente)
      REFERENCES public.pedidos_clientes(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Tabla pedidos_clientes no existe; omitiendo FK id_pedido_cliente.';
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_movimientos_pedido_cliente
  ON public.stock_movimientos(id_pedido_cliente)
  WHERE id_pedido_cliente IS NOT NULL;

COMMIT;
