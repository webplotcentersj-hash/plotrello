-- Condición de IVA en cada ficha de cliente (no solo cuenta corriente).

CREATE OR REPLACE FUNCTION public.normalizar_condicion_iva_cliente(p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IN ('responsable inscripto', 'iva responsable inscripto') THEN 'Responsable Inscripto'
    WHEN v IN ('monotributo', 'monotributista', 'responsable monotributo') THEN 'Monotributista'
    WHEN v IN ('exento', 'iva sujeto exento', 'iva exento') THEN 'Exento'
    WHEN v IN ('no responsable') THEN 'No Responsable'
    WHEN v IN ('consumidor final') THEN 'Consumidor Final'
    ELSE NULL
  END
  FROM (
    SELECT lower(trim(regexp_replace(COALESCE(p_valor, ''), '[_]+', ' ', 'g'))) AS v
  ) s;
$$;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS condicion_iva text;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_condicion_iva_check;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_condicion_iva_check
  CHECK (
    condicion_iva IS NULL
    OR condicion_iva IN (
      'Responsable Inscripto',
      'Monotributista',
      'Exento',
      'Consumidor Final',
      'No Responsable'
    )
  );

UPDATE public.clientes c
SET condicion_iva = public.normalizar_condicion_iva_cliente(cc.condicion_iva)
FROM public.clientes_cuenta_corriente cc
WHERE cc.id_cliente = c.id
  AND c.condicion_iva IS NULL
  AND public.normalizar_condicion_iva_cliente(cc.condicion_iva) IS NOT NULL;

CREATE OR REPLACE VIEW public.clientes_publico AS
 SELECT id,
    nombre,
    dni_cuit,
    telefono,
    email,
    direccion,
    ubicacion_link,
    drive_link,
    created_at,
    updated_at,
    usuario,
    apellido,
    empresa,
    activo,
    es_cliente_web,
    condicion_iva
   FROM clientes;

CREATE OR REPLACE FUNCTION public.actor_puede_gestionar_clientes(p_actor_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_actor_id
      AND COALESCE(u.activo, true) = true
      AND COALESCE(u.rol, '') <> 'operario-externo'
      AND trim(COALESCE(u.rol, '')) <> ''
  );
$$;

DROP FUNCTION IF EXISTS public.actualizar_cliente_ficha(integer, text, text, text, text, text, text, text, integer);

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

  RETURN QUERY SELECT * FROM public.clientes_publico WHERE id = p_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.crear_cliente_sin_acceso(character varying, character varying, character varying, character varying, character varying, character varying, text, integer);

CREATE OR REPLACE FUNCTION public.crear_cliente_sin_acceso(
  p_nombre character varying,
  p_apellido character varying DEFAULT NULL,
  p_empresa character varying DEFAULT NULL,
  p_telefono character varying DEFAULT NULL,
  p_email character varying DEFAULT NULL,
  p_dni_cuit character varying DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_actor_id integer DEFAULT NULL,
  p_condicion_iva text DEFAULT NULL
)
RETURNS TABLE(id integer, nombre character varying)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id integer;
  v_iva text;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;
  IF p_nombre IS NULL OR trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre es requerido';
  END IF;
  v_iva := public.normalizar_condicion_iva_cliente(p_condicion_iva);
  IF v_iva IS NULL THEN
    RAISE EXCEPTION 'La condición de IVA es obligatoria';
  END IF;
  IF p_email IS NOT NULL AND trim(p_email) != '' AND EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.email = trim(p_email)
  ) THEN
    RAISE EXCEPTION 'El email "%" ya está registrado', p_email;
  END IF;
  INSERT INTO public.clientes (
    nombre, apellido, empresa, telefono, email, dni_cuit, direccion, condicion_iva, es_cliente_web, activo
  ) VALUES (
    trim(p_nombre), NULLIF(trim(p_apellido), ''), NULLIF(trim(p_empresa), ''),
    NULLIF(trim(p_telefono), ''), NULLIF(trim(p_email), ''), NULLIF(trim(p_dni_cuit), ''),
    NULLIF(trim(p_direccion), ''), v_iva, false, true
  ) RETURNING clientes.id INTO v_id;
  RETURN QUERY SELECT c.id, c.nombre::varchar FROM public.clientes c WHERE c.id = v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.fusionar_clientes(integer, integer, integer, text, text, text, text, text, text, text);

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
  p_direccion text DEFAULT NULL,
  p_condicion_iva text DEFAULT NULL
)
RETURNS SETOF clientes_publico
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_p public.clientes%ROWTYPE;
  v_s public.clientes%ROWTYPE;
  v_cc_p boolean;
  v_cc_s boolean;
  v_nombre text; v_apellido text; v_empresa text; v_telefono text; v_email text; v_dni text; v_direccion text; v_iva text;
  v_tabla text; v_nombre_sec text; v_dni_sec text;
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
    'pedidos_clientes','presupuestos_clientes','presupuestos_ventas','ventas','oportunidades_venta',
    'facturas_venta','citas_asesor_tecnico','agenda_asesor_tecnico','briefs_publicos',
    'briefs_tokens_pendientes','carritos_clientes','mensajes_pedidos_clientes','notificaciones_clientes',
    'cuentas_por_cobrar','cc_cuenta_movimientos','cc_scoring_historial'
  ] LOOP
    PERFORM public._fusionar_try_update_id_cliente(v_tabla, p_id_secundario, p_id_principal);
  END LOOP;

  BEGIN
    UPDATE public.atenciones_mostrador SET cliente_id = p_id_principal WHERE cliente_id = p_id_secundario;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  IF v_cc_p AND v_cc_s THEN
    BEGIN
      DELETE FROM public.clientes_cuenta_corriente WHERE id_cliente = p_id_secundario;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Ambos tienen cuenta corriente y no se pudo consolidar la secundaria. Revisá CC con administración.';
    END;
  ELSIF (NOT v_cc_p) AND v_cc_s THEN
    UPDATE public.clientes_cuenta_corriente SET id_cliente = p_id_principal WHERE id_cliente = p_id_secundario;
  END IF;

  IF p_nombre IS NOT NULL OR p_apellido IS NOT NULL OR p_empresa IS NOT NULL
     OR p_telefono IS NOT NULL OR p_email IS NOT NULL OR p_dni_cuit IS NOT NULL
     OR p_direccion IS NOT NULL OR p_condicion_iva IS NOT NULL THEN
    v_nombre := COALESCE(NULLIF(trim(COALESCE(p_nombre, '')), ''), v_p.nombre);
    v_apellido := CASE WHEN p_apellido IS NULL THEN v_p.apellido ELSE NULLIF(trim(p_apellido), '') END;
    v_empresa := CASE WHEN p_empresa IS NULL THEN v_p.empresa ELSE NULLIF(trim(p_empresa), '') END;
    v_telefono := CASE WHEN p_telefono IS NULL THEN v_p.telefono ELSE NULLIF(trim(p_telefono), '') END;
    v_email := CASE WHEN p_email IS NULL THEN v_p.email ELSE NULLIF(trim(p_email), '') END;
    v_dni := CASE WHEN p_dni_cuit IS NULL THEN v_p.dni_cuit ELSE NULLIF(trim(p_dni_cuit), '') END;
    v_direccion := CASE WHEN p_direccion IS NULL THEN v_p.direccion ELSE NULLIF(trim(p_direccion), '') END;
    v_iva := COALESCE(
      public.normalizar_condicion_iva_cliente(p_condicion_iva),
      v_p.condicion_iva,
      v_s.condicion_iva
    );
  ELSE
    v_nombre := COALESCE(NULLIF(trim(COALESCE(v_p.nombre, '')), ''), v_s.nombre);
    v_apellido := COALESCE(NULLIF(trim(COALESCE(v_p.apellido, '')), ''), v_s.apellido);
    v_empresa := COALESCE(NULLIF(trim(COALESCE(v_p.empresa, '')), ''), v_s.empresa);
    v_telefono := COALESCE(NULLIF(trim(COALESCE(v_p.telefono, '')), ''), v_s.telefono);
    v_email := COALESCE(NULLIF(trim(COALESCE(v_p.email, '')), ''), v_s.email);
    v_direccion := COALESCE(NULLIF(trim(COALESCE(v_p.direccion, '')), ''), v_s.direccion);
    v_iva := COALESCE(v_p.condicion_iva, v_s.condicion_iva);
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
  IF v_iva IS NULL OR trim(v_iva) = '' THEN
    RAISE EXCEPTION 'La condición de IVA es obligatoria para unificar';
  END IF;

  UPDATE public.clientes
  SET nombre = left('__fusionado_' || p_id_secundario::text || '_' || extract(epoch from now())::bigint::text, 120),
      activo = false, updated_at = now()
  WHERE id = p_id_secundario;

  UPDATE public.clientes
  SET nombre = trim(v_nombre), apellido = v_apellido, empresa = v_empresa,
      telefono = v_telefono, email = v_email, dni_cuit = v_dni, direccion = v_direccion,
      condicion_iva = v_iva, activo = true, updated_at = now()
  WHERE id = p_id_principal;

  v_nombre_sec := trim(concat_ws(' ', v_s.nombre, v_s.apellido));
  v_dni_sec := regexp_replace(COALESCE(v_s.dni_cuit, ''), '\D', '', 'g');

  BEGIN
    IF length(v_nombre_sec) >= 3 THEN
      UPDATE public.ordenes_trabajo
      SET cliente = trim(v_nombre),
          telefono_cliente = COALESCE(v_telefono, telefono_cliente),
          email_cliente = COALESCE(v_email, email_cliente),
          dni_cuit = COALESCE(v_dni, dni_cuit)
      WHERE cliente ILIKE '%' || replace(v_nombre_sec, '%', '') || '%';
    END IF;
    IF length(v_dni_sec) >= 6 THEN
      UPDATE public.ordenes_trabajo
      SET cliente = trim(v_nombre),
          telefono_cliente = COALESCE(v_telefono, telefono_cliente),
          email_cliente = COALESCE(v_email, email_cliente),
          dni_cuit = COALESCE(v_dni, dni_cuit)
      WHERE dni_cuit ILIKE '%' || v_dni_sec || '%';
    END IF;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  RETURN QUERY SELECT * FROM public.clientes_publico WHERE id = p_id_principal;
