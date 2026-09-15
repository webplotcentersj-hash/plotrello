-- Paso 19: RPC auxiliar + REVOKE DML en tablas caja restantes.
-- SELECT sigue; escrituras solo DEFINER con actor.

CREATE OR REPLACE FUNCTION public.caja_upsert_aux(
  p_actor_id integer,
  p_kind text,
  p_row jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_id uuid;
BEGIN
  IF p_actor_id IS NULL OR p_row IS NULL OR p_kind IS NULL THEN
    RAISE EXCEPTION 'No autorizado para escribir en caja';
  END IF;

  IF p_kind = 'caja' THEN
    v_slug := p_row->>'slug';
    IF v_slug IN ('admin', 'vuelto') THEN
      IF NOT public.actor_es_admin_caja(p_actor_id) THEN
        RAISE EXCEPTION 'No autorizado para escribir cajas de sistema';
      END IF;
    ELSIF NOT public.actor_puede_operar_caja_slug(p_actor_id, v_slug)
      AND NOT public.actor_es_admin_caja(p_actor_id) THEN
      -- Titular creando su propia u-{id}
      IF NOT (v_slug ~ ('^u-' || p_actor_id || '$')) THEN
        RAISE EXCEPTION 'No autorizado para escribir registro de caja';
      END IF;
    END IF;

    INSERT INTO public.control_caja_cajas AS c (
      slug, nombre, fondo_fijo, activa, id_usuario, updated_at
    ) VALUES (
      v_slug,
      COALESCE(NULLIF(p_row->>'nombre', ''), v_slug),
      COALESCE((p_row->>'fondo_fijo')::numeric, 0),
      COALESCE((p_row->>'activa')::boolean, true),
      NULLIF(p_row->>'id_usuario', '')::integer,
      COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
    )
    ON CONFLICT (slug) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      fondo_fijo = EXCLUDED.fondo_fijo,
      activa = EXCLUDED.activa,
      id_usuario = COALESCE(EXCLUDED.id_usuario, c.id_usuario),
      updated_at = EXCLUDED.updated_at;
    RETURN;
  END IF;

  IF p_kind = 'traspaso' THEN
    v_slug := p_row->>'caja_origen_slug';
    IF NOT public.actor_puede_grabar_movimiento_caja(
      p_actor_id, v_slug, p_row->>'caja_destino_slug'
    ) THEN
      RAISE EXCEPTION 'No autorizado para escribir traspasos de caja';
    END IF;
    v_id := COALESCE((p_row->>'id')::uuid, gen_random_uuid());
    INSERT INTO public.control_caja_traspasos AS t (
      id, fecha, caja_origen_slug, caja_destino_slug,
      id_usuario, usuario_nombre, comprobante, monto_total,
      efectivo, tarjeta, transferencia_bancaria, cheque, documento, otros,
      estado, observacion, updated_at
    ) VALUES (
      v_id,
      (p_row->>'fecha')::date,
      v_slug,
      p_row->>'caja_destino_slug',
      NULLIF(p_row->>'id_usuario', '')::integer,
      NULLIF(p_row->>'usuario_nombre', ''),
      NULLIF(p_row->>'comprobante', ''),
      COALESCE((p_row->>'monto_total')::numeric, 0),
      COALESCE((p_row->>'efectivo')::numeric, 0),
      COALESCE((p_row->>'tarjeta')::numeric, 0),
      COALESCE((p_row->>'transferencia_bancaria')::numeric, 0),
      COALESCE((p_row->>'cheque')::numeric, 0),
      COALESCE((p_row->>'documento')::numeric, 0),
      COALESCE((p_row->>'otros')::numeric, 0),
      COALESCE(NULLIF(p_row->>'estado', ''), 'pendiente'),
      NULLIF(p_row->>'observacion', ''),
      COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
    )
    ON CONFLICT (id) DO UPDATE SET
      fecha = EXCLUDED.fecha,
      caja_origen_slug = EXCLUDED.caja_origen_slug,
      caja_destino_slug = EXCLUDED.caja_destino_slug,
      id_usuario = EXCLUDED.id_usuario,
      usuario_nombre = EXCLUDED.usuario_nombre,
      comprobante = EXCLUDED.comprobante,
      monto_total = EXCLUDED.monto_total,
      efectivo = EXCLUDED.efectivo,
      tarjeta = EXCLUDED.tarjeta,
      transferencia_bancaria = EXCLUDED.transferencia_bancaria,
      cheque = EXCLUDED.cheque,
      documento = EXCLUDED.documento,
      otros = EXCLUDED.otros,
      estado = EXCLUDED.estado,
      observacion = EXCLUDED.observacion,
      updated_at = EXCLUDED.updated_at;
    RETURN;
  END IF;

  IF p_kind = 'egreso' THEN
    v_slug := p_row->>'caja_slug';
    IF NOT public.actor_puede_operar_caja_slug(p_actor_id, v_slug)
      AND NOT public.actor_es_admin_caja(p_actor_id) THEN
      RAISE EXCEPTION 'No autorizado para escribir egresos de caja';
    END IF;
    v_id := COALESCE((p_row->>'id')::uuid, gen_random_uuid());
    INSERT INTO public.control_caja_egreso_solicitudes AS e (
      id, fecha, caja_slug, concepto, monto_efectivo, monto_otros, estado,
      solicitante_id, solicitante_nombre, aprobador_id, aprobador_nombre,
      observacion, motivo_rechazo, id_movimiento, url_ticket, updated_at
    ) VALUES (
      v_id,
      (p_row->>'fecha')::date,
      v_slug,
      COALESCE(p_row->>'concepto', ''),
      COALESCE((p_row->>'monto_efectivo')::numeric, 0),
      COALESCE((p_row->>'monto_otros')::numeric, 0),
      COALESCE(NULLIF(p_row->>'estado', ''), 'pendiente'),
      NULLIF(p_row->>'solicitante_id', '')::integer,
      NULLIF(p_row->>'solicitante_nombre', ''),
      NULLIF(p_row->>'aprobador_id', '')::integer,
      NULLIF(p_row->>'aprobador_nombre', ''),
      NULLIF(p_row->>'observacion', ''),
      NULLIF(p_row->>'motivo_rechazo', ''),
      NULLIF(p_row->>'id_movimiento', '')::uuid,
      NULLIF(p_row->>'url_ticket', ''),
      COALESCE(NULLIF(p_row->>'updated_at', '')::timestamptz, now())
    )
    ON CONFLICT (id) DO UPDATE SET
      fecha = EXCLUDED.fecha,
      caja_slug = EXCLUDED.caja_slug,
      concepto = EXCLUDED.concepto,
      monto_efectivo = EXCLUDED.monto_efectivo,
      monto_otros = EXCLUDED.monto_otros,
      estado = EXCLUDED.estado,
      solicitante_id = EXCLUDED.solicitante_id,
      solicitante_nombre = EXCLUDED.solicitante_nombre,
      aprobador_id = EXCLUDED.aprobador_id,
      aprobador_nombre = EXCLUDED.aprobador_nombre,
      observacion = EXCLUDED.observacion,
      motivo_rechazo = EXCLUDED.motivo_rechazo,
      id_movimiento = EXCLUDED.id_movimiento,
      url_ticket = EXCLUDED.url_ticket,
      updated_at = EXCLUDED.updated_at;
    RETURN;
  END IF;

  IF p_kind = 'lote' THEN
    v_slug := p_row->>'origen_slug';
    IF NOT public.actor_puede_operar_caja_slug(p_actor_id, v_slug)
      AND NOT public.actor_es_admin_caja(p_actor_id) THEN
      RAISE EXCEPTION 'No autorizado para escribir lotes de transferencia';
    END IF;
    v_id := COALESCE((p_row->>'id')::uuid, gen_random_uuid());
    INSERT INTO public.control_caja_transferencia_lotes AS l (
      id, fecha, hora, origen_slug, caja_fondo_destino_slug,
      arqueo_efectivo, arqueo_otros, fondo_monto, resto_efectivo, resto_otros,
      egresos_aprobados_ef, id_planilla, id_usuario, usuario_nombre,
      observacion, detalle
    ) VALUES (
      v_id,
      (p_row->>'fecha')::date,
      NULLIF(p_row->>'hora', '')::time,
      v_slug,
      COALESCE(p_row->>'caja_fondo_destino_slug', 'admin'),
      COALESCE((p_row->>'arqueo_efectivo')::numeric, 0),
      COALESCE((p_row->>'arqueo_otros')::numeric, 0),
      COALESCE((p_row->>'fondo_monto')::numeric, 0),
      COALESCE((p_row->>'resto_efectivo')::numeric, 0),
      COALESCE((p_row->>'resto_otros')::numeric, 0),
      COALESCE((p_row->>'egresos_aprobados_ef')::numeric, 0),
      NULLIF(p_row->>'id_planilla', '')::uuid,
      NULLIF(p_row->>'id_usuario', '')::integer,
      NULLIF(p_row->>'usuario_nombre', ''),
      NULLIF(p_row->>'observacion', ''),
      CASE WHEN p_row ? 'detalle' AND p_row->>'detalle' <> 'null' THEN p_row->'detalle' ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
      fecha = EXCLUDED.fecha,
      hora = EXCLUDED.hora,
      origen_slug = EXCLUDED.origen_slug,
      caja_fondo_destino_slug = EXCLUDED.caja_fondo_destino_slug,
      arqueo_efectivo = EXCLUDED.arqueo_efectivo,
      arqueo_otros = EXCLUDED.arqueo_otros,
      fondo_monto = EXCLUDED.fondo_monto,
      resto_efectivo = EXCLUDED.resto_efectivo,
      resto_otros = EXCLUDED.resto_otros,
      egresos_aprobados_ef = EXCLUDED.egresos_aprobados_ef,
      id_planilla = EXCLUDED.id_planilla,
      id_usuario = EXCLUDED.id_usuario,
      usuario_nombre = EXCLUDED.usuario_nombre,
      observacion = EXCLUDED.observacion,
      detalle = EXCLUDED.detalle;
    RETURN;
  END IF;

  IF p_kind = 'planilla' THEN
    v_slug := NULLIF(p_row->>'caja_slug', '');
    IF v_slug IS NOT NULL THEN
      IF NOT public.actor_puede_operar_caja_slug(p_actor_id, v_slug)
        AND NOT public.actor_es_admin_caja(p_actor_id) THEN
        RAISE EXCEPTION 'No autorizado para escribir planillas de caja';
      END IF;
    ELSIF NOT public.actor_es_admin_caja(p_actor_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = p_actor_id AND COALESCE(u.activo, true)
      ) THEN
      RAISE EXCEPTION 'No autorizado para escribir planillas de caja';
    END IF;
    v_id := COALESCE((p_row->>'id')::uuid, gen_random_uuid());
    INSERT INTO public.control_caja_planillas AS p (
      id, archivo_nombre, fecha_desde, fecha_hasta, caja_nombre, caja_slug,
      totales, datos, id_usuario, usuario_nombre
    ) VALUES (
      v_id,
      COALESCE(p_row->>'archivo_nombre', ''),
      NULLIF(p_row->>'fecha_desde', '')::date,
      NULLIF(p_row->>'fecha_hasta', '')::date,
      COALESCE(p_row->>'caja_nombre', ''),
      v_slug,
      CASE WHEN p_row ? 'totales' AND p_row->>'totales' <> 'null' THEN p_row->'totales' ELSE NULL END,
      CASE WHEN p_row ? 'datos' AND p_row->>'datos' <> 'null' THEN p_row->'datos' ELSE NULL END,
      NULLIF(p_row->>'id_usuario', '')::integer,
      NULLIF(p_row->>'usuario_nombre', '')
    )
    ON CONFLICT (id) DO UPDATE SET
      archivo_nombre = EXCLUDED.archivo_nombre,
      fecha_desde = EXCLUDED.fecha_desde,
      fecha_hasta = EXCLUDED.fecha_hasta,
      caja_nombre = EXCLUDED.caja_nombre,
      caja_slug = EXCLUDED.caja_slug,
      totales = EXCLUDED.totales,
      datos = EXCLUDED.datos,
      id_usuario = EXCLUDED.id_usuario,
      usuario_nombre = EXCLUDED.usuario_nombre;
    RETURN;
  END IF;

  IF p_kind IN ('concil_mp', 'concil_banco') THEN
    IF NOT public.actor_es_admin_caja(p_actor_id) THEN
      RAISE EXCEPTION 'Solo admin/gerencia puede escribir conciliaciones';
    END IF;
    v_id := COALESCE((p_row->>'id')::uuid, gen_random_uuid());
    IF p_kind = 'concil_mp' THEN
      INSERT INTO public.control_caja_concil_mp AS m (
        id, fecha, sistema, dashboard, diferencia, estado, observacion
      ) VALUES (
        v_id,
        (p_row->>'fecha')::date,
        COALESCE((p_row->>'sistema')::numeric, 0),
        COALESCE((p_row->>'dashboard')::numeric, 0),
        COALESCE((p_row->>'diferencia')::numeric, 0),
        COALESCE(NULLIF(p_row->>'estado', ''), 'REVISAR'),
        NULLIF(p_row->>'observacion', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        fecha = EXCLUDED.fecha,
        sistema = EXCLUDED.sistema,
        dashboard = EXCLUDED.dashboard,
        diferencia = EXCLUDED.diferencia,
        estado = EXCLUDED.estado,
        observacion = EXCLUDED.observacion;
    ELSE
      INSERT INTO public.control_caja_concil_banco AS b (
        id, fecha, sistema, extracto, diferencia, estado, observacion
      ) VALUES (
        v_id,
        (p_row->>'fecha')::date,
        COALESCE((p_row->>'sistema')::numeric, 0),
        COALESCE((p_row->>'extracto')::numeric, 0),
        COALESCE((p_row->>'diferencia')::numeric, 0),
        COALESCE(NULLIF(p_row->>'estado', ''), 'REVISAR'),
        NULLIF(p_row->>'observacion', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        fecha = EXCLUDED.fecha,
        sistema = EXCLUDED.sistema,
        extracto = EXCLUDED.extracto,
        diferencia = EXCLUDED.diferencia,
        estado = EXCLUDED.estado,
        observacion = EXCLUDED.observacion;
    END IF;
    RETURN;
  END IF;

  IF p_kind = 'diferencia' THEN
    v_slug := NULLIF(p_row->>'caja_slug', '');
    IF v_slug IS NOT NULL THEN
      IF NOT public.actor_puede_operar_caja_slug(p_actor_id, v_slug)
        AND NOT public.actor_es_admin_caja(p_actor_id) THEN
        RAISE EXCEPTION 'No autorizado para escribir diferencias de caja';
      END IF;
    ELSIF NOT public.actor_es_admin_caja(p_actor_id) THEN
      RAISE EXCEPTION 'No autorizado para escribir diferencias de caja';
    END IF;
    v_id := COALESCE((p_row->>'id')::uuid, gen_random_uuid());
    INSERT INTO public.control_caja_diferencias AS d (
      id, fecha, caja_slug, tipo, monto, motivo, responsable, estado, id_cierre
    ) VALUES (
      v_id,
      (p_row->>'fecha')::date,
      v_slug,
      COALESCE(NULLIF(p_row->>'tipo', ''), 'Faltante'),
      COALESCE((p_row->>'monto')::numeric, 0),
      NULLIF(p_row->>'motivo', ''),
      NULLIF(p_row->>'responsable', ''),
      COALESCE(NULLIF(p_row->>'estado', ''), 'Pendiente'),
      NULLIF(p_row->>'id_cierre', '')::uuid
    )
    ON CONFLICT (id) DO UPDATE SET
      fecha = EXCLUDED.fecha,
      caja_slug = EXCLUDED.caja_slug,
      tipo = EXCLUDED.tipo,
      monto = EXCLUDED.monto,
      motivo = EXCLUDED.motivo,
      responsable = EXCLUDED.responsable,
      estado = EXCLUDED.estado,
      id_cierre = EXCLUDED.id_cierre;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Tipo de escritura de caja desconocido: %', p_kind;
END;
$$;

GRANT EXECUTE ON FUNCTION public.caja_upsert_aux(integer, text, jsonb) TO anon, authenticated;

-- Policies SELECT-only + REVOKE DML
DROP POLICY IF EXISTS control_caja_cajas_all ON public.control_caja_cajas;
CREATE POLICY control_caja_cajas_select ON public.control_caja_cajas
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS control_caja_traspasos_all ON public.control_caja_traspasos;
CREATE POLICY control_caja_traspasos_select ON public.control_caja_traspasos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS control_caja_egreso_sol_all ON public.control_caja_egreso_solicitudes;
CREATE POLICY control_caja_egreso_sol_select ON public.control_caja_egreso_solicitudes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS control_caja_lotes_all ON public.control_caja_transferencia_lotes;
CREATE POLICY control_caja_lotes_select ON public.control_caja_transferencia_lotes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS control_caja_planillas_all ON public.control_caja_planillas;
CREATE POLICY control_caja_planillas_select ON public.control_caja_planillas
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS control_caja_concil_mp_all ON public.control_caja_concil_mp;
CREATE POLICY control_caja_concil_mp_select ON public.control_caja_concil_mp
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS control_caja_concil_banco_all ON public.control_caja_concil_banco;
CREATE POLICY control_caja_concil_banco_select ON public.control_caja_concil_banco
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS control_caja_diferencias_all ON public.control_caja_diferencias;
CREATE POLICY control_caja_diferencias_select ON public.control_caja_diferencias
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_cajas FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_traspasos FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_egreso_solicitudes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_transferencia_lotes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_planillas FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_concil_mp FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_concil_banco FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.control_caja_diferencias FROM anon, authenticated;

GRANT SELECT ON TABLE public.control_caja_cajas TO anon, authenticated;
GRANT SELECT ON TABLE public.control_caja_traspasos TO anon, authenticated;
GRANT SELECT ON TABLE public.control_caja_egreso_solicitudes TO anon, authenticated;
GRANT SELECT ON TABLE public.control_caja_transferencia_lotes TO anon, authenticated;
GRANT SELECT ON TABLE public.control_caja_planillas TO anon, authenticated;
GRANT SELECT ON TABLE public.control_caja_concil_mp TO anon, authenticated;
GRANT SELECT ON TABLE public.control_caja_concil_banco TO anon, authenticated;
GRANT SELECT ON TABLE public.control_caja_diferencias TO anon, authenticated;
