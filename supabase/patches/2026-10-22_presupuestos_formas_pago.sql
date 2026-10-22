-- Formas de pago seleccionables en presupuestos (checklist → PDF).

ALTER TABLE public.presupuestos_ventas
  ADD COLUMN IF NOT EXISTS formas_pago text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.presupuestos_ventas.formas_pago IS
  'Medios de pago ofrecidos en el presupuesto (códigos de condiciones de venta).';

-- Quitar overloads viejos (cambiar firma requiere DROP; PostgREST no tolera ambigüedad).
DROP FUNCTION IF EXISTS public.crear_presupuesto_venta(
  integer, character varying, character varying, character varying, character varying,
  character varying, text, integer, character varying, jsonb, date, text, text, character varying
);
DROP FUNCTION IF EXISTS public.crear_presupuesto_venta(
  integer, character varying, character varying, character varying, character varying,
  character varying, text, integer, character varying, jsonb, date, text, text,
  character varying, character varying
);
DROP FUNCTION IF EXISTS public.actualizar_presupuesto_venta(
  integer, integer, text, text, text, text, text, text, text, date, text, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.crear_presupuesto_venta(
  p_id_cliente integer DEFAULT NULL,
  p_cliente_nombre character varying DEFAULT NULL,
  p_cliente_telefono character varying DEFAULT NULL,
  p_cliente_email character varying DEFAULT NULL,
  p_cliente_dni_cuit character varying DEFAULT NULL,
  p_cliente_empresa character varying DEFAULT NULL,
  p_cliente_direccion text DEFAULT NULL,
  p_id_vendedor integer DEFAULT NULL,
  p_nombre_vendedor character varying DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_fecha_vencimiento date DEFAULT NULL,
  p_observaciones_cliente text DEFAULT NULL,
  p_observaciones_internas text DEFAULT NULL,
  p_estado character varying DEFAULT 'borrador',
  p_tipo_lista_precio character varying DEFAULT NULL,
  p_formas_pago text[] DEFAULT '{}'
)
RETURNS TABLE (
  id integer,
  numero_presupuesto character varying,
  estado character varying,
  precio_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_presupuesto_id integer;
  numero_presupuesto_generado varchar(50);
  item_record jsonb;
  precio_total_calculado numeric(10,2) := 0;
BEGIN
  IF p_estado NOT IN ('borrador', 'enviado', 'aceptado', 'rechazado', 'cancelado', 'convertido') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;

  IF p_tipo_lista_precio IS NOT NULL AND p_tipo_lista_precio NOT IN ('lista_1', 'lista_2') THEN
    RAISE EXCEPTION 'Tipo de lista inválido: %', p_tipo_lista_precio;
  END IF;

  numero_presupuesto_generado := public.generar_numero_presupuesto_venta();

  INSERT INTO public.presupuestos_ventas (
    id_cliente, numero_presupuesto, estado, fecha_vencimiento,
    observaciones_cliente, observaciones_internas, fecha_envio,
    id_vendedor, nombre_vendedor, cliente_nombre, cliente_telefono,
    cliente_email, cliente_dni_cuit, cliente_empresa, cliente_direccion,
    tipo_lista_precio, formas_pago
  ) VALUES (
    p_id_cliente, numero_presupuesto_generado, p_estado, p_fecha_vencimiento,
    p_observaciones_cliente, p_observaciones_internas,
    CASE WHEN p_estado = 'enviado' THEN NOW() ELSE NULL END,
    p_id_vendedor, p_nombre_vendedor, p_cliente_nombre, p_cliente_telefono,
    p_cliente_email, p_cliente_dni_cuit, p_cliente_empresa, p_cliente_direccion,
    p_tipo_lista_precio, COALESCE(p_formas_pago, '{}')
  )
  RETURNING presupuestos_ventas.id INTO nuevo_presupuesto_id;

  FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.presupuestos_ventas_items (
      id_presupuesto, id_articulo_stock, codigo_articulo, descripcion,
      cantidad, precio_unitario, descuento, precio_total, observaciones
    ) VALUES (
      nuevo_presupuesto_id,
      (item_record->>'id_articulo_stock')::integer,
      item_record->>'codigo_articulo',
      item_record->>'descripcion',
      COALESCE((item_record->>'cantidad')::numeric, 1),
      (item_record->>'precio_unitario')::numeric,
      COALESCE((item_record->>'descuento')::numeric, 0),
      (item_record->>'precio_total')::numeric,
      item_record->>'observaciones'
    );
    precio_total_calculado := precio_total_calculado + (item_record->>'precio_total')::numeric;
  END LOOP;

  UPDATE public.presupuestos_ventas
  SET precio_total = precio_total_calculado
  WHERE presupuestos_ventas.id = nuevo_presupuesto_id;

  RETURN QUERY
  SELECT p.id, p.numero_presupuesto, p.estado, p.precio_total
  FROM public.presupuestos_ventas p
  WHERE p.id = nuevo_presupuesto_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.actualizar_presupuesto_venta(
  p_id_presupuesto integer,
  p_actor_id integer DEFAULT NULL,
  p_actor_nombre text DEFAULT NULL,
  p_cliente_nombre text DEFAULT NULL,
  p_cliente_telefono text DEFAULT NULL,
  p_cliente_email text DEFAULT NULL,
  p_cliente_dni_cuit text DEFAULT NULL,
  p_cliente_empresa text DEFAULT NULL,
  p_cliente_direccion text DEFAULT NULL,
  p_fecha_vencimiento date DEFAULT NULL,
  p_observaciones_cliente text DEFAULT NULL,
  p_observaciones_internas text DEFAULT NULL,
  p_tipo_lista_precio text DEFAULT NULL,
  p_items jsonb DEFAULT NULL,
  p_formas_pago text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prev presupuestos_ventas%ROWTYPE;
  v_items_prev jsonb;
  v_item jsonb;
  v_id integer;
  v_keep integer[] := ARRAY[]::integer[];
  v_cant numeric;
  v_unit numeric;
  v_desc numeric;
  v_line numeric;
  v_total numeric := 0;
  v_new_id integer;
  v_lista text;
BEGIN
  SELECT * INTO v_prev
  FROM public.presupuestos_ventas
  WHERE id = p_id_presupuesto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.id), '[]'::jsonb)
  INTO v_items_prev
  FROM public.presupuestos_ventas_items i
  WHERE i.id_presupuesto = p_id_presupuesto;

  v_lista := NULLIF(btrim(COALESCE(p_tipo_lista_precio, '')), '');
  IF v_lista IS NOT NULL AND v_lista NOT IN ('lista_1', 'lista_2') THEN
    v_lista := v_prev.tipo_lista_precio;
  END IF;

  UPDATE public.presupuestos_ventas
  SET
    cliente_nombre = COALESCE(NULLIF(btrim(COALESCE(p_cliente_nombre, '')), ''), cliente_nombre),
    cliente_telefono = NULLIF(btrim(COALESCE(p_cliente_telefono, '')), ''),
    cliente_email = NULLIF(btrim(COALESCE(p_cliente_email, '')), ''),
    cliente_dni_cuit = NULLIF(btrim(COALESCE(p_cliente_dni_cuit, '')), ''),
    cliente_empresa = NULLIF(btrim(COALESCE(p_cliente_empresa, '')), ''),
    cliente_direccion = NULLIF(btrim(COALESCE(p_cliente_direccion, '')), ''),
    fecha_vencimiento = p_fecha_vencimiento,
    observaciones_cliente = NULLIF(btrim(COALESCE(p_observaciones_cliente, '')), ''),
    observaciones_internas = COALESCE(p_observaciones_internas, observaciones_internas),
    tipo_lista_precio = COALESCE(v_lista, tipo_lista_precio),
    formas_pago = COALESCE(p_formas_pago, formas_pago),
    updated_at = now()
  WHERE id = p_id_presupuesto;

  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      v_id := NULLIF(v_item->>'id', '')::integer;
      v_cant := COALESCE(NULLIF(replace(v_item->>'cantidad', ',', '.'), '')::numeric, 0);
      v_unit := COALESCE(NULLIF(replace(v_item->>'precio_unitario', ',', '.'), '')::numeric, 0);
      v_desc := COALESCE(NULLIF(replace(v_item->>'descuento', ',', '.'), '')::numeric, 0);
      IF v_cant < 0 THEN v_cant := 0; END IF;
      IF v_unit < 0 THEN v_unit := 0; END IF;
      IF v_desc < 0 THEN v_desc := 0; END IF;
      v_line := GREATEST(round(v_cant * v_unit - v_desc, 2), 0);
      v_total := v_total + v_line;

      IF v_id IS NOT NULL AND v_id > 0 AND EXISTS (
        SELECT 1 FROM public.presupuestos_ventas_items
        WHERE id = v_id AND id_presupuesto = p_id_presupuesto
      ) THEN
        UPDATE public.presupuestos_ventas_items
        SET
          descripcion = COALESCE(NULLIF(btrim(COALESCE(v_item->>'descripcion', '')), ''), descripcion),
          cantidad = v_cant,
          precio_unitario = v_unit,
          descuento = v_desc,
          precio_total = v_line,
          codigo_articulo = NULLIF(btrim(COALESCE(v_item->>'codigo_articulo', '')), ''),
          observaciones = NULLIF(btrim(COALESCE(v_item->>'observaciones', '')), '')
        WHERE id = v_id;
        v_keep := array_append(v_keep, v_id);
      ELSE
        INSERT INTO public.presupuestos_ventas_items (
          id_presupuesto, descripcion, cantidad, precio_unitario, descuento, precio_total,
          codigo_articulo, id_articulo_stock, observaciones
        ) VALUES (
          p_id_presupuesto,
          COALESCE(NULLIF(btrim(COALESCE(v_item->>'descripcion', '')), ''), 'Ítem'),
          v_cant,
          v_unit,
          v_desc,
          v_line,
          NULLIF(btrim(COALESCE(v_item->>'codigo_articulo', '')), ''),
          NULLIF(v_item->>'id_articulo_stock', '')::integer,
          NULLIF(btrim(COALESCE(v_item->>'observaciones', '')), '')
        )
        RETURNING id INTO v_new_id;
        v_keep := array_append(v_keep, v_new_id);
      END IF;
    END LOOP;

    DELETE FROM public.presupuestos_ventas_items
    WHERE id_presupuesto = p_id_presupuesto
      AND (cardinality(v_keep) = 0 OR NOT (id = ANY (v_keep)));

    UPDATE public.presupuestos_ventas
    SET precio_total = v_total, updated_at = now()
    WHERE id = p_id_presupuesto;
  END IF;

  INSERT INTO public.presupuestos_ventas_auditoria (
    id_presupuesto, accion, actor_id, actor_nombre, detalle
  ) VALUES (
    p_id_presupuesto,
    'editar',
    p_actor_id,
    NULLIF(btrim(COALESCE(p_actor_nombre, '')), ''),
    jsonb_build_object(
      'antes', jsonb_build_object(
        'cliente_nombre', v_prev.cliente_nombre,
        'precio_total', v_prev.precio_total,
        'formas_pago', v_prev.formas_pago,
        'items', v_items_prev
      ),
      'precio_total_nuevo', (SELECT precio_total FROM public.presupuestos_ventas WHERE id = p_id_presupuesto),
      'formas_pago', (SELECT formas_pago FROM public.presupuestos_ventas WHERE id = p_id_presupuesto)
    )
  );

  RETURN jsonb_build_object(
    'id', p_id_presupuesto,
    'precio_total', (SELECT precio_total FROM public.presupuestos_ventas WHERE id = p_id_presupuesto)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_presupuesto_venta(
  integer, character varying, character varying, character varying, character varying,
  character varying, text, integer, character varying, jsonb, date, text, text,
  character varying, character varying, text[]
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.actualizar_presupuesto_venta(
  integer, integer, text, text, text, text, text, text, text, date, text, text, text, jsonb, text[]
) TO anon, authenticated;

-- Listado admin: incluir lista y formas de pago (antes no venían en el RETURNS TABLE).
DROP FUNCTION IF EXISTS public.listar_presupuestos_ventas_admin(
  character varying, integer, integer, date, date
);

CREATE OR REPLACE FUNCTION public.listar_presupuestos_ventas_admin(
  p_estado character varying DEFAULT NULL,
  p_id_cliente integer DEFAULT NULL,
  p_id_vendedor integer DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  id_cliente integer,
  numero_presupuesto character varying,
  estado character varying,
  fecha_creacion timestamp with time zone,
  fecha_envio timestamp with time zone,
  fecha_respuesta timestamp with time zone,
  fecha_vencimiento date,
  observaciones_cliente text,
  observaciones_internas text,
  precio_total numeric,
  id_op_asociada integer,
  id_venta_asociada integer,
  id_vendedor integer,
  nombre_vendedor character varying,
  cliente_nombre character varying,
  cliente_telefono character varying,
  cliente_email character varying,
  cliente_dni_cuit character varying,
  cliente_empresa character varying,
  cliente_direccion text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  tipo_lista_precio character varying,
  formas_pago text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.id_cliente,
    p.numero_presupuesto,
    p.estado,
    p.fecha_creacion,
    p.fecha_envio,
    p.fecha_respuesta,
    p.fecha_vencimiento,
    p.observaciones_cliente,
    p.observaciones_internas,
    p.precio_total,
    p.id_op_asociada,
    p.id_venta_asociada,
    p.id_vendedor,
    p.nombre_vendedor,
    p.cliente_nombre,
    p.cliente_telefono,
    p.cliente_email,
    p.cliente_dni_cuit,
    p.cliente_empresa,
    p.cliente_direccion,
    p.created_at,
    p.updated_at,
    p.tipo_lista_precio,
    COALESCE(p.formas_pago, '{}'::text[])
  FROM public.presupuestos_ventas p
  WHERE
    (p_estado IS NULL OR p.estado = p_estado)
    AND (p_id_cliente IS NULL OR p.id_cliente = p_id_cliente)
    AND (p_id_vendedor IS NULL OR p.id_vendedor = p_id_vendedor)
    AND (p_fecha_desde IS NULL OR DATE(p.fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(p.fecha_creacion) <= p_fecha_hasta)
  ORDER BY p.fecha_creacion DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_presupuestos_ventas_admin(
  character varying, integer, integer, date, date
) TO anon, authenticated;
