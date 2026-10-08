-- El front llama cc_registrar_alta / cc_resolver_solicitud / etc. (Paso 26).
-- En producción existían las originales pero no los envoltorios con actor.

CREATE OR REPLACE FUNCTION public.actor_es_admin_cc(p_actor_id integer)
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

REVOKE ALL ON FUNCTION public.actor_es_admin_cc(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cc_estado_efectivo(p_id_cliente integer)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.estado IN ('aprobada', 'pendiente', 'rechazada') THEN c.estado
    WHEN COALESCE(c.alta_completa, false) THEN 'aprobada'
    ELSE 'pendiente'
  END
  FROM public.clientes_cuenta_corriente c
  WHERE c.id_cliente = p_id_cliente;
$$;

REVOKE ALL ON FUNCTION public.cc_estado_efectivo(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cc_registrar_alta(
  p_actor_id integer,
  p_cuit text,
  p_razon_social text,
  p_condicion_iva text,
  p_email text,
  p_whatsapp text,
  p_persona_contacto text,
  p_domicilio text,
  p_localidad text,
  p_provincia text,
  p_codigo_postal text,
  p_url_constancia_afip text,
  p_url_estatuto text,
  p_url_comprobante_domicilio text,
  p_id_cliente integer DEFAULT NULL,
  p_tipo_cliente text DEFAULT 'empresa',
  p_nombre text DEFAULT NULL,
  p_apellido text DEFAULT NULL,
  p_url_documento_dni text DEFAULT NULL,
  p_url_pagare text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para registrar cuenta corriente';
  END IF;

  IF p_id_cliente IS NOT NULL
     AND public.cc_estado_efectivo(p_id_cliente) = 'aprobada'
     AND NOT public.actor_es_admin_cc(p_actor_id) THEN
    RAISE EXCEPTION 'Solo administración puede modificar una cuenta corriente aprobada';
  END IF;

  RETURN public.registrar_alta_cuenta_corriente(
    p_cuit => p_cuit,
    p_razon_social => p_razon_social,
    p_condicion_iva => p_condicion_iva,
    p_email => p_email,
    p_whatsapp => p_whatsapp,
    p_persona_contacto => p_persona_contacto,
    p_domicilio => p_domicilio,
    p_localidad => p_localidad,
    p_provincia => p_provincia,
    p_codigo_postal => p_codigo_postal,
    p_url_constancia_afip => p_url_constancia_afip,
    p_url_estatuto => p_url_estatuto,
    p_url_comprobante_domicilio => p_url_comprobante_domicilio,
    p_id_cliente => p_id_cliente,
    p_id_usuario_solicita => p_actor_id,
    p_tipo_cliente => p_tipo_cliente,
    p_nombre => p_nombre,
    p_apellido => p_apellido,
    p_url_documento_dni => p_url_documento_dni,
    p_url_pagare => p_url_pagare
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cc_registrar_alta(integer, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text, text, text, text)
  TO anon, authenticated;
