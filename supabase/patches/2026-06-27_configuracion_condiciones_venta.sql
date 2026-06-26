-- Condiciones de venta configurables (medios, bancos transferencia, tipos de cheque).

BEGIN;

ALTER TABLE public.cuentas_bancarias
  ADD COLUMN IF NOT EXISTS cbu varchar(22),
  ADD COLUMN IF NOT EXISTS alias_cvu varchar(40),
  ADD COLUMN IF NOT EXISTS titular text,
  ADD COLUMN IF NOT EXISTS visible_venta_rapida boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cuentas_bancarias.cbu IS 'CBU/CVU para mostrar en transferencias de venta rápida.';
COMMENT ON COLUMN public.cuentas_bancarias.alias_cvu IS 'Alias para transferencias.';
COMMENT ON COLUMN public.cuentas_bancarias.titular IS 'Titular de la cuenta.';
COMMENT ON COLUMN public.cuentas_bancarias.visible_venta_rapida IS 'Si se ofrece como destino en venta rápida.';

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS detalle_pago jsonb;

COMMENT ON COLUMN public.ventas.detalle_pago IS 'Datos del medio de pago: banco, cheque, MP, etc.';

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
      'Mercado Pago',
      'Otro'
    )
  );

CREATE TABLE IF NOT EXISTS public.configuracion_condiciones_venta (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  medios jsonb NOT NULL DEFAULT '[]'::jsonb,
  cuentas_transferencia_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  tipos_cheque jsonb NOT NULL DEFAULT '[]'::jsonb,
  plazos_cheque jsonb NOT NULL DEFAULT '[]'::jsonb,
  bancos_cheque jsonb NOT NULL DEFAULT '[]'::jsonb,
  transferencia_requiere_comprobante boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.configuracion_condiciones_venta IS
  'Medios de pago, bancos para transferencia y opciones de cheque en venta rápida.';

INSERT INTO public.configuracion_condiciones_venta (
  id,
  medios,
  cuentas_transferencia_ids,
  tipos_cheque,
  plazos_cheque,
  bancos_cheque,
  transferencia_requiere_comprobante
)
VALUES (
  1,
  '[
    {"codigo":"Efectivo","label":"Efectivo","activo":true,"orden":1,"lista_precio":"lista_1"},
    {"codigo":"Transferencia","label":"Transferencia","activo":true,"orden":2,"lista_precio":"lista_1","requiere_comprobante":true},
    {"codigo":"Mercado Pago","label":"Mercado Pago","activo":true,"orden":3,"lista_precio":"lista_1","genera_qr_mp":true},
    {"codigo":"Tarjeta","label":"Tarjeta","activo":true,"orden":4,"lista_precio":"lista_1"},
    {"codigo":"Cheque","label":"Cheque","activo":true,"orden":5,"lista_precio":"lista_1"},
    {"codigo":"Cuenta Corriente","label":"Cuenta Corriente","activo":true,"orden":6,"lista_precio":"lista_2"},
    {"codigo":"Otro","label":"Otro","activo":true,"orden":7,"lista_precio":"lista_1"}
  ]'::jsonb,
  '[]'::jsonb,
  '[
    {"id":"fisico","label":"Cheque físico","activo":true},
    {"id":"echeq","label":"E-Cheq","activo":true},
    {"id":"cpd","label":"Cheque pago diferido (CPD)","activo":true},
    {"id":"diferido","label":"Cheque diferido","activo":true}
  ]'::jsonb,
  '["Al día","30 días","60 días","90 días","120 días"]'::jsonb,
  '["Banco Nación","Banco Provincia","Galicia","Santander","BBVA","Macro","ICBC","Credicoop","Supervielle","Otro"]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.configuracion_condiciones_venta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracion_condiciones_venta_anon_all ON public.configuracion_condiciones_venta;
CREATE POLICY configuracion_condiciones_venta_anon_all ON public.configuracion_condiciones_venta
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_configuracion_condiciones_venta()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(c)
  FROM public.configuracion_condiciones_venta c
  WHERE c.id = 1;
$$;

CREATE OR REPLACE FUNCTION public.guardar_configuracion_condiciones_venta(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    RAISE EXCEPTION 'Payload vacío';
  END IF;

  INSERT INTO public.configuracion_condiciones_venta (
    id,
    medios,
    cuentas_transferencia_ids,
    tipos_cheque,
    plazos_cheque,
    bancos_cheque,
    transferencia_requiere_comprobante,
    updated_at
  )
  VALUES (
    1,
    COALESCE(p_payload->'medios', '[]'::jsonb),
    COALESCE(p_payload->'cuentas_transferencia_ids', '[]'::jsonb),
    COALESCE(p_payload->'tipos_cheque', '[]'::jsonb),
    COALESCE(p_payload->'plazos_cheque', '[]'::jsonb),
    COALESCE(p_payload->'bancos_cheque', '[]'::jsonb),
    COALESCE((p_payload->>'transferencia_requiere_comprobante')::boolean, true),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    medios = COALESCE(EXCLUDED.medios, configuracion_condiciones_venta.medios),
    cuentas_transferencia_ids = COALESCE(EXCLUDED.cuentas_transferencia_ids, configuracion_condiciones_venta.cuentas_transferencia_ids),
    tipos_cheque = COALESCE(EXCLUDED.tipos_cheque, configuracion_condiciones_venta.tipos_cheque),
    plazos_cheque = COALESCE(EXCLUDED.plazos_cheque, configuracion_condiciones_venta.plazos_cheque),
    bancos_cheque = COALESCE(EXCLUDED.bancos_cheque, configuracion_condiciones_venta.bancos_cheque),
    transferencia_requiere_comprobante = COALESCE(
      EXCLUDED.transferencia_requiere_comprobante,
      configuracion_condiciones_venta.transferencia_requiere_comprobante
    ),
    updated_at = now();

  RETURN public.get_configuracion_condiciones_venta();
END;
$$;

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
      'id_pedido_cliente', v.id_pedido_cliente,
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
      'monto_pagado', v.monto_pagado,
      'fecha_venta', v.fecha_venta,
      'id_vendedor', v.id_vendedor,
      'nombre_vendedor', v.nombre_vendedor,
      'observaciones', v.observaciones,
      'comprobante_pago_url', v.comprobante_pago_url,
      'comprobante_pago_ia', v.comprobante_pago_ia,
      'comprobante_pago_texto', v.comprobante_pago_texto,
      'detalle_pago', v.detalle_pago,
      'mp_payment_id', v.mp_payment_id,
      'mp_preference_id', v.mp_preference_id,
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
    ORDER BY v.fecha_venta DESC, v.created_at DESC
  ) INTO v_result
  FROM public.ventas v
  WHERE (p_id_vendedor IS NULL OR v.id_vendedor = p_id_vendedor)
    AND (p_fecha_desde IS NULL OR v.fecha_venta >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR v.fecha_venta <= p_fecha_hasta)
    AND (p_estado_pago IS NULL OR v.estado_pago = p_estado_pago);

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.configuracion_condiciones_venta TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracion_condiciones_venta() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_configuracion_condiciones_venta(jsonb) TO anon, authenticated;

COMMIT;
