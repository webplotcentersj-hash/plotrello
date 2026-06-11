-- PlotBolsa: bolsa de trabajos (diseño, instalaciones, metalúrgica) + ledger económico
-- MVP: crear job desde OP, bolsa/claim, entregar, aprobar → acreditación, pagos

BEGIN;

-- ─── Tarifario base ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_pool_pricing_rules (
  id serial PRIMARY KEY,
  sector text NOT NULL CHECK (sector IN ('diseno', 'instalaciones', 'metalurgica')),
  codigo text NOT NULL,
  nombre text NOT NULL,
  monto_base numeric(12, 2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector, codigo)
);

INSERT INTO public.work_pool_pricing_rules (sector, codigo, nombre, monto_base) VALUES
  ('diseno', 'logo_simple', 'Logo simple', 25000),
  ('diseno', 'banner', 'Banner / lona', 18000),
  ('diseno', 'senaletica', 'Señalética / vinilo', 22000),
  ('diseno', 'vehicular', 'Diseño vehicular', 30000),
  ('diseno', 'retoque', 'Retoque / adaptación', 12000),
  ('instalaciones', 'visita_base', 'Visita e instalación base', 35000),
  ('instalaciones', 'altura', 'Trabajo en altura', 55000),
  ('instalaciones', 'vidriera', 'Instalación vidriera', 42000),
  ('instalaciones', 'urgente', 'Urgente (recargo sugerido)', 15000),
  ('metalurgica', 'pieza_simple', 'Pieza simple taller', 28000),
  ('metalurgica', 'estructura', 'Estructura / soporte', 45000),
  ('metalurgica', 'soldadura', 'Soldadura especializada', 38000),
  ('metalurgica', 'pintura', 'Pintura / tratamiento', 32000)
ON CONFLICT (sector, codigo) DO NOTHING;

-- ─── Perfil operario en la bolsa ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_pool_profiles (
  id serial PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  sector text NOT NULL CHECK (sector IN ('diseno', 'instalaciones', 'metalurgica')),
  skills text[] NOT NULL DEFAULT '{}',
  zona_cobertura text,
  activo boolean NOT NULL DEFAULT true,
  aprobado boolean NOT NULL DEFAULT false,
  notas_admin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_usuario, sector)
);

CREATE INDEX IF NOT EXISTS idx_work_pool_profiles_sector ON public.work_pool_profiles(sector);
CREATE INDEX IF NOT EXISTS idx_work_pool_profiles_usuario ON public.work_pool_profiles(id_usuario);

