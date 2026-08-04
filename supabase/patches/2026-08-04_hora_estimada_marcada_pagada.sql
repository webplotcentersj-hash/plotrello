-- Hora estimada (HH:MM) + marca pagada en OP.
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS hora_estimada text,
  ADD COLUMN IF NOT EXISTS marcada_pagada boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ordenes_trabajo.hora_estimada IS
  'Hora estimada de entrega (HH:MM), aparte de fecha_entrega (date).';
COMMENT ON COLUMN public.ordenes_trabajo.marcada_pagada IS
  'Marca manual: OP pagada (visible en ficha del tablero).';
