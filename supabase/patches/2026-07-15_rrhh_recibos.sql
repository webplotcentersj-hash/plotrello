-- Recibos / documentación firmada en lote

CREATE TABLE IF NOT EXISTS public.rrhh_doc_lotes (
  id bigserial PRIMARY KEY,
  periodo text NOT NULL CHECK (periodo ~ '^\d{4}-\d{2}$'),
  tipo text NOT NULL DEFAULT 'recibo_sueldo'
    CHECK (tipo IN ('recibo_sueldo', 'otro')),
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'enviado', 'cerrado')),
  titulo text NOT NULL,
  created_by integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rrhh_doc_items (
  id bigserial PRIMARY KEY,
  id_lote bigint NOT NULL REFERENCES public.rrhh_doc_lotes(id) ON DELETE CASCADE,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  archivo_url text NOT NULL,
  archivo_nombre text,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'firmado', 'rechazado')),
  firma_data_url text,
  firmado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rrhh_doc_items_lote_usuario_uq UNIQUE (id_lote, id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_doc_items_lote ON public.rrhh_doc_items (id_lote);
CREATE INDEX IF NOT EXISTS idx_rrhh_doc_items_usuario ON public.rrhh_doc_items (id_usuario);

ALTER TABLE public.rrhh_doc_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_doc_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rrhh_doc_lotes_all ON public.rrhh_doc_lotes;
CREATE POLICY rrhh_doc_lotes_all ON public.rrhh_doc_lotes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS rrhh_doc_items_all ON public.rrhh_doc_items;
CREATE POLICY rrhh_doc_items_all ON public.rrhh_doc_items FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.rrhh_doc_lotes TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_doc_items TO anon, authenticated, service_role;
