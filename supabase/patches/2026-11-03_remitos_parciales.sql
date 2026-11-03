-- Remito X (interno, no fiscal) con entregas parciales.
-- Una venta (o una OP) puede entregarse en varios remitos: lo pendiente de cada línea es
-- lo pedido menos lo ya remitido en remitos no anulados. Todo se valida en la base, con
-- la venta/OP bloqueada, para que dos remitos simultáneos no puedan pasarse del pedido.
-- Escritura solo por RPC con actor (mismo criterio que ventas/pagos: anon solo SELECT).
-- Requiere: actor_puede_escribir_comercial (patch 2026-09-15), ventas, ventas_items,
-- ordenes_trabajo y orden_lineas_m2.

CREATE TABLE IF NOT EXISTS public.remitos (
  id bigserial PRIMARY KEY,
  tipo text NOT NULL DEFAULT 'X' CHECK (tipo = 'X'),
  punto_venta integer NOT NULL DEFAULT 1 CHECK (punto_venta BETWEEN 1 AND 99999),
  numero integer NOT NULL CHECK (numero > 0),
  estado text NOT NULL DEFAULT 'Emitido' CHECK (estado IN ('Emitido', 'Anulado')),
  id_venta integer REFERENCES public.ventas(id) ON DELETE SET NULL,
  numero_venta text,
  id_op integer REFERENCES public.ordenes_trabajo(id) ON DELETE SET NULL,
  numero_op text,
  id_cliente integer,
  cliente_nombre text NOT NULL CHECK (btrim(cliente_nombre) <> ''),
  cliente_documento text,
  cliente_domicilio text,
  cliente_telefono text,
  fecha_emision date NOT NULL DEFAULT ((timezone('America/Argentina/Buenos_Aires', now()))::date),
  fecha_entrega date,
  entregado_a text,
  dni_retira text,
  transportista text,
  observaciones text,
  id_usuario integer,
  usuario_nombre text,
  anulado_motivo text,
  anulado_at timestamptz,
  anulado_por integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_remitos_numero UNIQUE (tipo, punto_venta, numero),
  CONSTRAINT remitos_anulado_con_motivo CHECK (estado <> 'Anulado' OR btrim(COALESCE(anulado_motivo, '')) <> '')
);

CREATE INDEX IF NOT EXISTS idx_remitos_venta ON public.remitos(id_venta) WHERE id_venta IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_remitos_op ON public.remitos(id_op) WHERE id_op IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_remitos_fecha ON public.remitos(fecha_emision DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.remitos_items (
  id bigserial PRIMARY KEY,
  id_remito bigint NOT NULL REFERENCES public.remitos(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 1,
  id_venta_item integer REFERENCES public.ventas_items(id) ON DELETE SET NULL,
  id_op_linea integer REFERENCES public.orden_lineas_m2(id) ON DELETE SET NULL,
  codigo_articulo text,
  descripcion text NOT NULL CHECK (btrim(descripcion) <> ''),
  unidad text,
  cantidad numeric(12,3) NOT NULL CHECK (cantidad > 0),
  -- Lo que decía el pedido y lo ya entregado cuando se emitió este remito (null en líneas libres).
  cantidad_pedida numeric(12,3),
  cantidad_previa numeric(12,3),
  observaciones text,
  CONSTRAINT remitos_items_una_fuente CHECK (id_venta_item IS NULL OR id_op_linea IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_remitos_items_remito ON public.remitos_items(id_remito, orden);
CREATE INDEX IF NOT EXISTS idx_remitos_items_venta_item ON public.remitos_items(id_venta_item) WHERE id_venta_item IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_remitos_items_op_linea ON public.remitos_items(id_op_linea) WHERE id_op_linea IS NOT NULL;

ALTER TABLE public.remitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remitos_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS remitos_select_anon ON public.remitos;
CREATE POLICY remitos_select_anon ON public.remitos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS remitos_items_select_anon ON public.remitos_items;
CREATE POLICY remitos_items_select_anon ON public.remitos_items FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.remitos FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.remitos_items FROM anon, authenticated;
GRANT SELECT ON TABLE public.remitos TO anon, authenticated;
GRANT SELECT ON TABLE public.remitos_items TO anon, authenticated;

COMMENT ON TABLE public.remitos IS
  'Remito X interno (no fiscal). anon solo SELECT; se escribe con remito_crear / remito_anular.';

-- Pedido, entregado y pendiente de cada línea de una venta y de las líneas m² de su OP.
CREATE OR REPLACE FUNCTION public.remitos_pendientes(p_id_venta integer, p_id_op integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'venta_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id_venta_item', vi.id,
        'codigo_articulo', vi.codigo_articulo,
        'descripcion', vi.descripcion,
        'pedida', vi.cantidad,
        'entregada', COALESCE(e.cant, 0),
        'pendiente', GREATEST(vi.cantidad - COALESCE(e.cant, 0), 0)
      ) ORDER BY vi.id)
      FROM public.ventas_items vi
      LEFT JOIN LATERAL (
        SELECT SUM(ri.cantidad) AS cant
        FROM public.remitos_items ri
        JOIN public.remitos r ON r.id = ri.id_remito
        WHERE ri.id_venta_item = vi.id AND r.estado = 'Emitido'
      ) e ON true
      WHERE vi.id_venta = p_id_venta
    ), '[]'::jsonb),
    'op_lineas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id_op_linea', l.id,
        'descripcion', l.tipo,
        'unidad', 'm²',
        'pedida', l.metros_cuadrados,
        'entregada', COALESCE(e.cant, 0),
        'pendiente', GREATEST(l.metros_cuadrados - COALESCE(e.cant, 0), 0)
      ) ORDER BY l.sort_order, l.id)
      FROM public.orden_lineas_m2 l
      LEFT JOIN LATERAL (
        SELECT SUM(ri.cantidad) AS cant
        FROM public.remitos_items ri
        JOIN public.remitos r ON r.id = ri.id_remito
        WHERE ri.id_op_linea = l.id AND r.estado = 'Emitido'
      ) e ON true
      WHERE l.id_orden = p_id_op
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.remitos_pendientes(integer, integer) TO anon, authenticated;

