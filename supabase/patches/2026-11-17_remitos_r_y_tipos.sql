-- Remitos: Remito R (código ARCA 91, autoimpresor con CAI) y nuevos tipos de remito.
--
-- * Remito R: numeración propia por punto de venta, dentro del rango del CAI vigente.
--   El CAI (14 dígitos), su vencimiento y el rango se cargan en remitos_cai. Al emitir se
--   guarda una copia del CAI en el remito (va impreso con el código de barras RG 1702).
-- * Clase del remito:
--     Entrega     (la de siempre: descuenta lo pendiente de la venta / OP)
--     Devolucion  (el cliente devuelve mercadería entregada: vuelve a figurar como pendiente)
--     Traslado    (movimiento entre locales/depósitos propios, sin venta ni cliente)
--
-- Requiere: 2026-11-03_remitos_parciales.sql (tablas remitos, remitos_items y sus RPC).
-- Idempotente: se puede volver a ejecutar.

-- ---------------------------------------------------------------------------
-- 1) Columnas nuevas en remitos
-- ---------------------------------------------------------------------------

-- El CHECK original solo admitía tipo = 'X'.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.remitos'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%' AND pg_get_constraintdef(oid) NOT ILIKE '%cai%'
  LOOP
    EXECUTE format('ALTER TABLE public.remitos DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.remitos
  ADD COLUMN IF NOT EXISTS clase text NOT NULL DEFAULT 'Entrega',
  ADD COLUMN IF NOT EXISTS cai text,
  ADD COLUMN IF NOT EXISTS cai_vencimiento date,
  ADD COLUMN IF NOT EXISTS cliente_condicion_iva text,
  ADD COLUMN IF NOT EXISTS domicilio_entrega text,
  ADD COLUMN IF NOT EXISTS transportista_cuit text,
  ADD COLUMN IF NOT EXISTS deposito_origen text,
  ADD COLUMN IF NOT EXISTS deposito_destino text;

ALTER TABLE public.remitos DROP CONSTRAINT IF EXISTS remitos_tipo_valido;
ALTER TABLE public.remitos ADD CONSTRAINT remitos_tipo_valido CHECK (tipo IN ('X', 'R'));

ALTER TABLE public.remitos DROP CONSTRAINT IF EXISTS remitos_clase_valida;
ALTER TABLE public.remitos
  ADD CONSTRAINT remitos_clase_valida CHECK (clase IN ('Entrega', 'Devolucion', 'Traslado'));

-- Un remito R siempre lleva el CAI con el que se emitió.
ALTER TABLE public.remitos DROP CONSTRAINT IF EXISTS remitos_r_con_cai;
ALTER TABLE public.remitos
  ADD CONSTRAINT remitos_r_con_cai CHECK (
    tipo <> 'R' OR (cai IS NOT NULL AND cai ~ '^\d{14}$' AND cai_vencimiento IS NOT NULL)
  );

ALTER TABLE public.remitos DROP CONSTRAINT IF EXISTS remitos_traslado_sin_venta;
ALTER TABLE public.remitos
  ADD CONSTRAINT remitos_traslado_sin_venta CHECK (clase <> 'Traslado' OR (id_venta IS NULL AND id_op IS NULL));

CREATE INDEX IF NOT EXISTS idx_remitos_tipo_pv ON public.remitos(tipo, punto_venta, numero DESC);

COMMENT ON TABLE public.remitos IS
  'Remitos X (interno) y R (ARCA cód. 91, autoimpresor con CAI). anon solo SELECT; se escribe con remito_crear / remito_anular.';

-- ---------------------------------------------------------------------------
-- 2) CAI de autoimpresor para Remito R
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.remitos_cai (
  id bigserial PRIMARY KEY,
  punto_venta integer NOT NULL CHECK (punto_venta BETWEEN 1 AND 9999),
  cai text NOT NULL CHECK (cai ~ '^\d{14}$'),
  fecha_vencimiento date NOT NULL,
  numero_desde integer NOT NULL CHECK (numero_desde > 0),
  numero_hasta integer NOT NULL CHECK (numero_hasta >= numero_desde),
  activo boolean NOT NULL DEFAULT true,
  observaciones text,
  id_usuario integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_remitos_cai UNIQUE (cai)
);

CREATE INDEX IF NOT EXISTS idx_remitos_cai_pv ON public.remitos_cai(punto_venta, activo, fecha_vencimiento DESC);

