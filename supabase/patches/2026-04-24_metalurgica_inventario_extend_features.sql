-- Extensión inventario metalúrgica: código, estado operativo, préstamos, proveedor,
-- observaciones, galería de fotos (JSON), historial enriquecido con metadata.

ALTER TABLE public.metalurgica_inventario_herramientas
  ADD COLUMN IF NOT EXISTS codigo_interno text,
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'ok'
    CHECK (estado IN ('ok', 'reparacion', 'fuera', 'baja')),
  ADD COLUMN IF NOT EXISTS prestado_a text,
  ADD COLUMN IF NOT EXISTS fecha_prestamo timestamptz,
  ADD COLUMN IF NOT EXISTS proveedor text,
  ADD COLUMN IF NOT EXISTS fecha_compra date,
  ADD COLUMN IF NOT EXISTS observaciones text,
  ADD COLUMN IF NOT EXISTS fotos_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.metalurgica_inventario_herramientas.codigo_interno IS 'Código interno / etiqueta (único si se informa).';
COMMENT ON COLUMN public.metalurgica_inventario_herramientas.estado IS 'ok | reparacion | fuera | baja';
COMMENT ON COLUMN public.metalurgica_inventario_herramientas.fotos_urls IS 'Lista de URLs públicas de fotos (Storage); la primera es la principal.';

-- Migrar foto_url existente al array si está vacío
UPDATE public.metalurgica_inventario_herramientas
SET fotos_urls = jsonb_build_array(foto_url)
WHERE foto_url IS NOT NULL
  AND btrim(foto_url) <> ''
  AND jsonb_array_length(COALESCE(fotos_urls, '[]'::jsonb)) = 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metal_inv_codigo_interno_uq
  ON public.metalurgica_inventario_herramientas (codigo_interno)
  WHERE codigo_interno IS NOT NULL AND btrim(codigo_interno) <> '';

CREATE INDEX IF NOT EXISTS idx_metal_inv_estado ON public.metalurgica_inventario_herramientas (estado);

ALTER TABLE public.metalurgica_inventario_movimientos
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.metalurgica_inventario_movimientos.metadata IS 'Detalle extra del evento (campos tocados, etc.).';
