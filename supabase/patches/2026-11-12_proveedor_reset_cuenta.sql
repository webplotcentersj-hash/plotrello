-- Reset de cuenta corriente de proveedor: borra libro/pagos, deja saldo 0 y guarda quién lo hizo.

ALTER TABLE public.deudas_proveedores
  ADD COLUMN IF NOT EXISTS cuenta_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS cuenta_reset_por text;

CREATE OR REPLACE FUNCTION public.proveedor_reset_cuenta(
  p_id_proveedor integer,
  p_usuario text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_tel text;
  v_usuario text;
  v_at timestamptz := now();
  v_mov_del integer := 0;
  v_pag_del integer := 0;
BEGIN
  IF p_id_proveedor IS NULL OR p_id_proveedor <= 0 THEN
    RAISE EXCEPTION 'Proveedor inválido';
  END IF;

  SELECT COALESCE(NULLIF(trim(razon_social), ''), nombre), COALESCE(NULLIF(trim(telefono), ''), '-')
    INTO v_nombre, v_tel
  FROM public.proveedores
  WHERE id = p_id_proveedor;

  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  v_usuario := NULLIF(trim(COALESCE(p_usuario, '')), '');
  IF v_usuario IS NULL THEN
    v_usuario := 'Sistema';
  END IF;

  DELETE FROM public.movimientos_proveedores
  WHERE id_proveedor = p_id_proveedor;
  GET DIAGNOSTICS v_mov_del = ROW_COUNT;

  DELETE FROM public.pagos_proveedores
  WHERE id_proveedor = p_id_proveedor;
  GET DIAGNOSTICS v_pag_del = ROW_COUNT;

  IF EXISTS (SELECT 1 FROM public.deudas_proveedores WHERE id_proveedor = p_id_proveedor) THEN
    UPDATE public.deudas_proveedores
    SET
      saldo = 0,
      fecha_corte = (v_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
      cuenta_reset_at = v_at,
      cuenta_reset_por = v_usuario,
      razon_social = v_nombre,
      updated_at = v_at
    WHERE id_proveedor = p_id_proveedor;
  ELSE
    INSERT INTO public.deudas_proveedores (
      codigo, razon_social, telefono, saldo, id_proveedor, fecha_corte,
      cuenta_reset_at, cuenta_reset_por
    ) VALUES (
      'P' || p_id_proveedor::text, v_nombre, v_tel, 0, p_id_proveedor,
      (v_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
      v_at, v_usuario
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'saldo', 0,
    'reset_por', v_usuario,
    'reset_at', v_at,
    'movimientos_borrados', v_mov_del,
    'pagos_borrados', v_pag_del
  );
END;
$$;

REVOKE ALL ON FUNCTION public.proveedor_reset_cuenta(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proveedor_reset_cuenta(integer, text) TO anon, authenticated;
