-- Al editar la ficha, el nombre y los datos de contacto se copian
-- a órdenes, ventas, facturas, presupuestos y el resto de registros del cliente.

CREATE OR REPLACE FUNCTION public.nombre_visible_cliente(p_nombre text, p_apellido text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_nombre IS NULL OR btrim(p_nombre) = '' THEN NULL
    WHEN p_apellido IS NULL OR btrim(p_apellido) = '' THEN btrim(p_nombre)
    WHEN right(lower(btrim(p_nombre)), char_length(btrim(p_apellido))) = lower(btrim(p_apellido))
      THEN btrim(p_nombre)
    ELSE btrim(p_nombre) || ' ' || btrim(p_apellido)
  END
$$;

CREATE OR REPLACE FUNCTION public.propagar_ficha_cliente(
  p_id integer,
  p_nombre_anterior text,
  p_visible_anterior text,
  p_empresa_anterior text,
  p_dni_anterior text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  c public.clientes%ROWTYPE;
  v_visible text;
  v_old_names text[];
  v_dni text;
BEGIN
  SELECT * INTO c FROM public.clientes WHERE id = p_id;
  IF c.id IS NULL THEN
    RETURN;
  END IF;

  v_visible := public.nombre_visible_cliente(c.nombre, c.apellido);
  IF v_visible IS NULL OR btrim(v_visible) = '' THEN
    RETURN;
  END IF;

  v_dni := NULLIF(regexp_replace(COALESCE(c.dni_cuit, ''), '\D', '', 'g'), '');

  SELECT COALESCE(array_agg(DISTINCT n), ARRAY[]::text[])
    INTO v_old_names
  FROM (
    SELECT lower(btrim(x)) AS n
    FROM unnest(ARRAY[p_nombre_anterior, p_visible_anterior, p_empresa_anterior]) AS x
    WHERE x IS NOT NULL AND btrim(x) <> ''
  ) s;

  UPDATE public.ventas
  SET
    cliente_nombre = left(v_visible, 255),
    cliente_empresa = c.empresa,
    cliente_telefono = c.telefono,
    cliente_email = c.email,
    cliente_dni_cuit = c.dni_cuit,
    cliente_direccion = c.direccion
  WHERE id_cliente = p_id;

  UPDATE public.presupuestos_ventas
  SET
    cliente_nombre = left(v_visible, 255),
    cliente_empresa = c.empresa,
    cliente_telefono = c.telefono,
    cliente_email = c.email,
    cliente_dni_cuit = c.dni_cuit,
    cliente_direccion = c.direccion
  WHERE id_cliente = p_id;

  UPDATE public.oportunidades_venta
  SET
    cliente_nombre = left(v_visible, 255),
    cliente_empresa = c.empresa,
    cliente_telefono = c.telefono,
    cliente_email = c.email,
    cliente_dni_cuit = c.dni_cuit,
    cliente_direccion = c.direccion
  WHERE id_cliente = p_id;

  UPDATE public.facturas_venta
  SET
    cliente_nombre = left(v_visible, 255),
    cliente_dni_cuit = c.dni_cuit,
    cliente_direccion = c.direccion,
    cliente_condicion_iva = c.condicion_iva
  WHERE id_cliente = p_id;

  UPDATE public.cuentas_por_cobrar
  SET cliente_nombre = left(v_visible, 255)
  WHERE id_cliente = p_id;

  UPDATE public.atenciones_mostrador
  SET cliente_nombre = left(v_visible, 255)
  WHERE cliente_id = p_id;

  UPDATE public.briefs_publicos
  SET
    cliente_nombre_completo = v_visible,
    cliente_empresa = c.empresa,
    email_cliente = c.email,
    telefono_cliente = c.telefono
  WHERE id_cliente = p_id;

  UPDATE public.clientes_cuenta_corriente
  SET
    nombre = c.nombre,
    apellido = c.apellido,
    email = COALESCE(c.email, email),
    whatsapp = COALESCE(c.telefono, whatsapp),
    domicilio = COALESCE(c.direccion, domicilio),
    condicion_iva = COALESCE(c.condicion_iva, condicion_iva),
    cuit = CASE
      WHEN cuit IS NULL OR btrim(cuit) = '' THEN c.dni_cuit
      WHEN p_dni_anterior IS NOT NULL
        AND regexp_replace(cuit, '\D', '', 'g') = regexp_replace(p_dni_anterior, '\D', '', 'g')
        THEN c.dni_cuit
      ELSE cuit
    END,
    razon_social = CASE
      WHEN razon_social IS NULL OR btrim(razon_social) = '' THEN COALESCE(c.empresa, v_visible)
      WHEN lower(btrim(razon_social)) = ANY (v_old_names) THEN COALESCE(c.empresa, v_visible)
      ELSE razon_social
    END,
    updated_at = now()
  WHERE id_cliente = p_id;

  IF cardinality(v_old_names) > 0 THEN
    UPDATE public.ordenes_trabajo
    SET
      cliente = left(v_visible, 255),
      cliente_nombre_completo = CASE
        WHEN cliente_nombre_completo IS NULL OR btrim(cliente_nombre_completo) = '' THEN cliente_nombre_completo
        ELSE v_visible
      END,
      cliente_empresa = CASE
        WHEN cliente_empresa IS NULL OR btrim(cliente_empresa) = '' THEN cliente_empresa
        WHEN lower(btrim(cliente_empresa)) = ANY (v_old_names) THEN c.empresa
        ELSE cliente_empresa
      END,
      telefono_cliente = COALESCE(c.telefono, telefono_cliente),
      email_cliente = COALESCE(c.email, email_cliente),
      direccion_cliente = COALESCE(c.direccion, direccion_cliente),
      dni_cuit = COALESCE(c.dni_cuit, dni_cuit)
    WHERE lower(btrim(COALESCE(cliente, ''))) = ANY (v_old_names)
       OR lower(btrim(COALESCE(cliente_nombre_completo, ''))) = ANY (v_old_names)
       OR id_pedido_cliente IN (
         SELECT pc.id FROM public.pedidos_clientes pc WHERE pc.id_cliente = p_id
       );

    UPDATE public.totem_impresion_solicitudes
    SET
      cliente_nombre = left(v_visible, 255),
      cliente_telefono = COALESCE(c.telefono, cliente_telefono),
      cliente_dni = COALESCE(c.dni_cuit, cliente_dni)
    WHERE lower(btrim(COALESCE(cliente_nombre, ''))) = ANY (v_old_names)
       OR (
         v_dni IS NOT NULL
         AND regexp_replace(COALESCE(cliente_dni, ''), '\D', '', 'g') = v_dni
       );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.propagar_ficha_cliente(integer, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nombre_visible_cliente(text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.actualizar_cliente_ficha(
  p_id integer,
  p_nombre text DEFAULT NULL,
  p_apellido text DEFAULT NULL,
  p_empresa text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_dni_cuit text DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_actor_id integer DEFAULT NULL,
  p_condicion_iva text DEFAULT NULL
)
RETURNS SETOF clientes_publico
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_iva text;
  v_old public.clientes%ROWTYPE;
  v_visible_anterior text;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;

  SELECT * INTO v_old FROM public.clientes c WHERE c.id = p_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  IF p_nombre IS NOT NULL AND trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre no puede quedar vacío';
  END IF;

  v_iva := public.normalizar_condicion_iva_cliente(p_condicion_iva);
  IF p_condicion_iva IS NOT NULL AND trim(p_condicion_iva) <> '' AND v_iva IS NULL THEN
    RAISE EXCEPTION 'Condición de IVA inválida';
  END IF;

  IF p_nombre IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE lower(c.nombre) = lower(trim(p_nombre)) AND c.id <> p_id
  ) THEN
    RAISE EXCEPTION 'Ya existe un cliente con ese nombre';
  END IF;

  v_visible_anterior := public.nombre_visible_cliente(v_old.nombre, v_old.apellido);

  UPDATE public.clientes
  SET
    nombre = COALESCE(NULLIF(trim(p_nombre), ''), nombre),
    apellido = CASE WHEN p_apellido IS NULL THEN apellido ELSE NULLIF(trim(p_apellido), '') END,
    empresa = CASE WHEN p_empresa IS NULL THEN empresa ELSE NULLIF(trim(p_empresa), '') END,
    telefono = CASE WHEN p_telefono IS NULL THEN telefono ELSE NULLIF(trim(p_telefono), '') END,
    email = CASE WHEN p_email IS NULL THEN email ELSE NULLIF(trim(p_email), '') END,
    dni_cuit = CASE WHEN p_dni_cuit IS NULL THEN dni_cuit ELSE NULLIF(trim(p_dni_cuit), '') END,
    direccion = CASE WHEN p_direccion IS NULL THEN direccion ELSE NULLIF(trim(p_direccion), '') END,
    condicion_iva = CASE WHEN p_condicion_iva IS NULL THEN condicion_iva ELSE v_iva END,
    updated_at = now()
  WHERE id = p_id;

  PERFORM public.propagar_ficha_cliente(
    p_id,
    v_old.nombre,
    v_visible_anterior,
    v_old.empresa,
    v_old.dni_cuit
  );

  RETURN QUERY SELECT * FROM public.clientes_publico WHERE id = p_id;
END;
$function$;