-- ─── Trabajos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_pool_jobs (
  id serial PRIMARY KEY,
  sector text NOT NULL CHECK (sector IN ('diseno', 'instalaciones', 'metalurgica')),
  id_orden integer REFERENCES public.ordenes_trabajo(id) ON DELETE SET NULL,
  numero_op varchar(50),
  titulo text NOT NULL,
  descripcion text,
  modo text NOT NULL DEFAULT 'bolsa' CHECK (modo IN ('bolsa', 'asignado')),
  estado text NOT NULL DEFAULT 'borrador' CHECK (
    estado IN (
      'borrador', 'disponible', 'asignado', 'en_curso', 'entregado',
      'en_revision', 'aprobado', 'cambios', 'cancelado'
    )
  ),
  prioridad text NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
  plazo date,
  monto_presupuestado numeric(12, 2) NOT NULL DEFAULT 0,
  monto_final numeric(12, 2),
  moneda text NOT NULL DEFAULT 'ARS',
  id_usuario_asignado integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  id_usuario_creador integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  codigo_tarifa text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  notas_entrega text,
  motivo_rechazo text,
  tomado_at timestamptz,
  entregado_at timestamptz,
  aprobado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_pool_jobs_sector_estado ON public.work_pool_jobs(sector, estado);
CREATE INDEX IF NOT EXISTS idx_work_pool_jobs_orden ON public.work_pool_jobs(id_orden);
CREATE INDEX IF NOT EXISTS idx_work_pool_jobs_asignado ON public.work_pool_jobs(id_usuario_asignado);
CREATE INDEX IF NOT EXISTS idx_work_pool_jobs_numero_op ON public.work_pool_jobs(numero_op);

-- ─── Ledger económico ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_pool_ledger (
  id serial PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  id_job integer REFERENCES public.work_pool_jobs(id) ON DELETE SET NULL,
  sector text CHECK (sector IN ('diseno', 'instalaciones', 'metalurgica')),
  tipo text NOT NULL CHECK (tipo IN ('acreditacion', 'pago', 'ajuste', 'reverso')),
  monto numeric(12, 2) NOT NULL,
  estado text NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('pendiente', 'confirmado', 'anulado')),
  notas text,
  registrado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_pool_ledger_usuario ON public.work_pool_ledger(id_usuario);
CREATE INDEX IF NOT EXISTS idx_work_pool_ledger_job ON public.work_pool_ledger(id_job);

-- ─── Eventos / auditoría ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_pool_job_events (
  id serial PRIMARY KEY,
  id_job integer NOT NULL REFERENCES public.work_pool_jobs(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  detalle text,
  id_usuario integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_pool_job_events_job ON public.work_pool_job_events(id_job);

-- ─── RLS permisiva (mismo patrón control-cajas / plotrello anon) ─────────────
ALTER TABLE public.work_pool_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_pool_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_pool_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_pool_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_pool_job_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_pool_pricing_rules_all ON public.work_pool_pricing_rules;
CREATE POLICY work_pool_pricing_rules_all ON public.work_pool_pricing_rules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_pool_profiles_all ON public.work_pool_profiles;
CREATE POLICY work_pool_profiles_all ON public.work_pool_profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_pool_jobs_all ON public.work_pool_jobs;
CREATE POLICY work_pool_jobs_all ON public.work_pool_jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_pool_ledger_all ON public.work_pool_ledger;
CREATE POLICY work_pool_ledger_all ON public.work_pool_ledger FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_pool_job_events_all ON public.work_pool_job_events;
CREATE POLICY work_pool_job_events_all ON public.work_pool_job_events FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_pool_pricing_rules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_pool_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_pool_jobs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_pool_ledger TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_pool_job_events TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ─── Helper: registrar evento ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_log_event(
  p_id_job integer,
  p_tipo text,
  p_detalle text DEFAULT NULL,
  p_id_usuario integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.work_pool_job_events (id_job, tipo, detalle, id_usuario)
  VALUES (p_id_job, p_tipo, p_detalle, p_id_usuario);
END;
$$;

-- ─── Crear trabajo desde OP ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_crear_job(
  p_sector text,
  p_numero_op text DEFAULT NULL,
  p_id_orden integer DEFAULT NULL,
  p_titulo text DEFAULT NULL,
  p_descripcion text DEFAULT NULL,
  p_modo text DEFAULT 'bolsa',
  p_monto numeric DEFAULT NULL,
  p_codigo_tarifa text DEFAULT NULL,
  p_id_usuario_creador integer DEFAULT NULL,
  p_id_usuario_asignado integer DEFAULT NULL,
  p_plazo date DEFAULT NULL,
  p_prioridad text DEFAULT 'normal'
)
RETURNS TABLE (
  id integer,
  sector text,
  numero_op varchar,
  estado text,
  monto_presupuestado numeric,
  modo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orden_id integer;
  v_numero_op varchar(50);
  v_titulo text;
  v_monto numeric(12, 2);
  v_estado text;
  v_job_id integer;
BEGIN
  IF p_sector NOT IN ('diseno', 'instalaciones', 'metalurgica') THEN
    RAISE EXCEPTION 'sector inválido';
  END IF;
  IF COALESCE(p_modo, 'bolsa') NOT IN ('bolsa', 'asignado') THEN
    RAISE EXCEPTION 'modo inválido';
  END IF;

  v_orden_id := p_id_orden;
  IF v_orden_id IS NULL AND NULLIF(trim(p_numero_op), '') IS NOT NULL THEN
    SELECT o.id, o.numero_op::varchar
    INTO v_orden_id, v_numero_op
    FROM public.ordenes_trabajo o
    WHERE o.numero_op::text = trim(p_numero_op)
      AND COALESCE(o.eliminada, false) = false
    ORDER BY o.fecha_creacion DESC NULLS LAST, o.id DESC
    LIMIT 1;
  ELSIF v_orden_id IS NOT NULL THEN
    SELECT o.numero_op::varchar INTO v_numero_op
    FROM public.ordenes_trabajo o WHERE o.id = v_orden_id;
  END IF;

  v_titulo := COALESCE(NULLIF(trim(p_titulo), ''),
    CASE p_sector
      WHEN 'diseno' THEN 'Diseño OP ' || COALESCE(v_numero_op, '#' || COALESCE(v_orden_id::text, '?'))
      WHEN 'instalaciones' THEN 'Instalación OP ' || COALESCE(v_numero_op, '#' || COALESCE(v_orden_id::text, '?'))
      ELSE 'Metalúrgica OP ' || COALESCE(v_numero_op, '#' || COALESCE(v_orden_id::text, '?'))
    END);

  v_monto := COALESCE(p_monto, 0);
  IF v_monto <= 0 AND NULLIF(trim(p_codigo_tarifa), '') IS NOT NULL THEN
    SELECT pr.monto_base INTO v_monto
    FROM public.work_pool_pricing_rules pr
    WHERE pr.sector = p_sector AND pr.codigo = trim(p_codigo_tarifa) AND pr.activo = true
    LIMIT 1;
    v_monto := COALESCE(v_monto, 0);
  END IF;

  IF p_modo = 'asignado' AND p_id_usuario_asignado IS NOT NULL THEN
    v_estado := 'asignado';
  ELSE
    v_estado := 'disponible';
  END IF;

  INSERT INTO public.work_pool_jobs (
    sector, id_orden, numero_op, titulo, descripcion, modo, estado, prioridad, plazo,
    monto_presupuestado, codigo_tarifa, id_usuario_creador, id_usuario_asignado,
    tomado_at
  ) VALUES (
    p_sector, v_orden_id, v_numero_op, v_titulo, p_descripcion, p_modo, v_estado, COALESCE(p_prioridad, 'normal'),
    p_plazo, v_monto, NULLIF(trim(p_codigo_tarifa), ''), p_id_usuario_creador, p_id_usuario_asignado,
    CASE WHEN v_estado IN ('asignado', 'en_curso') THEN now() ELSE NULL END
  )
  RETURNING work_pool_jobs.id INTO v_job_id;

  PERFORM public.work_pool_log_event(v_job_id, 'creado', v_estado, p_id_usuario_creador);

  RETURN QUERY
  SELECT j.id, j.sector, j.numero_op, j.estado, j.monto_presupuestado, j.modo
  FROM public.work_pool_jobs j WHERE j.id = v_job_id;
END;
$$;

-- ─── Tomar trabajo (claim) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_tomar_job(
  p_id_job integer,
  p_id_usuario integer
)
RETURNS TABLE (id integer, estado text, id_usuario_asignado integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
BEGIN
  SELECT j.estado INTO v_estado FROM public.work_pool_jobs j WHERE j.id = p_id_job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trabajo no encontrado'; END IF;
  IF v_estado NOT IN ('disponible') THEN RAISE EXCEPTION 'El trabajo no está disponible (estado: %)', v_estado; END IF;

  UPDATE public.work_pool_jobs j
  SET estado = 'en_curso',
      id_usuario_asignado = p_id_usuario,
      tomado_at = now(),
      updated_at = now()
  WHERE j.id = p_id_job;

  PERFORM public.work_pool_log_event(p_id_job, 'tomado', NULL, p_id_usuario);

  RETURN QUERY SELECT j.id, j.estado, j.id_usuario_asignado FROM public.work_pool_jobs j WHERE j.id = p_id_job;
END;
$$;

-- ─── Entregar trabajo ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_entregar_job(
  p_id_job integer,
  p_id_usuario integer,
  p_notas text DEFAULT NULL
)
RETURNS TABLE (id integer, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asignado integer;
  v_estado text;
BEGIN
  SELECT j.estado, j.id_usuario_asignado INTO v_estado, v_asignado
  FROM public.work_pool_jobs j WHERE j.id = p_id_job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trabajo no encontrado'; END IF;
  IF v_estado NOT IN ('en_curso', 'asignado', 'cambios') THEN
    RAISE EXCEPTION 'No se puede entregar en estado %', v_estado;
  END IF;
  IF v_asignado IS NOT NULL AND v_asignado <> p_id_usuario THEN
    RAISE EXCEPTION 'Este trabajo está asignado a otro operario';
  END IF;

  UPDATE public.work_pool_jobs j
  SET estado = 'entregado',
      notas_entrega = p_notas,
      entregado_at = now(),
      updated_at = now()
  WHERE j.id = p_id_job;

  PERFORM public.work_pool_log_event(p_id_job, 'entregado', p_notas, p_id_usuario);

  RETURN QUERY SELECT j.id, j.estado FROM public.work_pool_jobs j WHERE j.id = p_id_job;
END;
$$;

-- ─── Aprobar → acredita ledger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_aprobar_job(
  p_id_job integer,
  p_id_usuario_aprobador integer,
  p_monto_final numeric DEFAULT NULL
)
RETURNS TABLE (id integer, estado text, monto_final numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.work_pool_jobs%ROWTYPE;
  v_monto numeric(12, 2);
BEGIN
  SELECT * INTO v_job FROM public.work_pool_jobs j WHERE j.id = p_id_job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trabajo no encontrado'; END IF;
  IF v_job.estado NOT IN ('entregado', 'en_revision') THEN
    RAISE EXCEPTION 'Solo se aprueban trabajos entregados (estado: %)', v_job.estado;
  END IF;
  IF v_job.id_usuario_asignado IS NULL THEN
    RAISE EXCEPTION 'El trabajo no tiene operario asignado';
  END IF;

  v_monto := COALESCE(p_monto_final, v_job.monto_final, v_job.monto_presupuestado, 0);
  IF v_monto <= 0 THEN RAISE EXCEPTION 'Monto final inválido'; END IF;

  UPDATE public.work_pool_jobs j
  SET estado = 'aprobado',
      monto_final = v_monto,
      aprobado_at = now(),
      updated_at = now()
  WHERE j.id = p_id_job;

  INSERT INTO public.work_pool_ledger (
    id_usuario, id_job, sector, tipo, monto, estado, notas, registrado_por
  ) VALUES (
    v_job.id_usuario_asignado, p_id_job, v_job.sector, 'acreditacion', v_monto, 'confirmado',
    'Aprobación trabajo #' || p_id_job, p_id_usuario_aprobador
  );

  PERFORM public.work_pool_log_event(p_id_job, 'aprobado', 'Monto: ' || v_monto::text, p_id_usuario_aprobador);

  RETURN QUERY SELECT j.id, j.estado, j.monto_final FROM public.work_pool_jobs j WHERE j.id = p_id_job;
END;
$$;

-- ─── Solicitar cambios ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_solicitar_cambios_job(
  p_id_job integer,
  p_id_usuario integer,
  p_motivo text DEFAULT NULL
)
RETURNS TABLE (id integer, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.work_pool_jobs j
  SET estado = 'cambios',
      motivo_rechazo = p_motivo,
      updated_at = now()
  WHERE j.id = p_id_job AND j.estado IN ('entregado', 'en_revision');

  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo solicitar cambios'; END IF;

  PERFORM public.work_pool_log_event(p_id_job, 'cambios', p_motivo, p_id_usuario);

  RETURN QUERY SELECT j.id, j.estado FROM public.work_pool_jobs j WHERE j.id = p_id_job;
END;
$$;

-- ─── Saldo operario ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_saldo_operario(p_id_usuario integer)
RETURNS TABLE (
  acreditado numeric,
  pagado numeric,
  saldo_pendiente numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN l.tipo = 'acreditacion' AND l.estado = 'confirmado' THEN l.monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'pago' AND l.estado = 'confirmado' THEN ABS(l.monto) ELSE 0 END), 0),
    COALESCE(SUM(
      CASE WHEN l.estado = 'confirmado' THEN
        CASE l.tipo
          WHEN 'acreditacion' THEN l.monto
          WHEN 'pago' THEN l.monto
          WHEN 'ajuste' THEN l.monto
          WHEN 'reverso' THEN l.monto
          ELSE 0
        END
      ELSE 0 END
    ), 0)
  FROM public.work_pool_ledger l
  WHERE l.id_usuario = p_id_usuario;
$$;

-- ─── Resumen Plot (deuda total) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_resumen_plot()
RETURNS TABLE (
  sector text,
  trabajos_abiertos bigint,
  trabajos_aprobados bigint,
  deuda_operarios numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH saldos AS (
    SELECT l.sector, l.id_usuario,
      SUM(CASE WHEN l.estado = 'confirmado' THEN
        CASE l.tipo WHEN 'acreditacion' THEN l.monto WHEN 'pago' THEN l.monto WHEN 'ajuste' THEN l.monto ELSE 0 END
      ELSE 0 END) AS saldo
    FROM public.work_pool_ledger l
    WHERE l.sector IS NOT NULL
    GROUP BY l.sector, l.id_usuario
    HAVING SUM(CASE WHEN l.estado = 'confirmado' THEN
      CASE l.tipo WHEN 'acreditacion' THEN l.monto WHEN 'pago' THEN l.monto WHEN 'ajuste' THEN l.monto ELSE 0 END
    ELSE 0 END) > 0
  )
  SELECT
    s.sector,
    (SELECT COUNT(*) FROM public.work_pool_jobs j
     WHERE j.sector = s.sector AND j.estado NOT IN ('aprobado', 'cancelado'))::bigint,
    (SELECT COUNT(*) FROM public.work_pool_jobs j
     WHERE j.sector = s.sector AND j.estado = 'aprobado')::bigint,
    COALESCE(SUM(s.saldo), 0)
  FROM saldos s
  GROUP BY s.sector
  UNION ALL
  SELECT
    j.sector,
    COUNT(*) FILTER (WHERE j.estado NOT IN ('aprobado', 'cancelado')),
    COUNT(*) FILTER (WHERE j.estado = 'aprobado'),
    0::numeric
  FROM public.work_pool_jobs j
  WHERE NOT EXISTS (SELECT 1 FROM saldos s WHERE s.sector = j.sector)
  GROUP BY j.sector;
$$;

-- ─── Registrar pago a operario ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_registrar_pago(
  p_id_usuario integer,
  p_monto numeric,
  p_notas text DEFAULT NULL,
  p_registrado_por integer DEFAULT NULL
)
RETURNS TABLE (id integer, monto numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'Monto de pago inválido'; END IF;

  INSERT INTO public.work_pool_ledger (
    id_usuario, sector, tipo, monto, estado, notas, registrado_por
  ) VALUES (
    p_id_usuario, NULL, 'pago', -ABS(p_monto), 'confirmado', p_notas, p_registrado_por
  )
  RETURNING work_pool_ledger.id INTO v_id;

  RETURN QUERY SELECT v_id, -ABS(p_monto);
END;
$$;

COMMENT ON TABLE public.work_pool_jobs IS 'PlotBolsa: trabajos externos por sector (diseño, instalaciones, metalúrgica)';
COMMENT ON TABLE public.work_pool_ledger IS 'Movimientos económicos por operario (acreditación al aprobar, pagos Plot)';

COMMIT;
