-- Paso 10: ficha + fusión vía DEFINER con actor.
-- No ENABLE RLS. No REVOKE SELECT/UPDATE todavía (fallback en api.ts).

CREATE OR REPLACE FUNCTION public.actualizar_cliente_ficha(
  p_id integer,
  p_nombre text DEFAULT NULL,
  p_apellido text DEFAULT NULL,
  p_empresa text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_dni_cuit text DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_actor_id integer DEFAULT NULL
)
RETURNS SETOF public.clientes_publico
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = p_id) THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  IF p_nombre IS NOT NULL AND trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre no puede quedar vacío';
  END IF;

  IF p_nombre IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE lower(c.nombre) = lower(trim(p_nombre)) AND c.id <> p_id
  ) THEN
    RAISE EXCEPTION 'Ya existe un cliente con ese nombre';
  END IF;

  UPDATE public.clientes
  SET
    nombre = COALESCE(NULLIF(trim(p_nombre), ''), nombre),
    apellido = CASE WHEN p_apellido IS NULL THEN apellido ELSE NULLIF(trim(p_apellido), '') END,
    empresa = CASE WHEN p_empresa IS NULL THEN empresa ELSE NULLIF(trim(p_empresa), '') END,
    telefono = CASE WHEN p_telefono IS NULL THEN telefono ELSE NULLIF(trim(p_telefono), '') END,
    email = CASE WHEN p_email IS NULL THEN email ELSE NULLIF(trim(p_email), '') END,
    dni_cuit = CASE WHEN p_dni_cuit IS NULL THEN dni_cuit ELSE NULLIF(trim(p_dni_cuit), '') END,
    direccion = CASE WHEN p_direccion IS NULL THEN direccion ELSE NULLIF(trim(p_direccion), '') END,
    updated_at = now()
  WHERE id = p_id;

  RETURN QUERY SELECT * FROM public.clientes_publico WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_cliente_ficha(
  integer, text, text, text, text, text, text, text, integer
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public._fusionar_try_update_id_cliente(
  p_table text,
  p_from integer,
  p_to integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.%I SET id_cliente = $1 WHERE id_cliente = $2',
    p_table
  )
  USING p_to, p_from;
EXCEPTION
  WHEN undefined_table OR undefined_column OR unique_violation THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._fusionar_try_update_id_cliente(text, integer, integer)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fusionar_clientes(
  p_id_principal integer,
  p_id_secundario integer,
  p_actor_id integer DEFAULT NULL,
  p_nombre text DEFAULT NULL,
  p_apellido text DEFAULT NULL,
  p_empresa text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_dni_cuit text DEFAULT NULL,
  p_direccion text DEFAULT NULL
)
RETURNS SETOF public.clientes_publico
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.clientes%ROWTYPE;
  v_s public.clientes%ROWTYPE;
  v_cc_p boolean;
  v_cc_s boolean;
  v_nombre text;
  v_apellido text;
  v_empresa text;
  v_telefono text;
  v_email text;
  v_dni text;
  v_direccion text;
  v_tabla text;
  v_nombre_sec text;
  v_dni_sec text;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;

  IF p_id_principal IS NULL OR p_id_secundario IS NULL OR p_id_principal = p_id_secundario THEN
    RAISE EXCEPTION 'Elegí dos clientes distintos';
  END IF;

  SELECT * INTO v_p FROM public.clientes WHERE id = p_id_principal;
  SELECT * INTO v_s FROM public.clientes WHERE id = p_id_secundario;
  IF v_p.id IS NULL OR v_s.id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron ambos clientes';
  END IF;

  v_cc_p := EXISTS (SELECT 1 FROM public.clientes_cuenta_corriente WHERE id_cliente = p_id_principal);
  v_cc_s := EXISTS (SELECT 1 FROM public.clientes_cuenta_corriente WHERE id_cliente = p_id_secundario);

  FOREACH v_tabla IN ARRAY ARRAY[
    'pedidos_clientes',
    'presupuestos_clientes',
    'presupuestos_ventas',
    'ventas',
    'oportunidades_venta',
    'facturas_venta',
    'citas_asesor_tecnico',
    'agenda_asesor_tecnico',
    'briefs_publicos',
    'briefs_tokens_pendientes',
    'carritos_clientes',
    'mensajes_pedidos_clientes',
    'notificaciones_clientes',
    'cuentas_por_cobrar',
    'cc_cuenta_movimientos',
    'cc_scoring_historial'
  ]
  LOOP
    PERFORM public._fusionar_try_update_id_cliente(v_tabla, p_id_secundario, p_id_principal);
  END LOOP;

  BEGIN
    UPDATE public.atenciones_mostrador
    SET cliente_id = p_id_principal
    WHERE cliente_id = p_id_secundario;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      NULL;
  END;

  IF v_cc_p AND v_cc_s THEN
    DELETE FROM public.clientes_cuenta_corriente WHERE id_cliente = p_id_secundario;
  ELSIF (NOT v_cc_p) AND v_cc_s THEN
    UPDATE public.clientes_cuenta_corriente
    SET id_cliente = p_id_principal
    WHERE id_cliente = p_id_secundario;
  END IF;

  IF p_nombre IS NOT NULL OR p_apellido IS NOT NULL OR p_empresa IS NOT NULL
     OR p_telefono IS NOT NULL OR p_email IS NOT NULL OR p_dni_cuit IS NOT NULL
     OR p_direccion IS NOT NULL THEN
    v_nombre := COALESCE(NULLIF(trim(COALESCE(p_nombre, '')), ''), v_p.nombre);
    v_apellido := CASE WHEN p_apellido IS NULL THEN v_p.apellido ELSE NULLIF(trim(p_apellido), '') END;
    v_empresa := CASE WHEN p_empresa IS NULL THEN v_p.empresa ELSE NULLIF(trim(p_empresa), '') END;
    v_telefono := CASE WHEN p_telefono IS NULL THEN v_p.telefono ELSE NULLIF(trim(p_telefono), '') END;
    v_email := CASE WHEN p_email IS NULL THEN v_p.email ELSE NULLIF(trim(p_email), '') END;
    v_dni := CASE WHEN p_dni_cuit IS NULL THEN v_p.dni_cuit ELSE NULLIF(trim(p_dni_cuit), '') END;
    v_direccion := CASE WHEN p_direccion IS NULL THEN v_p.direccion ELSE NULLIF(trim(p_direccion), '') END;
  ELSE
    v_nombre := COALESCE(NULLIF(trim(COALESCE(v_p.nombre, '')), ''), v_s.nombre);
    v_apellido := COALESCE(NULLIF(trim(COALESCE(v_p.apellido, '')), ''), v_s.apellido);
    v_empresa := COALESCE(NULLIF(trim(COALESCE(v_p.empresa, '')), ''), v_s.empresa);
    v_telefono := COALESCE(NULLIF(trim(COALESCE(v_p.telefono, '')), ''), v_s.telefono);
    v_email := COALESCE(NULLIF(trim(COALESCE(v_p.email, '')), ''), v_s.email);
    v_direccion := COALESCE(NULLIF(trim(COALESCE(v_p.direccion, '')), ''), v_s.direccion);
    IF length(regexp_replace(COALESCE(v_s.dni_cuit, ''), '\D', '', 'g'))
         > length(regexp_replace(COALESCE(v_p.dni_cuit, ''), '\D', '', 'g')) THEN
      v_dni := v_s.dni_cuit;
    ELSE
      v_dni := COALESCE(NULLIF(trim(COALESCE(v_p.dni_cuit, '')), ''), v_s.dni_cuit);
    END IF;
  END IF;

  IF v_nombre IS NULL OR trim(v_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre resultante no puede quedar vacío';
  END IF;

  UPDATE public.clientes
  SET
    nombre = left('__fusionado_' || p_id_secundario::text || '_' || extract(epoch from now())::bigint::text, 120),
    activo = false,
    updated_at = now()
  WHERE id = p_id_secundario;

  UPDATE public.clientes
  SET
    nombre = trim(v_nombre),
    apellido = v_apellido,
    empresa = v_empresa,
    telefono = v_telefono,
    email = v_email,
    dni_cuit = v_dni,
    direccion = v_direccion,
    activo = true,
    updated_at = now()
  WHERE id = p_id_principal;

  v_nombre_sec := trim(concat_ws(' ', v_s.nombre, v_s.apellido));
  v_dni_sec := regexp_replace(COALESCE(v_s.dni_cuit, ''), '\D', '', 'g');

  BEGIN
    IF length(v_nombre_sec) >= 3 THEN
      UPDATE public.ordenes_trabajo
      SET
        cliente = trim(v_nombre),
        telefono_cliente = COALESCE(v_telefono, telefono_cliente),
        email_cliente = COALESCE(v_email, email_cliente),
        dni_cuit = COALESCE(v_dni, dni_cuit)
      WHERE cliente ILIKE '%' || replace(v_nombre_sec, '%', '') || '%';
    END IF;
    IF length(v_dni_sec) >= 6 THEN
      UPDATE public.ordenes_trabajo
      SET
        cliente = trim(v_nombre),
        telefono_cliente = COALESCE(v_telefono, telefono_cliente),
        email_cliente = COALESCE(v_email, email_cliente),
        dni_cuit = COALESCE(v_dni, dni_cuit)
      WHERE dni_cuit ILIKE '%' || v_dni_sec || '%';
    END IF;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      NULL;
  END;

  RETURN QUERY SELECT * FROM public.clientes_publico WHERE id = p_id_principal;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fusionar_clientes(
  integer, integer, integer, text, text, text, text, text, text, text
) TO anon, authenticated;

COMMENT ON FUNCTION public.actualizar_cliente_ficha IS
  'Edita ficha (sin password). Requiere actor mostrador/caja/presupuestos/admin/gerencia.';
COMMENT ON FUNCTION public.fusionar_clientes IS
  'Unifica dos fichas: historial → principal, secundaria inactiva. Requiere actor.';
