-- Operarios externos Plot Design / Bolsa Plot: roles, solicitudes, pedido en jobs

BEGIN;

-- ─── Roles operario-diseno y operario-bolsa ───────────────────────────────────
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_rol_check CHECK (
    rol IN (
      'administracion',
      'gerencia',
      'recursos-humanos',
      'diseno',
      'imprenta',
      'taller-grafico',
      'instalaciones',
      'metalurgica',
      'caja',
      'mostrador',
      'compras',
      'asesor-tecnico',
      'presupuestos',
      'operario-diseno',
      'operario-bolsa'
    )
  );

-- ─── Solicitudes de alta (formulario público → aprobación admin) ────────────────
CREATE TABLE IF NOT EXISTS public.work_pool_solicitudes (
  id serial PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('diseno', 'bolsa')),
  nombre_completo text NOT NULL,
  email text NOT NULL,
  telefono text,
  documento text,
  portfolio_url text,
  mensaje text,
  skills text[] NOT NULL DEFAULT '{}',
  zona_cobertura text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  id_usuario_creado integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  revisado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  notas_admin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_pool_solicitudes_estado ON public.work_pool_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_work_pool_solicitudes_tipo ON public.work_pool_solicitudes(tipo);

ALTER TABLE public.work_pool_solicitudes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS work_pool_solicitudes_all ON public.work_pool_solicitudes;
CREATE POLICY work_pool_solicitudes_all ON public.work_pool_solicitudes FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_pool_solicitudes TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.work_pool_solicitudes_id_seq TO anon, authenticated;

-- ─── Pedido portal en trabajos (sin exponer OP al operario externo) ───────────
ALTER TABLE public.work_pool_jobs
  ADD COLUMN IF NOT EXISTS id_pedido_cliente integer REFERENCES public.pedidos_clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_pedido text;

CREATE INDEX IF NOT EXISTS idx_work_pool_jobs_pedido ON public.work_pool_jobs(id_pedido_cliente);

