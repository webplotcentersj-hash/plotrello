-- Presencia real del equipo en /atencion-publico (heartbeat para el chat embebido).

CREATE TABLE IF NOT EXISTS public.atencion_staff_presence (
  user_id integer PRIMARY KEY,
  user_nombre text NOT NULL DEFAULT '',
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atencion_staff_presence_last_seen
  ON public.atencion_staff_presence (last_seen DESC);

COMMENT ON TABLE public.atencion_staff_presence IS
  'Heartbeat de staff con panel de atención al público abierto (chat embebido).';
