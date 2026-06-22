-- WhatsApp / teléfono del visitante en conversaciones de atención al público.

BEGIN;

ALTER TABLE public.atencion_conversaciones
  ADD COLUMN IF NOT EXISTS cliente_telefono varchar(40);

ALTER TABLE public.atencion_conversaciones
  ADD COLUMN IF NOT EXISTS cliente_whatsapp_link text;

COMMENT ON COLUMN public.atencion_conversaciones.cliente_telefono IS
  'Teléfono/WhatsApp del visitante (solo dígitos o formato libre).';
COMMENT ON COLUMN public.atencion_conversaciones.cliente_whatsapp_link IS
  'Link wa.me generado al registrar el contacto del visitante.';

COMMIT;
