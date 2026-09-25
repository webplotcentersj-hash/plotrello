-- Precio de lista por unidad. Lo habitual es el metro cuadrado.

ALTER TABLE public.articulos_empresa
  ADD COLUMN IF NOT EXISTS unidad_medida text NOT NULL DEFAULT 'm2';

ALTER TABLE public.articulos_empresa
  ALTER COLUMN unidad_medida SET DEFAULT 'm2';

UPDATE public.articulos_empresa
SET unidad_medida = 'm2'
WHERE unidad_medida IS NULL OR btrim(unidad_medida) = '' OR unidad_medida = 'm';

COMMENT ON COLUMN public.articulos_empresa.unidad_medida IS
  'Unidad del precio de lista. Lo habitual es m2. La venta multiplica el precio por la cantidad en esa unidad.';
