-- Libro de sueldos LCT + interfaz ARCA LSD (TXT 01-04) + fichas de haberes.

CREATE TABLE IF NOT EXISTS public.rrhh_libro_sueldos (
  id bigserial PRIMARY KEY,
  periodo text NOT NULL UNIQUE CHECK (periodo ~ '^\d{4}-\d{2}$'),
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'cerrado')),
  empresa_nombre text NOT NULL DEFAULT 'PLOT CENTER SRL',
  empresa_domicilio text NOT NULL DEFAULT 'Avenida Libertador Este 580, San Juan',
  empresa_cuit text NOT NULL DEFAULT '30715518801',
  jurisdiccion text NOT NULL DEFAULT 'SAN JUAN',
  cct_default text NOT NULL DEFAULT '0409/05',
  art_codigo text NOT NULL DEFAULT '00000',
  scvo_cia text NOT NULL DEFAULT 'S880 EXPERTA SEGUROS',
  banco text,
  fecha_pago date,
  scvo_default numeric(14,2) NOT NULL DEFAULT 0,
  os_base_mult numeric(6,2) NOT NULL DEFAULT 2,
  nro_liquidacion integer NOT NULL DEFAULT 1,
  dias_base integer NOT NULL DEFAULT 30,
  tipo_empleador text NOT NULL DEFAULT '1',
  codigo_actividad text NOT NULL DEFAULT '049',
  codigo_localidad text NOT NULL DEFAULT '00',
  codigo_os_default text,
  importe_detraer numeric(14,2) NOT NULL DEFAULT 0,
  alicuotas jsonb NOT NULL DEFAULT '{}'::jsonb,
  notas text,
  id_lote_recibos bigint REFERENCES public.rrhh_doc_lotes(id) ON DELETE SET NULL,
  created_by integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rrhh_libro_sueldos_items (
  id bigserial PRIMARY KEY,
  id_libro bigint NOT NULL REFERENCES public.rrhh_libro_sueldos(id) ON DELETE CASCADE,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  incluido boolean NOT NULL DEFAULT true,
  n_legajo integer NOT NULL DEFAULT 0,
  apellido_nombre text NOT NULL DEFAULT '',
  cuil text NOT NULL DEFAULT '',
  categoria text,
  fecha_ingreso date,
  antiguedad_reconocida integer NOT NULL DEFAULT 0,
  anios_antiguedad integer NOT NULL DEFAULT 0,
  dias integer NOT NULL DEFAULT 30,
  etiqueta_basico text NOT NULL DEFAULT 'Sueldo básico',
  sueldo_basico numeric(14,2) NOT NULL DEFAULT 0,
  adicional_antiguedad numeric(14,2) NOT NULL DEFAULT 0,
  scvo numeric(14,2) NOT NULL DEFAULT 0,
  banco text,
  cbu text,
  forma_pago text NOT NULL DEFAULT '1',
  conyuge boolean NOT NULL DEFAULT false,
  hijos integer NOT NULL DEFAULT 0,
  cct boolean NOT NULL DEFAULT true,
  cct_codigo text DEFAULT '0409/05',
  cobertura_scvo boolean NOT NULL DEFAULT true,
  situacion_revista text NOT NULL DEFAULT '01',
  condicion text NOT NULL DEFAULT '01',
  actividad text,
  modalidad text NOT NULL DEFAULT '001',
  codigo_os text,
  horas_trabajadas integer NOT NULL DEFAULT 0,
  extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rrhh_libro_sueldos_items_libro_usuario_uq UNIQUE (id_libro, id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_libro_sueldos_items_libro
  ON public.rrhh_libro_sueldos_items (id_libro);

CREATE TABLE IF NOT EXISTS public.rrhh_sueldo_fichas (
  id_usuario integer PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  n_legajo integer,
  cuil text,
  categoria text,
  etiqueta_basico text,
  sueldo_basico numeric(14,2),
  adicional_antiguedad numeric(14,2),
  antiguedad_reconocida integer,
  scvo numeric(14,2),
  banco text,
  cbu text,
  forma_pago text,
  conyuge boolean,
  hijos integer,
  cct boolean,
  cct_codigo text,
  cobertura_scvo boolean,
  situacion_revista text,
  condicion text,
  actividad text,
  modalidad text,
  codigo_os text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rrhh_libro_sueldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_libro_sueldos_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_sueldo_fichas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rrhh_libro_sueldos_all ON public.rrhh_libro_sueldos;
CREATE POLICY rrhh_libro_sueldos_all ON public.rrhh_libro_sueldos
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rrhh_libro_sueldos_items_all ON public.rrhh_libro_sueldos_items;
CREATE POLICY rrhh_libro_sueldos_items_all ON public.rrhh_libro_sueldos_items
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rrhh_sueldo_fichas_all ON public.rrhh_sueldo_fichas;
CREATE POLICY rrhh_sueldo_fichas_all ON public.rrhh_sueldo_fichas
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.rrhh_libro_sueldos TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_libro_sueldos_items TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_sueldo_fichas TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.rrhh_libro_sueldos_id_seq TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.rrhh_libro_sueldos_items_id_seq TO anon, authenticated, service_role;
