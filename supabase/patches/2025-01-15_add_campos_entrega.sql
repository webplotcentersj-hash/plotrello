-- Agregar campos para guardar información de entrega y firma digital

BEGIN;

ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS firma_data_url text,
ADD COLUMN IF NOT EXISTS entregado_a varchar(255),
ADD COLUMN IF NOT EXISTS dni_retira varchar(50),
ADD COLUMN IF NOT EXISTS observaciones_entrega text,
ADD COLUMN IF NOT EXISTS fecha_entrega_efectiva timestamptz;

COMMENT ON COLUMN public.ordenes_trabajo.firma_data_url IS 'Firma digital del cliente en formato data URL';
COMMENT ON COLUMN public.ordenes_trabajo.entregado_a IS 'Nombre completo de quien retira la orden';
COMMENT ON COLUMN public.ordenes_trabajo.dni_retira IS 'DNI de quien retira la orden';
COMMENT ON COLUMN public.ordenes_trabajo.observaciones_entrega IS 'Observaciones sobre la entrega';
COMMENT ON COLUMN public.ordenes_trabajo.fecha_entrega_efectiva IS 'Fecha y hora efectiva de la entrega';

CREATE INDEX IF NOT EXISTS idx_ordenes_fecha_entrega_efectiva ON public.ordenes_trabajo(fecha_entrega_efectiva);

COMMIT;

