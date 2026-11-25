-- 2026-11-25 — Anular gasto con motivo, movimiento auditado y baja del libro IVA si está trazado.
ALTER TABLE public.erp_gastos
  ADD COLUMN IF NOT EXISTS anulado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anulado_motivo text,
  ADD COLUMN IF NOT EXISTS anulado_at timestamptz,
  ADD COLUMN IF NOT EXISTS anulado_por integer;

CREATE INDEX IF NOT EXISTS erp_gastos_vigentes_idx
  ON public.erp_gastos (fecha_gasto DESC)
  WHERE anulado = false;

CREATE TABLE IF NOT EXISTS public.erp_gastos_movimientos (
  id bigserial PRIMARY KEY,
  id_gasto integer NOT NULL REFERENCES public.erp_gastos(id) ON DELETE CASCADE,
  accion text NOT NULL,
  motivo text NOT NULL,
  id_usuario integer,
  id_factura_compra integer,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS erp_gastos_movimientos_gasto_idx
  ON public.erp_gastos_movimientos (id_gasto, created_at DESC);

ALTER TABLE public.erp_gastos_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_gastos_movimientos acceso" ON public.erp_gastos_movimientos;
CREATE POLICY "erp_gastos_movimientos acceso"
  ON public.erp_gastos_movimientos
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.erp_gastos_movimientos TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.erp_gastos_movimientos_id_seq TO anon, authenticated;

COMMENT ON COLUMN public.erp_gastos.anulado IS 'Gasto dado de baja (no cuenta en listados ni balance)';
COMMENT ON TABLE public.erp_gastos_movimientos IS 'Auditoría de altas/anulaciones de erp_gastos';

CREATE OR REPLACE FUNCTION public.erp_gasto_anular(
  p_actor_id integer,
  p_id_gasto integer,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gasto public.erp_gastos%ROWTYPE;
  v_motivo text := btrim(COALESCE(p_motivo, ''));
  v_id_fc integer;
  v_libro_borrado boolean := false;
BEGIN
  IF p_id_gasto IS NULL THEN
    RAISE EXCEPTION 'Gasto inválido';
  END IF;
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Indicá el motivo de la anulación';
  END IF;

  SELECT * INTO v_gasto
  FROM public.erp_gastos
  WHERE id = p_id_gasto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gasto % no encontrado', p_id_gasto;
  END IF;

  IF COALESCE(v_gasto.anulado, false) THEN
    RAISE EXCEPTION 'El gasto ya estaba anulado';
  END IF;

  v_id_fc := v_gasto.id_factura_compra;

  -- Si no hay id, buscar factura de libro marcada erp_gasto:{id}
  IF v_id_fc IS NULL THEN
    SELECT id INTO v_id_fc
    FROM public.facturas_compra
    WHERE observaciones = 'erp_gasto:' || p_id_gasto::text
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  IF v_id_fc IS NOT NULL THEN
    DELETE FROM public.facturas_compra WHERE id = v_id_fc;
    v_libro_borrado := FOUND;
  END IF;

  UPDATE public.erp_gastos
  SET
    anulado = true,
    anulado_motivo = v_motivo,
    anulado_at = now(),
    anulado_por = p_actor_id,
    id_factura_compra = NULL,
    updated_at = now()
  WHERE id = p_id_gasto;

  INSERT INTO public.erp_gastos_movimientos (
    id_gasto, accion, motivo, id_usuario, id_factura_compra, snapshot
  ) VALUES (
    p_id_gasto,
    'anular',
    v_motivo,
    p_actor_id,
    v_id_fc,
    jsonb_build_object(
      'fecha_gasto', v_gasto.fecha_gasto,
      'proveedor', v_gasto.proveedor,
      'proveedor_cuit', v_gasto.proveedor_cuit,
      'total', v_gasto.total,
      'iva', v_gasto.iva,
      'neto', v_gasto.neto,
      'numero_comprobante', v_gasto.numero_comprobante,
      'punto_venta', v_gasto.punto_venta,
      'letra', v_gasto.letra,
      'tipo_comprobante', v_gasto.tipo_comprobante,
      'id_factura_compra', v_id_fc,
      'libro_borrado', v_libro_borrado,
      'categoria', v_gasto.categoria,
      'descripcion', v_gasto.descripcion,
      'origen', v_gasto.origen
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id_gasto', p_id_gasto,
    'id_factura_compra', v_id_fc,
    'libro_borrado', v_libro_borrado,
    'motivo', v_motivo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.erp_gasto_anular(integer, integer, text) TO anon, authenticated;
