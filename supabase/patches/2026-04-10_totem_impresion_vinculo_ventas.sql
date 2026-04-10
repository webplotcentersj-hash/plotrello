-- Vincular solicitudes de impresión del tótem a tabla ventas (CRM/caja).
-- Ejecutar si ya aplicaste 2026-04-09_totem_impresion_solicitudes.sql sin id_venta.
BEGIN;

ALTER TABLE public.totem_impresion_solicitudes
  ADD COLUMN IF NOT EXISTS id_venta integer REFERENCES public.ventas (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_totem_impresion_venta ON public.totem_impresion_solicitudes (id_venta);

-- OP opcional en ventas (por si el CRM aún exige NOT NULL en algún entorno)
ALTER TABLE public.ventas ALTER COLUMN id_op DROP NOT NULL;
ALTER TABLE public.ventas ALTER COLUMN numero_op DROP NOT NULL;

-- Permitir Mercado Pago como método (nombre típico del CHECK en CRM)
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check;
ALTER TABLE public.ventas
  ADD CONSTRAINT ventas_metodo_pago_check CHECK (
    metodo_pago IS NULL
    OR metodo_pago IN (
      'Efectivo',
      'Transferencia',
      'Tarjeta',
      'Cheque',
      'Cuenta Corriente',
      'Otro',
      'Mercado Pago'
    )
  );

DROP FUNCTION IF EXISTS public.crear_solicitud_impresion_totem (
  varchar,
  varchar,
  varchar,
  integer,
  varchar,
  varchar,
  text,
  varchar,
  integer,
  varchar
);

DROP FUNCTION IF EXISTS public.listar_solicitudes_impresion_totem (integer, integer);

CREATE OR REPLACE FUNCTION public.crear_solicitud_impresion_totem (
  p_cliente_nombre varchar(255),
  p_cliente_dni varchar(80),
  p_cliente_telefono varchar(80),
  p_cantidad_hojas integer,
  p_tipo_impresion varchar(120),
  p_origen_archivo varchar(40),
  p_archivo_url text,
  p_archivo_nombre varchar(512),
  p_orden_id integer DEFAULT NULL,
  p_numero_op varchar(80) DEFAULT NULL,
  p_valor_total numeric DEFAULT NULL,
  p_id_vendedor integer DEFAULT 1,
  p_nombre_vendedor varchar(100) DEFAULT 'Totem autoservicio'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_id_venta integer;
  v_numero_venta varchar(50);
  v_valor numeric(10, 2);
  v_titulo text := 'Tótem: nueva solicitud de impresión';
  v_desc text;
  v_user record;
  v_obs_venta text;
BEGIN
  v_valor := COALESCE(p_valor_total, 0)::numeric(10, 2);
  IF v_valor < 0.01 THEN
    v_valor := 0.01;
  END IF;

  v_numero_venta := 'VENT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    (coalesce((SELECT max(id) FROM public.ventas), 0) + 1)::text,
    4,
    '0'
  );

  v_obs_venta :=
    'Venta generada desde tótem (impresión). Solicitud se crea al confirmar el pedido.' || E'\n' ||
    'Hojas: ' || p_cantidad_hojas::text || ' | Tipo: ' || trim(p_tipo_impresion) || E'\n' ||
    'Archivo: ' || trim(p_archivo_nombre) || E'\n' ||
    'Link archivo: ' || trim(p_archivo_url);

  INSERT INTO public.ventas (
    numero_venta,
    id_oportunidad,
    cliente_nombre,
    cliente_telefono,
    cliente_email,
    cliente_dni_cuit,
    cliente_empresa,
    cliente_direccion,
    id_op,
    numero_op,
    valor_total,
    metodo_pago,
    estado_pago,
    fecha_venta,
    id_vendedor,
    nombre_vendedor,
    observaciones
  )
  VALUES (
    v_numero_venta,
    NULL,
    trim(p_cliente_nombre),
    trim(p_cliente_telefono),
    NULL,
    trim(p_cliente_dni),
    NULL,
    NULL,
    p_orden_id,
    NULLIF(trim(coalesce(p_numero_op, '')), ''),
    v_valor,
    'Mercado Pago',
    'Pendiente',
    CURRENT_DATE,
    p_id_vendedor,
    trim(p_nombre_vendedor),
    v_obs_venta
  )
  RETURNING id INTO v_id_venta;

  INSERT INTO public.totem_impresion_solicitudes (
    cliente_nombre,
    cliente_dni,
    cliente_telefono,
    cantidad_hojas,
    tipo_impresion,
    origen_archivo,
    archivo_url,
    archivo_nombre,
    orden_id,
    numero_op,
    id_venta
  )
  VALUES (
    trim(p_cliente_nombre),
    trim(p_cliente_dni),
    trim(p_cliente_telefono),
    p_cantidad_hojas,
    trim(p_tipo_impresion),
    trim(p_origen_archivo),
    trim(p_archivo_url),
    trim(p_archivo_nombre),
    p_orden_id,
    NULLIF(trim(coalesce(p_numero_op, '')), ''),
    v_id_venta
  )
  RETURNING id INTO v_id;

  v_desc :=
    'Cliente: ' || trim(p_cliente_nombre) || E'\n' ||
    'DNI/CUIT: ' || trim(p_cliente_dni) || ' | Tel: ' || trim(p_cliente_telefono) || E'\n' ||
    'Hojas: ' || p_cantidad_hojas::text || ' | Tipo: ' || trim(p_tipo_impresion) ||
    ' | Origen archivo: ' || trim(p_origen_archivo) || E'\n' ||
    'Archivo: ' || trim(p_archivo_nombre) || E'\n' ||
    'Descargar: ' || trim(p_archivo_url) || E'\n' ||
    'Solicitud tótem #' || v_id::text || E'\n' ||
    'Venta CRM: ' || v_numero_venta || ' (id ' || v_id_venta::text || ') — $' || trim(to_char(v_valor, 'FM999999990.00')) || E'\n' ||
    'Pago: pendiente (Mercado Pago en caja).';

  FOR v_user IN
    SELECT id FROM public.usuarios
    WHERE rol IN ('imprenta', 'mostrador', 'caja')
  LOOP
    INSERT INTO public.user_notifications (
      user_id,
      title,
      description,
      type,
      is_read,
      orden_id
    ) VALUES (
      v_user.id,
      v_titulo,
      v_desc,
      'info',
      false,
      p_orden_id
    );
  END LOOP;

  RETURN json_build_object(
    'solicitud_id', v_id,
    'venta_id', v_id_venta,
    'numero_venta', v_numero_venta,
    'valor_total', v_valor
  );
END;
$$;

COMMENT ON FUNCTION public.crear_solicitud_impresion_totem IS 'Tótem: crea venta CRM + solicitud impresión; notifica imprenta, mostrador y caja';

CREATE OR REPLACE FUNCTION public.listar_solicitudes_impresion_totem (
  p_usuario_id integer,
  p_limite integer DEFAULT 80
)
RETURNS TABLE (
  id bigint,
  cliente_nombre varchar,
  cliente_dni varchar,
  cliente_telefono varchar,
  cantidad_hojas integer,
  tipo_impresion varchar,
  origen_archivo varchar,
  archivo_url text,
  archivo_nombre varchar,
  numero_op varchar,
  estado_pago text,
  created_at timestamptz,
  pagado_at timestamptz,
  id_venta integer,
  numero_venta_crm varchar,
  valor_venta numeric,
  estado_pago_venta varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('imprenta', 'mostrador', 'caja', 'administracion', 'gerencia')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para listar solicitudes de impresión del tótem';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.cliente_nombre,
    s.cliente_dni,
    s.cliente_telefono,
    s.cantidad_hojas,
    s.tipo_impresion,
    s.origen_archivo,
    s.archivo_url,
    s.archivo_nombre,
    s.numero_op,
    s.estado_pago,
    s.created_at,
    s.pagado_at,
    s.id_venta,
    v.numero_venta,
    v.valor_total,
    v.estado_pago
  FROM public.totem_impresion_solicitudes s
  LEFT JOIN public.ventas v ON v.id = s.id_venta
  ORDER BY s.created_at DESC
  LIMIT greatest(1, least(p_limite, 200));
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_pago_solicitud_impresion_totem (
  p_solicitud_id bigint,
  p_usuario_id integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := false;
  v_row public.totem_impresion_solicitudes%ROWTYPE;
  v_user record;
  v_titulo text := 'Tótem: pago confirmado — impresión';
  v_desc text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('caja', 'administracion', 'gerencia')
  ) THEN
    RAISE EXCEPTION 'Solo caja o administración pueden marcar el pago';
  END IF;

  UPDATE public.totem_impresion_solicitudes s
  SET estado_pago = 'pagado',
      pagado_at = now()
  WHERE s.id = p_solicitud_id
    AND s.estado_pago = 'pendiente'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_row.id_venta IS NOT NULL THEN
    UPDATE public.ventas ve
    SET
      estado_pago = 'Pagado',
      metodo_pago = coalesce(nullif(trim(ve.metodo_pago), ''), 'Mercado Pago'),
      updated_at = now()
    WHERE ve.id = v_row.id_venta;
  END IF;

  v_ok := true;

  v_desc :=
    'Solicitud #' || v_row.id::text || ' — Cliente: ' || v_row.cliente_nombre || E'\n' ||
    'Archivo: ' || v_row.archivo_nombre || E'\n' ||
    'Link: ' || v_row.archivo_url || E'\n' ||
    CASE
      WHEN v_row.id_venta IS NOT NULL THEN
        'Venta CRM id ' || v_row.id_venta::text || ' marcada como Pagado.' || E'\n'
      ELSE ''
    END || 'Podés imprimir / entregar.';

  FOR v_user IN
    SELECT id FROM public.usuarios
    WHERE rol IN ('imprenta', 'mostrador', 'caja')
  LOOP
    INSERT INTO public.user_notifications (
      user_id,
      title,
      description,
      type,
      is_read,
      orden_id
    ) VALUES (
      v_user.id,
      v_titulo,
      v_desc,
      'info',
      false,
      v_row.orden_id
    );
  END LOOP;

  RETURN v_ok;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_solicitud_impresion_totem (
  varchar,
  varchar,
  varchar,
  integer,
  varchar,
  varchar,
  text,
  varchar,
  integer,
  varchar,
  numeric,
  integer,
  varchar
) TO anon;
GRANT EXECUTE ON FUNCTION public.crear_solicitud_impresion_totem (
  varchar,
  varchar,
  varchar,
  integer,
  varchar,
  varchar,
  text,
  varchar,
  integer,
  varchar,
  numeric,
  integer,
  varchar
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.listar_solicitudes_impresion_totem (integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_impresion_totem (integer, integer) TO authenticated;

COMMIT;
