-- Fix: buscar_o_crear_cliente fallaba al actualizar clientes existentes (ej. municipalidades)
-- ERROR 42702: column reference "id" / "dni_cuit" is ambiguous
-- Causa: RETURNS TABLE (id ...) + UPDATE SET col = COALESCE(..., col) sin calificar tabla.

CREATE OR REPLACE FUNCTION public.buscar_o_crear_cliente(
  p_nombre text,
  p_dni_cuit text DEFAULT NULL::text,
  p_telefono text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_direccion text DEFAULT NULL::text,
  p_ubicacion_link text DEFAULT NULL::text,
  p_drive_link text DEFAULT NULL::text
)
RETURNS TABLE (
  id integer,
  nombre text,
  dni_cuit text,
  telefono text,
  email text,
  direccion text,
  ubicacion_link text,
  drive_link text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_cliente_id integer;
  v_dni_norm text;
BEGIN
  v_dni_norm := NULLIF(regexp_replace(upper(trim(COALESCE(p_dni_cuit, ''))), '[^0-9A-Z]', '', 'g'), '');

  -- 1) Si hay CUIT/DNI, priorizar coincidencia exacta (municipalidades suelen tener CUIT único)
  IF v_dni_norm IS NOT NULL AND length(v_dni_norm) >= 8 THEN
    SELECT c.id INTO v_cliente_id
    FROM public.clientes c
    WHERE regexp_replace(upper(trim(COALESCE(c.dni_cuit, ''))), '[^0-9A-Z]', '', 'g') = v_dni_norm
    ORDER BY c.id
    LIMIT 1;
  END IF;

  -- 2) Nombre exacto (case-insensitive)
  IF v_cliente_id IS NULL AND NULLIF(trim(p_nombre), '') IS NOT NULL THEN
    SELECT c.id INTO v_cliente_id
    FROM public.clientes c
    WHERE lower(trim(c.nombre)) = lower(trim(p_nombre))
    ORDER BY c.id
    LIMIT 1;
  END IF;

  IF v_cliente_id IS NOT NULL THEN
    UPDATE public.clientes AS c
    SET
      dni_cuit = COALESCE(NULLIF(trim(p_dni_cuit), ''), c.dni_cuit),
      telefono = COALESCE(NULLIF(trim(p_telefono), ''), c.telefono),
      email = COALESCE(NULLIF(trim(p_email), ''), c.email),
      direccion = COALESCE(NULLIF(trim(p_direccion), ''), c.direccion),
      ubicacion_link = COALESCE(NULLIF(trim(p_ubicacion_link), ''), c.ubicacion_link),
      drive_link = COALESCE(NULLIF(trim(p_drive_link), ''), c.drive_link)
    WHERE c.id = v_cliente_id;

    RETURN QUERY
    SELECT
      c.id,
      c.nombre,
      c.dni_cuit,
      c.telefono,
      c.email,
      c.direccion,
      c.ubicacion_link,
      c.drive_link
    FROM public.clientes c
    WHERE c.id = v_cliente_id;
  ELSE
    INSERT INTO public.clientes (
      nombre,
      dni_cuit,
      telefono,
      email,
      direccion,
      ubicacion_link,
      drive_link
    )
    VALUES (
      trim(p_nombre),
      NULLIF(trim(p_dni_cuit), ''),
      NULLIF(trim(p_telefono), ''),
      NULLIF(trim(p_email), ''),
      NULLIF(trim(p_direccion), ''),
      NULLIF(trim(p_ubicacion_link), ''),
      NULLIF(trim(p_drive_link), '')
    )
    RETURNING public.clientes.id INTO v_cliente_id;

    RETURN QUERY
    SELECT
      c.id,
      c.nombre,
      c.dni_cuit,
      c.telefono,
      c.email,
      c.direccion,
      c.ubicacion_link,
      c.drive_link
    FROM public.clientes c
    WHERE c.id = v_cliente_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.buscar_o_crear_cliente(text, text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.buscar_o_crear_cliente(text, text, text, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.buscar_o_crear_cliente IS
  'Busca cliente por CUIT/DNI normalizado o nombre exacto; si existe actualiza contacto (sin ambigüedad id/col).';