-- Emite un remito. payload: id_venta?, id_op?, punto_venta?, fecha_emision?, fecha_entrega?,
-- cliente_*?, entregado_a?, dni_retira?, transportista?, observaciones?, usuario_nombre?,
-- items[{ id_venta_item? | id_op_linea?, codigo_articulo?, descripcion, unidad?, cantidad, observaciones? }].
-- Las líneas de la venta o de la OP no pueden pasar lo pendiente; las líneas libres no se controlan.
CREATE OR REPLACE FUNCTION public.remito_crear(p_actor_id integer, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id_venta integer := NULLIF(p_payload->>'id_venta', '')::integer;
  v_id_op integer := NULLIF(p_payload->>'id_op', '')::integer;
  v_pv integer := COALESCE(NULLIF(p_payload->>'punto_venta', '')::integer, 1);
  v_venta public.ventas%ROWTYPE;
  v_numero integer;
  v_id bigint;
  v_item jsonb;
  v_orden integer := 0;
  v_cant numeric;
  v_pedida numeric;
  v_previa numeric;
  v_desc text;
  v_id_vi integer;
  v_id_ol integer;
  v_cliente text;
  v_out jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_payload IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para emitir remitos';
  END IF;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'El remito necesita al menos una línea';
  END IF;

  IF v_id_venta IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('remito_venta:' || v_id_venta));
    SELECT * INTO v_venta FROM public.ventas WHERE id = v_id_venta;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Venta % no encontrada', v_id_venta;
    END IF;
    IF v_venta.estado_pago = 'Cancelado' THEN
      RAISE EXCEPTION 'La venta % está cancelada: no se puede remitir', v_venta.numero_venta;
    END IF;
    IF v_id_op IS NULL THEN
      v_id_op := v_venta.id_op;
    END IF;
  END IF;
  IF v_id_op IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('remito_op:' || v_id_op));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('remito_serie:X:' || v_pv));

  v_cliente := COALESCE(NULLIF(btrim(p_payload->>'cliente_nombre'), ''), v_venta.cliente_nombre);
  IF v_cliente IS NULL OR btrim(v_cliente) = '' THEN
    RAISE EXCEPTION 'El remito necesita el nombre del cliente';
  END IF;

  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM public.remitos WHERE tipo = 'X' AND punto_venta = v_pv;

  INSERT INTO public.remitos (
    punto_venta, numero, id_venta, numero_venta, id_op, numero_op,
    cliente_nombre, cliente_documento, cliente_domicilio, cliente_telefono,
    fecha_emision, fecha_entrega, entregado_a, dni_retira, transportista, observaciones,
    id_usuario, usuario_nombre
  ) VALUES (
    v_pv, v_numero, v_id_venta, v_venta.numero_venta, v_id_op,
    COALESCE(NULLIF(p_payload->>'numero_op', ''), v_venta.numero_op),
    btrim(v_cliente),
    COALESCE(NULLIF(btrim(p_payload->>'cliente_documento'), ''), v_venta.cliente_dni_cuit),
    COALESCE(NULLIF(btrim(p_payload->>'cliente_domicilio'), ''), v_venta.cliente_direccion),
    COALESCE(NULLIF(btrim(p_payload->>'cliente_telefono'), ''), v_venta.cliente_telefono),
    COALESCE(NULLIF(p_payload->>'fecha_emision', '')::date, (timezone('America/Argentina/Buenos_Aires', now()))::date),
    NULLIF(p_payload->>'fecha_entrega', '')::date,
    NULLIF(btrim(p_payload->>'entregado_a'), ''),
    NULLIF(btrim(p_payload->>'dni_retira'), ''),
    NULLIF(btrim(p_payload->>'transportista'), ''),
    NULLIF(btrim(p_payload->>'observaciones'), ''),
    p_actor_id,
    NULLIF(btrim(p_payload->>'usuario_nombre'), '')
  ) RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    v_orden := v_orden + 1;
    v_cant := NULLIF(v_item->>'cantidad', '')::numeric;
    v_desc := NULLIF(btrim(v_item->>'descripcion'), '');
    v_id_vi := NULLIF(v_item->>'id_venta_item', '')::integer;
    v_id_ol := NULLIF(v_item->>'id_op_linea', '')::integer;
    v_pedida := NULL;
    v_previa := NULL;

    IF v_cant IS NULL OR v_cant <= 0 THEN
      RAISE EXCEPTION 'La línea % tiene una cantidad inválida', v_orden;
    END IF;
    IF v_id_vi IS NOT NULL AND v_id_ol IS NOT NULL THEN
      RAISE EXCEPTION 'La línea % apunta a la venta y a la OP a la vez', v_orden;
    END IF;

    IF v_id_vi IS NOT NULL THEN
      IF v_id_venta IS NULL THEN
        RAISE EXCEPTION 'La línea % es de una venta pero el remito no tiene venta', v_orden;
      END IF;
      SELECT vi.cantidad, COALESCE(v_desc, vi.descripcion) INTO v_pedida, v_desc
      FROM public.ventas_items vi WHERE vi.id = v_id_vi AND vi.id_venta = v_id_venta;
      IF v_pedida IS NULL THEN
        RAISE EXCEPTION 'La línea % no pertenece a la venta %', v_orden, v_venta.numero_venta;
      END IF;
      SELECT COALESCE(SUM(ri.cantidad), 0) INTO v_previa
      FROM public.remitos_items ri JOIN public.remitos r ON r.id = ri.id_remito
      WHERE ri.id_venta_item = v_id_vi AND r.estado = 'Emitido' AND r.id <> v_id;
    ELSIF v_id_ol IS NOT NULL THEN
      IF v_id_op IS NULL THEN
        RAISE EXCEPTION 'La línea % es de una OP pero el remito no tiene OP', v_orden;
      END IF;
      SELECT l.metros_cuadrados, COALESCE(v_desc, l.tipo) INTO v_pedida, v_desc
      FROM public.orden_lineas_m2 l WHERE l.id = v_id_ol AND l.id_orden = v_id_op;
      IF v_pedida IS NULL THEN
        RAISE EXCEPTION 'La línea % no pertenece a la OP del remito', v_orden;
      END IF;
      SELECT COALESCE(SUM(ri.cantidad), 0) INTO v_previa
      FROM public.remitos_items ri JOIN public.remitos r ON r.id = ri.id_remito
      WHERE ri.id_op_linea = v_id_ol AND r.estado = 'Emitido' AND r.id <> v_id;
    END IF;

    IF v_pedida IS NOT NULL AND v_cant > v_pedida - v_previa THEN
      RAISE EXCEPTION 'La línea "%" supera lo pendiente (pedido %, ya remitido %, pendiente %)',
        v_desc, trim_scale(v_pedida), trim_scale(v_previa), trim_scale(GREATEST(v_pedida - v_previa, 0));
    END IF;
    IF v_desc IS NULL THEN
      RAISE EXCEPTION 'La línea % necesita descripción', v_orden;
    END IF;

    INSERT INTO public.remitos_items (
      id_remito, orden, id_venta_item, id_op_linea, codigo_articulo, descripcion, unidad,
      cantidad, cantidad_pedida, cantidad_previa, observaciones
    ) VALUES (
      v_id, v_orden, v_id_vi, v_id_ol,
      NULLIF(btrim(v_item->>'codigo_articulo'), ''), v_desc, NULLIF(btrim(v_item->>'unidad'), ''),
      v_cant, v_pedida, v_previa, NULLIF(btrim(v_item->>'observaciones'), '')
    );
  END LOOP;

  SELECT to_jsonb(r.*) || jsonb_build_object('items', COALESCE((
    SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.orden) FROM public.remitos_items i WHERE i.id_remito = r.id
  ), '[]'::jsonb)) INTO v_out
  FROM public.remitos r WHERE r.id = v_id;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remito_crear(integer, jsonb) TO anon, authenticated;

-- Anula un remito (queda en el historial; lo que remitía vuelve a figurar como pendiente).
CREATE OR REPLACE FUNCTION public.remito_anular(p_actor_id integer, p_id_remito bigint, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para anular remitos';
  END IF;
  IF btrim(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Indicá el motivo de la anulación';
  END IF;

  UPDATE public.remitos
  SET estado = 'Anulado', anulado_motivo = btrim(p_motivo), anulado_at = now(),
      anulado_por = p_actor_id, updated_at = now()
  WHERE id = p_id_remito AND estado = 'Emitido'
  RETURNING to_jsonb(remitos.*) INTO v_out;

  IF v_out IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.remitos WHERE id = p_id_remito) THEN
      RAISE EXCEPTION 'El remito ya estaba anulado';
    END IF;
    RAISE EXCEPTION 'Remito % no encontrado', p_id_remito;
  END IF;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remito_anular(integer, bigint, text) TO anon, authenticated;
