-- El cliente (api.ts) llama a crear_venta_directa con p_id_cliente.
-- Si la función en BD no declara ese parámetro, PostgREST no resuelve el RPC y las ventas no se crean.
BEGIN;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS id_cliente integer REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_id_cliente ON public.ventas(id_cliente);

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'crear_venta_directa'
      AND n.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.crear_venta_directa(
  p_cliente_nombre varchar(255),
  p_valor_total numeric(10,2),
  p_id_vendedor integer,
  p_nombre_vendedor varchar(100),
  p_cliente_telefono varchar(50) DEFAULT NULL,
  p_cliente_email varchar(255) DEFAULT NULL,
  p_cliente_dni_cuit varchar(50) DEFAULT NULL,
  p_cliente_empresa varchar(255) DEFAULT NULL,
  p_cliente_direccion text DEFAULT NULL,
  p_metodo_pago varchar(50) DEFAULT NULL,
  p_estado_pago varchar(50) DEFAULT 'Pendiente',
  p_fecha_venta date DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_id_cliente integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_numero_venta varchar(50);
  v_result json;
  v_fecha date;
BEGIN
  v_fecha := COALESCE(p_fecha_venta, CURRENT_DATE);

  v_numero_venta := 'VENT-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(
    (COALESCE((SELECT MAX(id) FROM public.ventas), 0) + 1)::text,
    4,
    '0'
  );

  INSERT INTO public.ventas (
    numero_venta,
    id_oportunidad,
    id_cliente,
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
  ) VALUES (
    v_numero_venta,
    NULL,
    p_id_cliente,
    p_cliente_nombre,
    p_cliente_telefono,
    p_cliente_email,
    p_cliente_dni_cuit,
    p_cliente_empresa,
    p_cliente_direccion,
    NULL,
    NULL,
    p_valor_total,
    p_metodo_pago,
    p_estado_pago,
    v_fecha,
    p_id_vendedor,
    p_nombre_vendedor,
    p_observaciones
  ) RETURNING id INTO v_id;

  SELECT json_build_object(
    'success', true,
    'data', json_build_object(
      'id', v_id,
      'numero_venta', v_numero_venta
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Incluir id_cliente en el listado (misma firma que 2026-04-17_ventas_comprobante_pago_url.sql).
CREATE OR REPLACE FUNCTION public.obtener_ventas(
  p_id_vendedor integer DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_estado_pago varchar(50) DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', v.id,
      'numero_venta', v.numero_venta,
      'id_oportunidad', v.id_oportunidad,
      'id_cliente', v.id_cliente,
      'cliente_nombre', v.cliente_nombre,
      'cliente_telefono', v.cliente_telefono,
      'cliente_email', v.cliente_email,
      'cliente_dni_cuit', v.cliente_dni_cuit,
      'cliente_empresa', v.cliente_empresa,
      'cliente_direccion', v.cliente_direccion,
      'id_op', v.id_op,
      'numero_op', v.numero_op,
      'valor_total', v.valor_total,
      'metodo_pago', v.metodo_pago,
      'estado_pago', v.estado_pago,
      'fecha_venta', v.fecha_venta,
      'id_vendedor', v.id_vendedor,
      'nombre_vendedor', v.nombre_vendedor,
      'observaciones', v.observaciones,
      'comprobante_pago_url', v.comprobante_pago_url,
      'created_at', v.created_at,
      'updated_at', v.updated_at,
      'items', (
        SELECT COALESCE(json_agg(
          json_build_object(
            'id', vi.id,
            'id_venta', vi.id_venta,
            'id_articulo_stock', vi.id_articulo_stock,
            'codigo_articulo', vi.codigo_articulo,
            'descripcion', vi.descripcion,
            'cantidad', vi.cantidad,
            'precio_unitario', vi.precio_unitario,
            'precio_total', vi.precio_total,
            'descuento', vi.descuento,
            'observaciones', vi.observaciones,
            'created_at', vi.created_at
          )
          ORDER BY vi.id
        ), '[]'::json)
        FROM public.ventas_items vi
        WHERE vi.id_venta = v.id
      )
    )
  ) INTO v_result
  FROM public.ventas v
  WHERE (p_id_vendedor IS NULL OR v.id_vendedor = p_id_vendedor)
    AND (p_fecha_desde IS NULL OR v.fecha_venta >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR v.fecha_venta <= p_fecha_hasta)
    AND (p_estado_pago IS NULL OR v.estado_pago = p_estado_pago)
  ORDER BY v.fecha_venta DESC, v.created_at DESC;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

COMMIT;