-- ─── Enviar solicitud (formulario público) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_enviar_solicitud(
  p_tipo text,
  p_nombre_completo text,
  p_email text,
  p_telefono text DEFAULT NULL,
  p_documento text DEFAULT NULL,
  p_portfolio_url text DEFAULT NULL,
  p_mensaje text DEFAULT NULL,
  p_skills text[] DEFAULT '{}',
  p_zona_cobertura text DEFAULT NULL
)
RETURNS TABLE (id integer, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
BEGIN
  IF p_tipo NOT IN ('diseno', 'bolsa') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;
  IF NULLIF(trim(p_nombre_completo), '') IS NULL OR NULLIF(trim(p_email), '') IS NULL THEN
    RAISE EXCEPTION 'nombre y email son obligatorios';
  END IF;

  INSERT INTO public.work_pool_solicitudes (
    tipo, nombre_completo, email, telefono, documento, portfolio_url, mensaje, skills, zona_cobertura
  ) VALUES (
    p_tipo,
    trim(p_nombre_completo),
    lower(trim(p_email)),
    NULLIF(trim(p_telefono), ''),
    NULLIF(trim(p_documento), ''),
    NULLIF(trim(p_portfolio_url), ''),
    NULLIF(trim(p_mensaje), ''),
    COALESCE(p_skills, '{}'),
    NULLIF(trim(p_zona_cobertura), '')
  )
  RETURNING work_pool_solicitudes.id INTO v_id;

  RETURN QUERY SELECT v_id, 'pendiente'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_enviar_solicitud TO anon, authenticated;

-- ─── Aprobar solicitud → usuario + perfil bolsa ───────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_aprobar_solicitud(
  p_id_solicitud integer,
  p_id_admin integer,
  p_usuario_login text,
  p_password text,
  p_notas_admin text DEFAULT NULL
)
RETURNS TABLE (id_usuario integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sol RECORD;
  v_rol text;
  v_sector text;
  v_uid integer;
  v_nombre text;
BEGIN
  SELECT * INTO v_sol FROM public.work_pool_solicitudes WHERE id = p_id_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'solicitud no encontrada'; END IF;
  IF v_sol.estado <> 'pendiente' THEN RAISE EXCEPTION 'la solicitud ya fue procesada'; END IF;
  IF NULLIF(trim(p_usuario_login), '') IS NULL OR NULLIF(p_password, '') IS NULL THEN
    RAISE EXCEPTION 'usuario y contraseña obligatorios';
  END IF;

  v_rol := CASE v_sol.tipo WHEN 'diseno' THEN 'operario-diseno' ELSE 'operario-bolsa' END;
  v_sector := CASE v_sol.tipo WHEN 'diseno' THEN 'diseno' ELSE 'instalaciones' END;
  v_nombre := trim(p_usuario_login);

  INSERT INTO public.usuarios (nombre, rol, password_hash, activo)
  VALUES (
    v_nombre,
    v_rol,
    crypt(p_password, gen_salt('bf')),
    true
  )
  RETURNING usuarios.id INTO v_uid;

  INSERT INTO public.work_pool_profiles (id_usuario, sector, skills, zona_cobertura, activo, aprobado, notas_admin)
  VALUES (
    v_uid,
    v_sector,
    COALESCE(v_sol.skills, '{}'),
    v_sol.zona_cobertura,
    true,
    true,
    COALESCE(NULLIF(trim(p_notas_admin), ''), v_sol.mensaje)
  )
  ON CONFLICT (id_usuario, sector) DO UPDATE SET
    skills = EXCLUDED.skills,
    zona_cobertura = EXCLUDED.zona_cobertura,
    aprobado = true,
    activo = true,
    notas_admin = EXCLUDED.notas_admin,
    updated_at = now();

  IF v_sol.tipo = 'bolsa' THEN
    INSERT INTO public.work_pool_profiles (id_usuario, sector, skills, zona_cobertura, activo, aprobado)
    VALUES (v_uid, 'metalurgica', COALESCE(v_sol.skills, '{}'), v_sol.zona_cobertura, true, true)
    ON CONFLICT (id_usuario, sector) DO UPDATE SET aprobado = true, activo = true, updated_at = now();
  END IF;

  UPDATE public.work_pool_solicitudes
  SET estado = 'aprobada',
      id_usuario_creado = v_uid,
      revisado_por = p_id_admin,
      notas_admin = NULLIF(trim(p_notas_admin), ''),
      updated_at = now()
  WHERE id = p_id_solicitud;

  RETURN QUERY SELECT v_uid, v_nombre, v_rol;
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_aprobar_solicitud TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.work_pool_rechazar_solicitud(
  p_id_solicitud integer,
  p_id_admin integer,
  p_notas_admin text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.work_pool_solicitudes
  SET estado = 'rechazada',
      revisado_por = p_id_admin,
      notas_admin = NULLIF(trim(p_notas_admin), ''),
      updated_at = now()
  WHERE id = p_id_solicitud AND estado = 'pendiente';
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_rechazar_solicitud TO anon, authenticated;

-- ─── Crear job con pedido portal (asignación manual desde Plot Design) ────────
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
  p_prioridad text DEFAULT 'normal',
  p_id_pedido_cliente integer DEFAULT NULL,
  p_numero_pedido text DEFAULT NULL
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
  v_asignado_rol text;
  v_modo text;
BEGIN
  IF p_sector NOT IN ('diseno', 'instalaciones', 'metalurgica') THEN
    RAISE EXCEPTION 'sector inválido';
  END IF;
  v_modo := COALESCE(p_modo, 'bolsa');
  IF v_modo NOT IN ('bolsa', 'asignado') THEN
    RAISE EXCEPTION 'modo inválido';
  END IF;

  IF p_id_usuario_asignado IS NOT NULL THEN
    SELECT u.rol INTO v_asignado_rol FROM public.usuarios u WHERE u.id = p_id_usuario_asignado;
    IF v_asignado_rol IN ('operario-diseno', 'operario-bolsa') THEN
      v_modo := 'asignado';
    END IF;
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
    CASE
      WHEN NULLIF(trim(p_numero_pedido), '') IS NOT NULL THEN
        'Pedido ' || trim(p_numero_pedido)
      WHEN p_sector = 'diseno' THEN 'Diseño OP ' || COALESCE(v_numero_op, '#' || COALESCE(v_orden_id::text, '?'))
      WHEN p_sector = 'instalaciones' THEN 'Instalación OP ' || COALESCE(v_numero_op, '#' || COALESCE(v_orden_id::text, '?'))
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

  IF v_modo = 'asignado' AND p_id_usuario_asignado IS NOT NULL THEN
    v_estado := 'asignado';
  ELSE
    v_estado := 'disponible';
  END IF;

  INSERT INTO public.work_pool_jobs (
    sector, id_orden, numero_op, titulo, descripcion, modo, estado, prioridad, plazo,
    monto_presupuestado, codigo_tarifa, id_usuario_creador, id_usuario_asignado,
    id_pedido_cliente, numero_pedido, tomado_at
  ) VALUES (
    p_sector, v_orden_id, v_numero_op, v_titulo, p_descripcion, v_modo, v_estado, COALESCE(p_prioridad, 'normal'),
    p_plazo, v_monto, NULLIF(trim(p_codigo_tarifa), ''), p_id_usuario_creador, p_id_usuario_asignado,
    p_id_pedido_cliente, NULLIF(trim(p_numero_pedido), ''),
    CASE WHEN v_estado IN ('asignado', 'en_curso') THEN now() ELSE NULL END
  )
  RETURNING work_pool_jobs.id INTO v_job_id;

  PERFORM public.work_pool_log_event(v_job_id, 'creado', v_estado, p_id_usuario_creador);

  RETURN QUERY
  SELECT j.id, j.sector, j.numero_op, j.estado, j.monto_presupuestado, j.modo
  FROM public.work_pool_jobs j WHERE j.id = v_job_id;
END;
$$;

COMMIT;