ALTER TABLE public.remitos_cai ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS remitos_cai_select ON public.remitos_cai;
CREATE POLICY remitos_cai_select ON public.remitos_cai FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON TABLE public.remitos_cai FROM anon, authenticated;
GRANT SELECT ON TABLE public.remitos_cai TO anon, authenticated;

-- Alta / edición de un CAI. payload: id?, punto_venta, cai, fecha_vencimiento, numero_desde,
-- numero_hasta, activo?, observaciones?
-- Un CAI con remitos ya emitidos no puede cambiar de punto de venta ni dejar afuera esos números.
CREATE OR REPLACE FUNCTION public.remito_cai_guardar(p_actor_id integer, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint := NULLIF(p_payload->>'id', '')::bigint;
  v_pv integer := NULLIF(p_payload->>'punto_venta', '')::integer;
  v_cai text := regexp_replace(COALESCE(p_payload->>'cai', ''), '\s', '', 'g');
  v_vto date := NULLIF(p_payload->>'fecha_vencimiento', '')::date;
  v_desde integer := NULLIF(p_payload->>'numero_desde', '')::integer;
  v_hasta integer := NULLIF(p_payload->>'numero_hasta', '')::integer;
  v_activo boolean := COALESCE((p_payload->>'activo')::boolean, true);
  v_prev public.remitos_cai%ROWTYPE;
  v_min integer;
  v_max integer;
  v_out jsonb;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para configurar el CAI de remitos';
  END IF;
  IF v_pv IS NULL OR v_pv < 1 OR v_pv > 9999 THEN
    RAISE EXCEPTION 'Punto de venta inválido (1 a 9999)';
  END IF;
  IF v_cai !~ '^\d{14}$' THEN
    RAISE EXCEPTION 'El CAI debe tener 14 dígitos';
  END IF;
  IF v_vto IS NULL THEN
    RAISE EXCEPTION 'Indicá la fecha de vencimiento del CAI';
  END IF;
  IF v_desde IS NULL OR v_hasta IS NULL OR v_desde < 1 OR v_hasta < v_desde THEN
    RAISE EXCEPTION 'Rango de numeración inválido';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_prev FROM public.remitos_cai WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CAI % no encontrado', v_id;
    END IF;
    SELECT MIN(numero), MAX(numero) INTO v_min, v_max
    FROM public.remitos WHERE tipo = 'R' AND cai = v_prev.cai;
    IF v_max IS NOT NULL THEN
      IF v_pv <> v_prev.punto_venta OR v_cai <> v_prev.cai THEN
        RAISE EXCEPTION 'Este CAI ya tiene remitos emitidos: no se puede cambiar el CAI ni el punto de venta';
      END IF;
      IF v_desde > v_min OR v_hasta < v_max THEN
        RAISE EXCEPTION 'El rango tiene que incluir los remitos ya emitidos (% a %)', v_min, v_max;
      END IF;
    END IF;
    UPDATE public.remitos_cai SET
      punto_venta = v_pv, cai = v_cai, fecha_vencimiento = v_vto,
      numero_desde = v_desde, numero_hasta = v_hasta, activo = v_activo,
      observaciones = NULLIF(btrim(p_payload->>'observaciones'), ''), updated_at = now()
    WHERE id = v_id
    RETURNING to_jsonb(remitos_cai.*) INTO v_out;
  ELSE
    INSERT INTO public.remitos_cai (punto_venta, cai, fecha_vencimiento, numero_desde, numero_hasta, activo, observaciones, id_usuario)
    VALUES (v_pv, v_cai, v_vto, v_desde, v_hasta, v_activo, NULLIF(btrim(p_payload->>'observaciones'), ''), p_actor_id)
    RETURNING to_jsonb(remitos_cai.*) INTO v_out;
  END IF;

  -- Dos CAI activos del mismo punto de venta no pueden superponer números.
  IF v_activo AND EXISTS (
    SELECT 1 FROM public.remitos_cai c
    WHERE c.activo AND c.punto_venta = v_pv AND c.id <> (v_out->>'id')::bigint
      AND c.numero_desde <= v_hasta AND c.numero_hasta >= v_desde
  ) THEN
    RAISE EXCEPTION 'El rango % a % se superpone con otro CAI activo del punto de venta %', v_desde, v_hasta, v_pv;
  END IF;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remito_cai_guardar(integer, jsonb) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Pendientes: lo entregado descuenta las devoluciones
-- ---------------------------------------------------------------------------

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
        SELECT SUM(CASE WHEN r.clase = 'Devolucion' THEN -ri.cantidad ELSE ri.cantidad END) AS cant
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
        SELECT SUM(CASE WHEN r.clase = 'Devolucion' THEN -ri.cantidad ELSE ri.cantidad END) AS cant
        FROM public.remitos_items ri
        JOIN public.remitos r ON r.id = ri.id_remito
        WHERE ri.id_op_linea = l.id AND r.estado = 'Emitido'
      ) e ON true
      WHERE l.id_orden = p_id_op
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.remitos_pendientes(integer, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Emisión
-- ---------------------------------------------------------------------------
-- payload (además de lo de 2026-11-03): tipo 'X'|'R', clase 'Entrega'|'Devolucion'|'Traslado',
-- cliente_condicion_iva?, domicilio_entrega?, transportista_cuit?, deposito_origen?, deposito_destino?
-- Remito R: punto_venta del CAI; número correlativo dentro del rango del CAI vigente.
-- Devolución: cada línea de la venta/OP no puede superar lo entregado neto.
-- Traslado: sin venta ni OP, con depósito de origen y de destino.
CREATE OR REPLACE FUNCTION public.remito_crear(p_actor_id integer, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text := upper(COALESCE(NULLIF(btrim(p_payload->>'tipo'), ''), 'X'));
  v_clase text := COALESCE(NULLIF(btrim(p_payload->>'clase'), ''), 'Entrega');
  v_id_venta integer := NULLIF(p_payload->>'id_venta', '')::integer;
  v_id_op integer := NULLIF(p_payload->>'id_op', '')::integer;
  v_pv integer := COALESCE(NULLIF(p_payload->>'punto_venta', '')::integer, 1);
  v_fecha date := COALESCE(NULLIF(p_payload->>'fecha_emision', '')::date, (timezone('America/Argentina/Buenos_Aires', now()))::date);
  v_venta public.ventas%ROWTYPE;
  v_cai public.remitos_cai%ROWTYPE;
  v_numero integer;
  v_ultima_fecha date;
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
  v_documento text;
  v_domicilio text;
  v_out jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_payload IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para emitir remitos';
  END IF;
  IF v_tipo NOT IN ('X', 'R') THEN
    RAISE EXCEPTION 'Tipo de remito inválido: %', v_tipo;
  END IF;
  IF v_clase NOT IN ('Entrega', 'Devolucion', 'Traslado') THEN
    RAISE EXCEPTION 'Clase de remito inválida: %', v_clase;
  END IF;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'El remito necesita al menos una línea';
  END IF;

  IF v_clase = 'Traslado' THEN
    IF v_id_venta IS NOT NULL OR v_id_op IS NOT NULL THEN
      RAISE EXCEPTION 'Un remito de traslado no va asociado a una venta ni a una OP';
    END IF;
    IF NULLIF(btrim(p_payload->>'deposito_origen'), '') IS NULL OR NULLIF(btrim(p_payload->>'deposito_destino'), '') IS NULL THEN
      RAISE EXCEPTION 'El traslado necesita depósito de origen y de destino';
    END IF;
  ELSIF v_clase = 'Devolucion' AND v_id_venta IS NULL AND v_id_op IS NULL THEN
    RAISE EXCEPTION 'La devolución tiene que indicar de qué venta u OP vuelve la mercadería';
  END IF;

  IF v_id_venta IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('remito_venta:' || v_id_venta));
    SELECT * INTO v_venta FROM public.ventas WHERE id = v_id_venta;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Venta % no encontrada', v_id_venta;
    END IF;
    IF v_venta.estado_pago = 'Cancelado' AND v_clase = 'Entrega' THEN
      RAISE EXCEPTION 'La venta % está cancelada: no se puede remitir', v_venta.numero_venta;
    END IF;
    IF v_id_op IS NULL THEN
      v_id_op := v_venta.id_op;
    END IF;
  END IF;
  IF v_id_op IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('remito_op:' || v_id_op));
  END IF;

  v_cliente := COALESCE(NULLIF(btrim(p_payload->>'cliente_nombre'), ''), v_venta.cliente_nombre);
  v_documento := COALESCE(NULLIF(btrim(p_payload->>'cliente_documento'), ''), v_venta.cliente_dni_cuit);
  v_domicilio := COALESCE(NULLIF(btrim(p_payload->>'cliente_domicilio'), ''), v_venta.cliente_direccion);
  IF v_cliente IS NULL OR btrim(v_cliente) = '' THEN
    RAISE EXCEPTION 'El remito necesita el nombre del destinatario';
  END IF;

  -- Numeración: una serie por tipo y punto de venta.
  PERFORM pg_advisory_xact_lock(hashtext('remito_serie:' || v_tipo || ':' || v_pv));

  IF v_tipo = 'R' THEN
    IF v_documento IS NULL OR btrim(v_documento) = '' THEN
      RAISE EXCEPTION 'El Remito R necesita el CUIT / DNI del destinatario';
    END IF;
    IF v_domicilio IS NULL OR btrim(v_domicilio) = '' THEN
      RAISE EXCEPTION 'El Remito R necesita el domicilio del destinatario';
    END IF;

    SELECT MAX(numero), MAX(fecha_emision) INTO v_numero, v_ultima_fecha
    FROM public.remitos WHERE tipo = 'R' AND punto_venta = v_pv;
    IF v_ultima_fecha IS NOT NULL AND v_fecha < v_ultima_fecha THEN
      RAISE EXCEPTION 'La fecha del Remito R no puede ser anterior a la del último emitido (%)', to_char(v_ultima_fecha, 'DD/MM/YYYY');
    END IF;
    v_numero := COALESCE(v_numero, 0) + 1;

    -- CAI activo, vigente a la fecha, cuyo rango contenga el próximo número
    -- (si el último número quedó antes del rango, se arranca en el "desde" del CAI).
    SELECT * INTO v_cai FROM public.remitos_cai c
    WHERE c.activo AND c.punto_venta = v_pv AND c.fecha_vencimiento >= v_fecha
      AND c.numero_hasta >= v_numero
    ORDER BY c.numero_desde
    LIMIT 1;
    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM public.remitos_cai c WHERE c.activo AND c.punto_venta = v_pv) THEN
        RAISE EXCEPTION 'El CAI del punto de venta % está vencido o se agotó su numeración: cargá el CAI nuevo', v_pv;
      END IF;
      RAISE EXCEPTION 'No hay CAI cargado para Remito R en el punto de venta %', v_pv;
    END IF;
    v_numero := GREATEST(v_numero, v_cai.numero_desde);
  ELSE
    SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
    FROM public.remitos WHERE tipo = v_tipo AND punto_venta = v_pv;
  END IF;

  INSERT INTO public.remitos (
    tipo, clase, punto_venta, numero, cai, cai_vencimiento,
    id_venta, numero_venta, id_op, numero_op,
    cliente_nombre, cliente_documento, cliente_domicilio, cliente_telefono, cliente_condicion_iva,
    fecha_emision, fecha_entrega, entregado_a, dni_retira, transportista, transportista_cuit,
    domicilio_entrega, deposito_origen, deposito_destino, observaciones,
    id_usuario, usuario_nombre
  ) VALUES (
    v_tipo, v_clase, v_pv, v_numero,
    CASE WHEN v_tipo = 'R' THEN v_cai.cai END,
    CASE WHEN v_tipo = 'R' THEN v_cai.fecha_vencimiento END,
    v_id_venta, v_venta.numero_venta, v_id_op,
    COALESCE(NULLIF(p_payload->>'numero_op', ''), v_venta.numero_op),
    btrim(v_cliente),
    NULLIF(btrim(v_documento), ''),
    NULLIF(btrim(v_domicilio), ''),
    COALESCE(NULLIF(btrim(p_payload->>'cliente_telefono'), ''), v_venta.cliente_telefono),
    NULLIF(btrim(p_payload->>'cliente_condicion_iva'), ''),
    v_fecha,
    NULLIF(p_payload->>'fecha_entrega', '')::date,
    NULLIF(btrim(p_payload->>'entregado_a'), ''),
    NULLIF(btrim(p_payload->>'dni_retira'), ''),
    NULLIF(btrim(p_payload->>'transportista'), ''),
    NULLIF(btrim(p_payload->>'transportista_cuit'), ''),
    NULLIF(btrim(p_payload->>'domicilio_entrega'), ''),
    NULLIF(btrim(p_payload->>'deposito_origen'), ''),
    NULLIF(btrim(p_payload->>'deposito_destino'), ''),
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
    IF v_clase = 'Devolucion' AND v_id_vi IS NULL AND v_id_ol IS NULL THEN
      RAISE EXCEPTION 'En una devolución cada línea tiene que ser de la venta o de la OP (línea %)', v_orden;
    END IF;

    -- "previa" = lo entregado neto (entregas − devoluciones) antes de este remito.
    IF v_id_vi IS NOT NULL THEN
      IF v_id_venta IS NULL THEN
        RAISE EXCEPTION 'La línea % es de una venta pero el remito no tiene venta', v_orden;
      END IF;
      SELECT vi.cantidad, COALESCE(v_desc, vi.descripcion) INTO v_pedida, v_desc
      FROM public.ventas_items vi WHERE vi.id = v_id_vi AND vi.id_venta = v_id_venta;
      IF v_pedida IS NULL THEN
        RAISE EXCEPTION 'La línea % no pertenece a la venta %', v_orden, v_venta.numero_venta;
      END IF;
      SELECT COALESCE(SUM(CASE WHEN r.clase = 'Devolucion' THEN -ri.cantidad ELSE ri.cantidad END), 0) INTO v_previa
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
      SELECT COALESCE(SUM(CASE WHEN r.clase = 'Devolucion' THEN -ri.cantidad ELSE ri.cantidad END), 0) INTO v_previa
      FROM public.remitos_items ri JOIN public.remitos r ON r.id = ri.id_remito
      WHERE ri.id_op_linea = v_id_ol AND r.estado = 'Emitido' AND r.id <> v_id;
    END IF;

    IF v_pedida IS NOT NULL THEN
      IF v_clase = 'Devolucion' THEN
        IF v_cant > v_previa THEN
          RAISE EXCEPTION 'La línea "%" devuelve % pero solo se entregaron %', v_desc, trim_scale(v_cant), trim_scale(GREATEST(v_previa, 0));
        END IF;
      ELSIF v_cant > v_pedida - v_previa THEN
        RAISE EXCEPTION 'La línea "%" supera lo pendiente (pedido %, ya remitido %, pendiente %)',
          v_desc, trim_scale(v_pedida), trim_scale(v_previa), trim_scale(GREATEST(v_pedida - v_previa, 0));
      END IF;
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

-- ---------------------------------------------------------------------------
-- 5) Anulación
-- ---------------------------------------------------------------------------
-- Igual que antes, pero anular una devolución vuelve a sumar lo devuelto como entregado:
-- si después ya se volvió a entregar, se pasaría del pedido. En ese caso se pide anular
-- primero la entrega posterior.
CREATE OR REPLACE FUNCTION public.remito_anular(p_actor_id integer, p_id_remito bigint, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remito public.remitos%ROWTYPE;
  v_linea record;
  v_out jsonb;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para anular remitos';
  END IF;
  IF btrim(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Indicá el motivo de la anulación';
  END IF;

  SELECT * INTO v_remito FROM public.remitos WHERE id = p_id_remito;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Remito % no encontrado', p_id_remito;
  END IF;
  IF v_remito.estado <> 'Emitido' THEN
    RAISE EXCEPTION 'El remito ya estaba anulado';
  END IF;

  IF v_remito.clase = 'Devolucion' THEN
    IF v_remito.id_venta IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtext('remito_venta:' || v_remito.id_venta));
    END IF;
    IF v_remito.id_op IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtext('remito_op:' || v_remito.id_op));
    END IF;
    FOR v_linea IN
      SELECT ri.descripcion, ri.cantidad, ri.cantidad_pedida,
        (SELECT COALESCE(SUM(CASE WHEN r2.clase = 'Devolucion' THEN -ri2.cantidad ELSE ri2.cantidad END), 0)
         FROM public.remitos_items ri2 JOIN public.remitos r2 ON r2.id = ri2.id_remito
         WHERE r2.estado = 'Emitido'
           AND ((ri.id_venta_item IS NOT NULL AND ri2.id_venta_item = ri.id_venta_item)
             OR (ri.id_op_linea IS NOT NULL AND ri2.id_op_linea = ri.id_op_linea))) AS entregado_neto
      FROM public.remitos_items ri
      WHERE ri.id_remito = p_id_remito AND ri.cantidad_pedida IS NOT NULL
    LOOP
      IF v_linea.entregado_neto + v_linea.cantidad > v_linea.cantidad_pedida THEN
        RAISE EXCEPTION 'No se puede anular la devolución: "%" ya se volvió a entregar. Anulá primero esa entrega.', v_linea.descripcion;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.remitos
  SET estado = 'Anulado', anulado_motivo = btrim(p_motivo), anulado_at = now(),
      anulado_por = p_actor_id, updated_at = now()
  WHERE id = p_id_remito AND estado = 'Emitido'
  RETURNING to_jsonb(remitos.*) INTO v_out;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remito_anular(integer, bigint, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
