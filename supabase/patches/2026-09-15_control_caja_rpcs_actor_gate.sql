-- Paso 17 seguridad (caja): RPCs DEFINER con actor gate para escrituras.
-- NO revoca SELECT/DML todavía (Paso 18). El front debe preferir estas RPCs
-- cuando hay actor; el acceso directo a tabla sigue hasta el REVOKE.

-- Admin/gerencia activos: pueden operar cualquier caja.
CREATE OR REPLACE FUNCTION public.actor_es_admin_caja(p_actor_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_actor_id
      AND COALESCE(u.activo, true) = true
      AND u.rol IN ('administracion', 'gerencia')
  );
$$;

REVOKE ALL ON FUNCTION public.actor_es_admin_caja(integer) FROM PUBLIC, anon, authenticated;

-- Titular de caja operativa u-{id} o id_usuario en control_caja_cajas.
-- Cajas sistema (admin, vuelto): solo admin/gerencia.
CREATE OR REPLACE FUNCTION public.actor_puede_operar_caja_slug(
  p_actor_id integer,
  p_caja_slug text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titular integer;
BEGIN
  IF p_actor_id IS NULL OR p_caja_slug IS NULL OR btrim(p_caja_slug) = '' THEN
    RETURN false;
  END IF;

  IF public.actor_es_admin_caja(p_actor_id) THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_actor_id AND COALESCE(u.activo, true) = true
  ) THEN
    RETURN false;
  END IF;

  IF p_caja_slug IN ('admin', 'vuelto') THEN
    RETURN false;
  END IF;

  IF p_caja_slug ~ '^u-[0-9]+$' AND substring(p_caja_slug from 3)::integer = p_actor_id THEN
    RETURN true;
  END IF;

  SELECT c.id_usuario INTO v_titular
  FROM public.control_caja_cajas c
  WHERE c.slug = p_caja_slug;

  RETURN v_titular IS NOT NULL AND v_titular = p_actor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.actor_puede_operar_caja_slug(integer, text) FROM PUBLIC, anon, authenticated;