END;
$function$;

DROP FUNCTION IF EXISTS public.buscar_o_crear_cliente(text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.buscar_o_crear_cliente(
  p_nombre text,
  p_dni_cuit text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_ubicacion_link text DEFAULT NULL,
  p_drive_link text DEFAULT NULL,
  p_condicion_iva text DEFAULT NULL
)
RETURNS TABLE(id integer, nombre text, dni_cuit text, telefono text, email text, direccion text, ubicacion_link text, drive_link text, condicion_iva text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_id integer;
  v_dni_norm text;
  v_iva text;
BEGIN
  v_dni_norm := NULLIF(regexp_replace(upper(trim(COALESCE(p_dni_cuit, ''))), '[^0-9A-Z]', '', 'g'), '');
  v_iva := public.normalizar_condicion_iva_cliente(p_condicion_iva);

  IF v_dni_norm IS NOT NULL AND length(v_dni_norm) >= 8 THEN
    SELECT c.id INTO v_cliente_id
    FROM public.clientes c
    WHERE regexp_replace(upper(trim(COALESCE(c.dni_cuit, ''))), '[^0-9A-Z]', '', 'g') = v_dni_norm
    ORDER BY c.id
    LIMIT 1;
  END IF;

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
      drive_link = COALESCE(NULLIF(trim(p_drive_link), ''), c.drive_link),
      condicion_iva = COALESCE(v_iva, c.condicion_iva)
    WHERE c.id = v_cliente_id;

    RETURN QUERY
    SELECT c.id, c.nombre, c.dni_cuit, c.telefono, c.email, c.direccion, c.ubicacion_link, c.drive_link, c.condicion_iva
    FROM public.clientes c
    WHERE c.id = v_cliente_id;
  ELSE
    IF v_iva IS NULL THEN
      RAISE EXCEPTION 'La condición de IVA es obligatoria';
    END IF;

    INSERT INTO public.clientes (nombre, dni_cuit, telefono, email, direccion, ubicacion_link, drive_link, condicion_iva)
    VALUES (
      trim(p_nombre),
      NULLIF(trim(p_dni_cuit), ''),
      NULLIF(trim(p_telefono), ''),
      NULLIF(trim(p_email), ''),
      NULLIF(trim(p_direccion), ''),
      NULLIF(trim(p_ubicacion_link), ''),
      NULLIF(trim(p_drive_link), ''),
      v_iva
    )
    RETURNING public.clientes.id INTO v_cliente_id;

    RETURN QUERY
    SELECT c.id, c.nombre, c.dni_cuit, c.telefono, c.email, c.direccion, c.ubicacion_link, c.drive_link, c.condicion_iva
    FROM public.clientes c
    WHERE c.id = v_cliente_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_clientes_condicion_iva_desde_cc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_iva text;
BEGIN
  v_iva := public.normalizar_condicion_iva_cliente(NEW.condicion_iva);
  IF NEW.id_cliente IS NOT NULL AND v_iva IS NOT NULL THEN
    UPDATE public.clientes
    SET condicion_iva = v_iva, updated_at = now()
    WHERE id = NEW.id_cliente
      AND condicion_iva IS DISTINCT FROM v_iva;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_clientes_condicion_iva_desde_cc ON public.clientes_cuenta_corriente;
CREATE TRIGGER trg_sync_clientes_condicion_iva_desde_cc
AFTER INSERT OR UPDATE OF condicion_iva, id_cliente
ON public.clientes_cuenta_corriente
FOR EACH ROW
EXECUTE FUNCTION public.sync_clientes_condicion_iva_desde_cc();

GRANT EXECUTE ON FUNCTION public.normalizar_condicion_iva_cliente(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.actualizar_cliente_ficha(integer, text, text, text, text, text, text, text, integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_cliente_sin_acceso(character varying, character varying, character varying, character varying, character varying, character varying, text, integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fusionar_clientes(integer, integer, integer, text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buscar_o_crear_cliente(text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;
