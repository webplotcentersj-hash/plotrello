-- Solicitudes de alta de cliente: formulario público (/alta-cliente) → bandeja en la app
-- (/clientes/solicitudes) → al aceptar se crea el cliente en public.clientes.
--
-- La tabla no se expone a anon: todo pasa por funciones SECURITY DEFINER.
--   crear_solicitud_alta_cliente   → público (anon), con honeypot y límite por email/teléfono.
--   listar_solicitudes_alta_cliente / aceptar_… / rechazar_… → personal (actor_puede_gestionar_clientes).

CREATE TABLE IF NOT EXISTS public.solicitudes_alta_cliente (
  id bigserial PRIMARY KEY,
  nombre text NOT NULL,
  apellido text NOT NULL,
  dni_cuit text NOT NULL,
  telefono text NOT NULL,
  direccion text NOT NULL,
  email text NOT NULL,
  condicion_iva text NOT NULL
    CHECK (condicion_iva IN ('Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final', 'No Responsable')),
  razon_social text,
  observaciones text,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  motivo_rechazo text,
  id_cliente integer REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_existente boolean NOT NULL DEFAULT false,
  revisado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  revisado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_alta_cliente_estado
  ON public.solicitudes_alta_cliente (estado, created_at DESC);

ALTER TABLE public.solicitudes_alta_cliente ENABLE ROW LEVEL SECURITY;
-- Sin políticas: anon / authenticated no leen ni escriben la tabla directo.
REVOKE ALL ON public.solicitudes_alta_cliente FROM anon, authenticated;

-- Solo dígitos (para comparar DNI / CUIT).
CREATE OR REPLACE FUNCTION public.solo_digitos(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT regexp_replace(COALESCE(p, ''), '\D', '', 'g') $$;

-- ——— Público: crear solicitud ———
CREATE OR REPLACE FUNCTION public.crear_solicitud_alta_cliente(
  p_nombre text,
  p_apellido text,
  p_dni_cuit text,
  p_telefono text,
  p_direccion text,
  p_email text,
  p_condicion_iva text,
  p_razon_social text DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_honeypot text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id bigint;
  v_iva text;
  v_doc text := public.solo_digitos(p_dni_cuit);
  v_tel text := public.solo_digitos(p_telefono);
  v_email text := lower(trim(COALESCE(p_email, '')));
BEGIN
  -- Bot: campo oculto completado → se descarta en silencio.
  IF NULLIF(trim(COALESCE(p_honeypot, '')), '') IS NOT NULL THEN
    RETURN 0;
  END IF;

  IF NULLIF(trim(COALESCE(p_nombre, '')), '') IS NULL OR NULLIF(trim(COALESCE(p_apellido, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Nombre y apellido son obligatorios';
  END IF;
  IF length(v_doc) NOT IN (7, 8, 11) THEN
    RAISE EXCEPTION 'El DNI debe tener 7 u 8 dígitos y el CUIT/CUIL 11';
  END IF;
  IF length(v_tel) < 8 THEN
    RAISE EXCEPTION 'El teléfono debe tener al menos 8 dígitos';
  END IF;
  IF NULLIF(trim(COALESCE(p_direccion, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El domicilio es obligatorio';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'El email no es válido';
  END IF;
  v_iva := public.normalizar_condicion_iva_cliente(p_condicion_iva);
  IF v_iva IS NULL THEN
    RAISE EXCEPTION 'Elegí la condición frente al IVA';
  END IF;
  IF v_iva IN ('Responsable Inscripto', 'Monotributista', 'Exento') AND length(v_doc) <> 11 THEN
    RAISE EXCEPTION 'Para % hace falta el CUIT (11 dígitos)', v_iva;
  END IF;
  IF length(trim(p_nombre)) > 120 OR length(trim(p_apellido)) > 120 OR length(trim(p_direccion)) > 300
     OR length(COALESCE(p_observaciones, '')) > 1000 OR length(COALESCE(p_razon_social, '')) > 200 THEN
    RAISE EXCEPTION 'Algún dato es demasiado largo';
  END IF;

  -- Límite: 3 por email o teléfono por hora.
  IF (
    SELECT count(*) FROM public.solicitudes_alta_cliente s
    WHERE s.created_at > now() - interval '1 hour'
      AND (lower(s.email) = v_email OR public.solo_digitos(s.telefono) = v_tel)
  ) >= 3 THEN
    RAISE EXCEPTION 'Ya recibimos tu solicitud. Si necesitás corregir algo, escribinos.';
  END IF;

  INSERT INTO public.solicitudes_alta_cliente (
    nombre, apellido, dni_cuit, telefono, direccion, email, condicion_iva, razon_social, observaciones
  ) VALUES (
    trim(p_nombre), trim(p_apellido), v_doc, trim(p_telefono), trim(p_direccion), v_email, v_iva,
    NULLIF(trim(COALESCE(p_razon_social, '')), ''), NULLIF(trim(COALESCE(p_observaciones, '')), '')
  ) RETURNING id INTO v_id;

  -- Aviso al personal que da de alta clientes.
  INSERT INTO public.user_notifications (user_id, title, description, type, is_read, origen, related_id)
  SELECT
    u.id,
    'Nueva solicitud de alta de cliente',
    trim(p_nombre) || ' ' || trim(p_apellido) || ' · ' || v_iva || ' · ' || v_doc,
    'info',
    false,
    'solicitud_alta_cliente',
    'solicitud-alta-cliente:' || v_id
  FROM public.usuarios u
  WHERE COALESCE(u.activo, true) = true
    AND u.rol = ANY (ARRAY['admin', 'gerencia', 'presupuestos', 'mostrador', 'caja']);

  RETURN v_id;
END;
$$;

-- ——— Personal: listar ———
CREATE OR REPLACE FUNCTION public.listar_solicitudes_alta_cliente(
  p_actor_id integer,
  p_estado text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  nombre text,
  apellido text,
  dni_cuit text,
  telefono text,
  direccion text,
  email text,
  condicion_iva text,
  razon_social text,
  observaciones text,
  estado text,
  motivo_rechazo text,
  id_cliente integer,
  cliente_existente boolean,
  revisado_por integer,
  revisado_por_nombre text,
  revisado_at timestamptz,
  created_at timestamptz,
  posible_duplicado_id integer,
  posible_duplicado_nombre text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;
  RETURN QUERY
  SELECT
    s.id, s.nombre, s.apellido, s.dni_cuit, s.telefono, s.direccion, s.email, s.condicion_iva,
    s.razon_social, s.observaciones, s.estado, s.motivo_rechazo, s.id_cliente, s.cliente_existente,
    s.revisado_por, u.nombre::text, s.revisado_at, s.created_at,
    dup.id, dup.nombre
  FROM public.solicitudes_alta_cliente s
  LEFT JOIN public.usuarios u ON u.id = s.revisado_por
  LEFT JOIN LATERAL (
    SELECT c.id, trim(c.nombre || ' ' || COALESCE(c.apellido, ''))::text AS nombre
    FROM public.clientes c
    WHERE (length(s.dni_cuit) >= 7 AND (
            public.solo_digitos(c.dni_cuit) = s.dni_cuit
            -- DNI dentro del CUIT/CUIL (posiciones 3 a 10).
            OR (length(s.dni_cuit) = 11 AND public.solo_digitos(c.dni_cuit) = ltrim(substr(s.dni_cuit, 3, 8), '0'))
            OR (length(s.dni_cuit) <= 8 AND length(public.solo_digitos(c.dni_cuit)) = 11
                AND ltrim(substr(public.solo_digitos(c.dni_cuit), 3, 8), '0') = ltrim(s.dni_cuit, '0'))
          ))
       OR (s.email <> '' AND lower(c.email) = s.email)
    ORDER BY c.id
    LIMIT 1
  ) dup ON s.estado = 'pendiente'
  WHERE p_estado IS NULL OR s.estado = p_estado
  ORDER BY (s.estado = 'pendiente') DESC, s.created_at DESC
  LIMIT 500;
END;
$$;

-- ——— Personal: aceptar (crea el cliente, o vincula uno existente) ———
CREATE OR REPLACE FUNCTION public.aceptar_solicitud_alta_cliente(
  p_id bigint,
  p_actor_id integer,
  p_vincular_cliente_id integer DEFAULT NULL,
  -- Correcciones del personal antes de dar el alta (NULL = lo que mandó el cliente).
  p_nombre text DEFAULT NULL,
  p_apellido text DEFAULT NULL,
  p_dni_cuit text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_condicion_iva text DEFAULT NULL,
  p_razon_social text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.solicitudes_alta_cliente;
  v_cliente integer;
  v_existente boolean := false;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;
  SELECT * INTO s FROM public.solicitudes_alta_cliente WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;
  IF s.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya fue %', s.estado;
  END IF;

  IF p_vincular_cliente_id IS NOT NULL THEN
    -- Ya era cliente: se vincula y se completan los datos que la ficha no tenía.
    IF NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = p_vincular_cliente_id) THEN
      RAISE EXCEPTION 'Cliente a vincular no encontrado';
    END IF;
    UPDATE public.clientes c SET
      apellido = COALESCE(NULLIF(c.apellido, ''), COALESCE(p_apellido, s.apellido)),
      dni_cuit = COALESCE(NULLIF(c.dni_cuit, ''), COALESCE(p_dni_cuit, s.dni_cuit)),
      telefono = COALESCE(NULLIF(c.telefono, ''), COALESCE(p_telefono, s.telefono)),
      direccion = COALESCE(NULLIF(c.direccion, ''), COALESCE(p_direccion, s.direccion)),
      email = COALESCE(NULLIF(c.email, ''),
        CASE WHEN EXISTS (SELECT 1 FROM public.clientes x WHERE lower(x.email) = lower(COALESCE(p_email, s.email)) AND x.id <> c.id)
             THEN NULL ELSE COALESCE(p_email, s.email) END),
      condicion_iva = COALESCE(c.condicion_iva, public.normalizar_condicion_iva_cliente(COALESCE(p_condicion_iva, s.condicion_iva))),
      empresa = COALESCE(NULLIF(c.empresa, ''), NULLIF(COALESCE(p_razon_social, s.razon_social), '')),
      updated_at = now()
    WHERE c.id = p_vincular_cliente_id;
    v_cliente := p_vincular_cliente_id;
    v_existente := true;
  ELSE
    SELECT r.id INTO v_cliente
    FROM public.crear_cliente_sin_acceso(
      (trim(COALESCE(p_nombre, s.nombre)))::varchar,
      (trim(COALESCE(p_apellido, s.apellido)))::varchar,
      (NULLIF(trim(COALESCE(p_razon_social, s.razon_social, '')), ''))::varchar,
      (trim(COALESCE(p_telefono, s.telefono)))::varchar,
      (lower(trim(COALESCE(p_email, s.email))))::varchar,
      (public.solo_digitos(COALESCE(p_dni_cuit, s.dni_cuit)))::varchar,
      trim(COALESCE(p_direccion, s.direccion)),
      p_actor_id,
      COALESCE(p_condicion_iva, s.condicion_iva)
    ) r;
  END IF;

  UPDATE public.solicitudes_alta_cliente SET
    estado = 'aceptada',
    id_cliente = v_cliente,
    cliente_existente = v_existente,
    revisado_por = p_actor_id,
    revisado_at = now()
  WHERE id = p_id;

  RETURN v_cliente;
END;
$$;

-- ——— Personal: rechazar ———
CREATE OR REPLACE FUNCTION public.rechazar_solicitud_alta_cliente(
  p_id bigint,
  p_actor_id integer,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;
  UPDATE public.solicitudes_alta_cliente SET
    estado = 'rechazada',
    motivo_rechazo = NULLIF(trim(COALESCE(p_motivo, '')), ''),
    revisado_por = p_actor_id,
    revisado_at = now()
  WHERE id = p_id AND estado = 'pendiente';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud no está pendiente';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_solicitud_alta_cliente(text, text, text, text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_alta_cliente(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_solicitud_alta_cliente(bigint, integer, integer, text, text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_solicitud_alta_cliente(bigint, integer, text) TO anon, authenticated;