-- Misma lógica que assertPuedeGrabarMovimiento (origen operativa → dueño; si no, destino).
CREATE OR REPLACE FUNCTION public.actor_puede_grabar_movimiento_caja(
  p_actor_id integer,
  p_origen_slug text,
  p_destino_slug text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origen_op boolean;
  v_destino_op boolean;
BEGIN
  IF public.actor_es_admin_caja(p_actor_id) THEN
    RETURN true;
  END IF;

  v_origen_op :=
    p_origen_slug IS NOT NULL
    AND p_origen_slug NOT IN ('admin', 'vuelto')
    AND (
      p_origen_slug ~ '^u-[0-9]+$'
      OR EXISTS (SELECT 1 FROM public.control_caja_cajas c WHERE c.slug = p_origen_slug AND c.id_usuario IS NOT NULL)
    );

  v_destino_op :=
    p_destino_slug IS NOT NULL
    AND p_destino_slug NOT IN ('admin', 'vuelto')
    AND (
      p_destino_slug ~ '^u-[0-9]+$'
      OR EXISTS (SELECT 1 FROM public.control_caja_cajas c WHERE c.slug = p_destino_slug AND c.id_usuario IS NOT NULL)
    );

  IF v_origen_op THEN
    RETURN public.actor_puede_operar_caja_slug(p_actor_id, p_origen_slug);
  END IF;

  IF v_destino_op THEN
    RETURN public.actor_puede_operar_caja_slug(p_actor_id, p_destino_slug);
  END IF;

  -- Solo cajas sistema ↔ sistema: requiere admin (ya cubierto arriba) o actor activo.
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_actor_id AND COALESCE(u.activo, true) = true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.actor_puede_grabar_movimiento_caja(integer, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.caja_upsert_movimiento(
  p_actor_id integer,
  p_row jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origen text := p_row->>'origen_slug';
  v_destino text := p_row->>'destino_slug';
  v_id uuid;
BEGIN
  IF p_actor_id IS NULL OR p_row IS NULL THEN
    RAISE EXCEPTION 'No autorizado para escribir movimientos de caja';
  END IF;

  IF NOT public.actor_puede_grabar_movimiento_caja(p_actor_id, v_origen, v_destino) THEN
    RAISE EXCEPTION 'No autorizado para escribir movimientos de caja';
  END IF;

  v_id := COALESCE((p_row->>'id')::uuid, gen_random_uuid());

  INSERT INTO public.control_caja_movimientos AS m (
    id, fecha, hora, concepto, origen_slug, destino_slug,
    efectivo, otros, nro_comprobante, observacion,
    id_usuario, usuario_nombre, origen_importacion,
    origen_efectivo_antes, origen_otros_antes,
    destino_efectivo_antes, destino_otros_antes,
    origen_efectivo_despues, origen_otros_despues,
    destino_efectivo_despues, destino_otros_despues,
    id_lote, subtipo_pase, traspaso_id, medios,
    tipo_movimiento, categoria, tercero_nombre, monto_total,
    cuenta_corriente, cheque_propio, cheque_tercero, tarjeta,
    documento, cuenta_contable, transferencia_bancaria,
    cierre_id, anulado, updated_at
  ) VALUES (
    v_id,
    (p_row->>'fecha')::date,
    NULLIF(p_row->>'hora', '')::time,
    COALESCE(p_row->>'concepto', ''),
    v_origen,
    v_destino,
    COALESCE((p_row->>'efectivo')::numeric, 0),
    COALESCE((p_row->>'otros')::numeric, 0),
    NULLIF(p_row->>'nro_comprobante', ''),
    NULLIF(p_row->>'observacion', ''),
    NULLIF(p_row->>'id_usuario', '')::integer,
    NULLIF(p_row->>'usuario_nombre', ''),
    COALESCE(NULLIF(p_row->>'origen_importacion', ''), 'manual'),
    NULLIF(p_row->>'origen_efectivo_antes', '')::numeric,
    NULLIF(p_row->>'origen_otros_antes', '')::numeric,
    NULLIF(p_row->>'destino_efectivo_antes', '')::numeric,
    NULLIF(p_row->>'destino_otros_antes', '')::numeric,
    NULLIF(p_row->>'origen_efectivo_despues', '')::numeric,
    NULLIF(p_row->>'origen_otros_despues', '')::numeric,
    NULLIF(p_row->>'destino_efectivo_despues', '')::numeric,
    NULLIF(p_row->>'destino_otros_despues', '')::numeric,
    NULLIF(p_row->>'id_lote', '')::uuid,
    NULLIF(p_row->>'subtipo_pase', ''),
    NULLIF(p_row->>'traspaso_id', '')::uuid,
    CASE WHEN p_row ? 'medios' AND p_row->'medios' IS NOT NULL AND p_row->>'medios' <> 'null'
      THEN p_row->'medios' ELSE NULL END,
    NULLIF(p_row->>'tipo_movimiento', ''),
    NULLIF(p_row->>'categoria', ''),
    NULLIF(p_row->>'tercero_nombre', ''),
    NULLIF(p_row->>'monto_total', '')::numeric,
    COALESCE(NULLIF(p_row->>'cuenta_corriente', '')::numeric, 0),
    COALESCE(NULLIF(p_row->>'cheque_propio', '')::numeric, 0),
    COALESCE(NULLIF(p_row->>'cheque_tercero', '')::numeric, 0),
    COALESCE(NULLIF(p_row->>'tarjeta', '')::numeric, 0),
    COALESCE(NULLIF(p_row->>'documento', '')::numeric, 0),
    COALESCE(NULLIF(p_row->>'cuenta_contable', '')::numeric, 0),
    COALESCE(NULLIF(p_row->>'transferencia_bancaria', '')::numeric, 0),
    NULLIF(p_row->>'cierre_id', '')::uuid,
    COALESCE((p_row->>'anulado')::boolean, false),
    COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    fecha = EXCLUDED.fecha,
    hora = EXCLUDED.hora,
    concepto = EXCLUDED.concepto,
    origen_slug = EXCLUDED.origen_slug,
    destino_slug = EXCLUDED.destino_slug,
    efectivo = EXCLUDED.efectivo,
    otros = EXCLUDED.otros,
    nro_comprobante = EXCLUDED.nro_comprobante,
    observacion = EXCLUDED.observacion,
    id_usuario = EXCLUDED.id_usuario,
    usuario_nombre = EXCLUDED.usuario_nombre,
    origen_importacion = EXCLUDED.origen_importacion,
    origen_efectivo_antes = EXCLUDED.origen_efectivo_antes,
    origen_otros_antes = EXCLUDED.origen_otros_antes,
    destino_efectivo_antes = EXCLUDED.destino_efectivo_antes,
    destino_otros_antes = EXCLUDED.destino_otros_antes,
    origen_efectivo_despues = EXCLUDED.origen_efectivo_despues,
    origen_otros_despues = EXCLUDED.origen_otros_despues,
    destino_efectivo_despues = EXCLUDED.destino_efectivo_despues,
    destino_otros_despues = EXCLUDED.destino_otros_despues,
    id_lote = EXCLUDED.id_lote,
    subtipo_pase = EXCLUDED.subtipo_pase,
    traspaso_id = EXCLUDED.traspaso_id,
    medios = EXCLUDED.medios,
    tipo_movimiento = EXCLUDED.tipo_movimiento,
    categoria = EXCLUDED.categoria,
    tercero_nombre = EXCLUDED.tercero_nombre,
    monto_total = EXCLUDED.monto_total,
    cuenta_corriente = EXCLUDED.cuenta_corriente,
    cheque_propio = EXCLUDED.cheque_propio,
    cheque_tercero = EXCLUDED.cheque_tercero,
    tarjeta = EXCLUDED.tarjeta,
    documento = EXCLUDED.documento,
    cuenta_contable = EXCLUDED.cuenta_contable,
    transferencia_bancaria = EXCLUDED.transferencia_bancaria,
    cierre_id = EXCLUDED.cierre_id,
    anulado = EXCLUDED.anulado,
    updated_at = EXCLUDED.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.caja_upsert_movimiento(integer, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.caja_delete_movimiento(
  p_actor_id integer,
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origen text;
  v_destino text;
BEGIN
  IF p_actor_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado para borrar movimientos de caja';
  END IF;

  SELECT m.origen_slug, m.destino_slug INTO v_origen, v_destino
  FROM public.control_caja_movimientos m
  WHERE m.id = p_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT public.actor_puede_grabar_movimiento_caja(p_actor_id, v_origen, v_destino) THEN
    RAISE EXCEPTION 'No autorizado para borrar movimientos de caja';
  END IF;

  DELETE FROM public.control_caja_movimientos WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.caja_delete_movimiento(integer, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.caja_insert_movimientos(
  p_actor_id integer,
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_elem jsonb;
  v_count integer := 0;
BEGIN
  IF p_actor_id IS NULL OR p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'No autorizado para importar movimientos de caja';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    PERFORM public.caja_upsert_movimiento(p_actor_id, v_elem);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.caja_insert_movimientos(integer, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.caja_upsert_arqueo(
  p_actor_id integer,
  p_row jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := p_row->>'caja_slug';
  v_id uuid;
BEGIN
  IF p_actor_id IS NULL OR p_row IS NULL THEN
    RAISE EXCEPTION 'No autorizado para escribir arqueos de caja';
  END IF;

  IF NOT public.actor_puede_operar_caja_slug(p_actor_id, v_slug) THEN
    RAISE EXCEPTION 'No autorizado para escribir arqueos de caja';
  END IF;

  v_id := COALESCE((p_row->>'id')::uuid, gen_random_uuid());

  INSERT INTO public.control_caja_arqueos AS a (
    id, fecha, caja_slug, turno, id_usuario, usuario_nombre,
    billetes, total, diferencia, estado_arqueo, saldos, firma_data_url
  ) VALUES (
    v_id,
    (p_row->>'fecha')::date,
    v_slug,
    COALESCE(NULLIF(p_row->>'turno', ''), 'unico'),
    NULLIF(p_row->>'id_usuario', '')::integer,
    NULLIF(p_row->>'usuario_nombre', ''),
    COALESCE(p_row->'billetes', '{}'::jsonb),
    COALESCE((p_row->>'total')::numeric, 0),
    NULLIF(p_row->>'diferencia', '')::numeric,
    NULLIF(p_row->>'estado_arqueo', ''),
    CASE WHEN p_row ? 'saldos' AND p_row->'saldos' IS NOT NULL AND p_row->>'saldos' <> 'null'
      THEN p_row->'saldos' ELSE NULL END,
    NULLIF(p_row->>'firma_data_url', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    fecha = EXCLUDED.fecha,
    caja_slug = EXCLUDED.caja_slug,
    turno = EXCLUDED.turno,
    id_usuario = EXCLUDED.id_usuario,
    usuario_nombre = EXCLUDED.usuario_nombre,
    billetes = EXCLUDED.billetes,
    total = EXCLUDED.total,
    diferencia = EXCLUDED.diferencia,
    estado_arqueo = EXCLUDED.estado_arqueo,
    saldos = EXCLUDED.saldos,
    firma_data_url = EXCLUDED.firma_data_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.caja_upsert_arqueo(integer, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.caja_upsert_cierre(
  p_actor_id integer,
  p_row jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := p_row->>'caja_slug';
  v_id uuid;
BEGIN
  IF p_actor_id IS NULL OR p_row IS NULL THEN
    RAISE EXCEPTION 'No autorizado para escribir cierres de caja';
  END IF;

  IF NOT public.actor_puede_operar_caja_slug(p_actor_id, v_slug) THEN
    RAISE EXCEPTION 'No autorizado para escribir cierres de caja';
  END IF;

  v_id := COALESCE((p_row->>'id')::uuid, gen_random_uuid());

  INSERT INTO public.control_caja_cierres AS c (
    id, fecha, caja_slug, turno, cajera, email_ok, fondo_fijo,
    ing_ef, egr_ef, ef_teorico, ef_contado, dif_ef,
    tarj_sist, tarj_fis, dif_tarj, mp_qr, trans, cta_cte,
    total_ventas, dif_total, estado, observacion, id_planilla,
    estado_cierre, fecha_hasta, snapshot_totales, id_usuario, updated_at
  ) VALUES (
    v_id,
    (p_row->>'fecha')::date,
    v_slug,
    COALESCE(NULLIF(p_row->>'turno', ''), 'unico'),
    COALESCE(NULLIF(p_row->>'cajera', ''), ''),
    NULLIF(p_row->>'email_ok', ''),
    COALESCE((p_row->>'fondo_fijo')::numeric, 0),
    COALESCE((p_row->>'ing_ef')::numeric, 0),
    COALESCE((p_row->>'egr_ef')::numeric, 0),
    COALESCE((p_row->>'ef_teorico')::numeric, 0),
    COALESCE((p_row->>'ef_contado')::numeric, 0),
    COALESCE((p_row->>'dif_ef')::numeric, 0),
    COALESCE((p_row->>'tarj_sist')::numeric, 0),
    COALESCE((p_row->>'tarj_fis')::numeric, 0),
    COALESCE((p_row->>'dif_tarj')::numeric, 0),
    COALESCE((p_row->>'mp_qr')::numeric, 0),
    COALESCE((p_row->>'trans')::numeric, 0),
    COALESCE((p_row->>'cta_cte')::numeric, 0),
    COALESCE((p_row->>'total_ventas')::numeric, 0),
    COALESCE((p_row->>'dif_total')::numeric, 0),
    COALESCE(NULLIF(p_row->>'estado', ''), 'ok'),
    NULLIF(p_row->>'observacion', ''),
    NULLIF(p_row->>'id_planilla', '')::uuid,
    COALESCE(NULLIF(p_row->>'estado_cierre', ''), 'abierto'),
    COALESCE(NULLIF(p_row->>'fecha_hasta', '')::date, (p_row->>'fecha')::date),
    CASE WHEN p_row ? 'snapshot_totales' AND p_row->'snapshot_totales' IS NOT NULL
      AND p_row->>'snapshot_totales' <> 'null'
      THEN p_row->'snapshot_totales' ELSE NULL END,
    NULLIF(p_row->>'id_usuario', '')::integer,
    COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    fecha = EXCLUDED.fecha,
    caja_slug = EXCLUDED.caja_slug,
    turno = EXCLUDED.turno,
    cajera = EXCLUDED.cajera,
    email_ok = EXCLUDED.email_ok,
    fondo_fijo = EXCLUDED.fondo_fijo,
    ing_ef = EXCLUDED.ing_ef,
    egr_ef = EXCLUDED.egr_ef,
    ef_teorico = EXCLUDED.ef_teorico,
    ef_contado = EXCLUDED.ef_contado,
    dif_ef = EXCLUDED.dif_ef,
    tarj_sist = EXCLUDED.tarj_sist,
    tarj_fis = EXCLUDED.tarj_fis,
    dif_tarj = EXCLUDED.dif_tarj,
    mp_qr = EXCLUDED.mp_qr,
    trans = EXCLUDED.trans,
    cta_cte = EXCLUDED.cta_cte,
    total_ventas = EXCLUDED.total_ventas,
    dif_total = EXCLUDED.dif_total,
    estado = EXCLUDED.estado,
    observacion = EXCLUDED.observacion,
    id_planilla = EXCLUDED.id_planilla,
    estado_cierre = EXCLUDED.estado_cierre,
    fecha_hasta = EXCLUDED.fecha_hasta,
    snapshot_totales = EXCLUDED.snapshot_totales,
    id_usuario = EXCLUDED.id_usuario,
    updated_at = EXCLUDED.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.caja_upsert_cierre(integer, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.caja_upsert_movimiento(integer, jsonb) IS
  'Paso 17: upsert movimiento con actor gate. Preferir desde front; DML directo hasta Paso 18.';
