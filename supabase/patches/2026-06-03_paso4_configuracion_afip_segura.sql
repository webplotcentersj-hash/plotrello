-- PASO 4 seguridad: configuracion_afip sin certificados/tokens expuestos a anon
BEGIN;

-- Vista sin datos sensibles (certificado, clave, token AFIP)
CREATE OR REPLACE VIEW public.configuracion_afip_resumen AS
SELECT
  id,
  cuit,
  punto_venta,
  razon_social,
  domicilio_comercial,
  condicion_iva,
  ingresos_brutos,
  fecha_inicio_actividades,
  actividad_principal,
  webservice,
  ambiente,
  homologacion_aprobada,
  fecha_aprobacion_homologacion,
  numero_expediente_homologacion,
  url_wsaa_testing,
  url_wsaa_produccion,
  url_wsmtxca_testing,
  url_wsmtxca_produccion,
  ultimo_numero_factura_a,
  ultimo_numero_factura_b,
  ultimo_numero_factura_c,
  token_expira_en,
  activo,
  created_at,
  updated_at,
  (certificado_afip IS NOT NULL) AS tiene_certificado
FROM public.configuracion_afip;

GRANT SELECT ON public.configuracion_afip_resumen TO anon;
GRANT SELECT ON public.configuracion_afip_resumen TO authenticated;

-- Lectura para pantalla admin / ERP (sin secretos)
CREATE OR REPLACE FUNCTION public.get_configuracion_afip_resumen()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(r)
  FROM public.configuracion_afip_resumen r
  WHERE r.activo = true
  LIMIT 1;
$$;

-- Solo campos necesarios para numerar facturas (sin cert/token)
CREATE OR REPLACE FUNCTION public.get_configuracion_afip_facturacion()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'punto_venta', c.punto_venta,
    'ultimo_numero_factura_a', c.ultimo_numero_factura_a,
    'ultimo_numero_factura_b', c.ultimo_numero_factura_b,
    'ultimo_numero_factura_c', c.ultimo_numero_factura_c,
    'ambiente', c.ambiente
  )
  FROM public.configuracion_afip c
  WHERE c.activo = true
  LIMIT 1;
$$;

-- Guardar configuración (columnas de negocio; no toca certificado ni tokens AFIP)
CREATE OR REPLACE FUNCTION public.guardar_configuracion_afip(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_row public.configuracion_afip%ROWTYPE;
BEGIN
  SELECT id INTO v_id FROM public.configuracion_afip WHERE activo = true LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.configuracion_afip (
      cuit, punto_venta, razon_social, domicilio_comercial, condicion_iva,
      ingresos_brutos, fecha_inicio_actividades, actividad_principal,
      webservice, ambiente, homologacion_aprobada,
      fecha_aprobacion_homologacion, numero_expediente_homologacion,
      url_wsaa_testing, url_wsaa_produccion, url_wsmtxca_testing, url_wsmtxca_produccion,
      ultimo_numero_factura_a, ultimo_numero_factura_b, ultimo_numero_factura_c,
      activo
    ) VALUES (
      coalesce(p_payload->>'cuit', ''),
      coalesce((p_payload->>'punto_venta')::integer, 1),
      coalesce(p_payload->>'razon_social', ''),
      p_payload->>'domicilio_comercial',
      coalesce(p_payload->>'condicion_iva', 'Responsable Inscripto'),
      p_payload->>'ingresos_brutos',
      nullif(p_payload->>'fecha_inicio_actividades', '')::date,
      p_payload->>'actividad_principal',
      coalesce(p_payload->>'webservice', 'wsmtxca'),
      coalesce(p_payload->>'ambiente', 'Testing'),
      coalesce((p_payload->>'homologacion_aprobada')::boolean, false),
      nullif(p_payload->>'fecha_aprobacion_homologacion', '')::date,
      p_payload->>'numero_expediente_homologacion',
      p_payload->>'url_wsaa_testing',
      p_payload->>'url_wsaa_produccion',
      p_payload->>'url_wsmtxca_testing',
      p_payload->>'url_wsmtxca_produccion',
      coalesce((p_payload->>'ultimo_numero_factura_a')::integer, 0),
      coalesce((p_payload->>'ultimo_numero_factura_b')::integer, 0),
      coalesce((p_payload->>'ultimo_numero_factura_c')::integer, 0),
      coalesce((p_payload->>'activo')::boolean, true)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.configuracion_afip SET
      cuit = coalesce(nullif(p_payload->>'cuit', ''), cuit),
      punto_venta = coalesce((p_payload->>'punto_venta')::integer, punto_venta),
      razon_social = coalesce(nullif(p_payload->>'razon_social', ''), razon_social),
      domicilio_comercial = coalesce(p_payload->>'domicilio_comercial', domicilio_comercial),
      condicion_iva = coalesce(nullif(p_payload->>'condicion_iva', ''), condicion_iva),
      ingresos_brutos = coalesce(p_payload->>'ingresos_brutos', ingresos_brutos),
      fecha_inicio_actividades = coalesce(nullif(p_payload->>'fecha_inicio_actividades', '')::date, fecha_inicio_actividades),
      actividad_principal = coalesce(p_payload->>'actividad_principal', actividad_principal),
      webservice = coalesce(nullif(p_payload->>'webservice', ''), webservice),
      ambiente = coalesce(nullif(p_payload->>'ambiente', ''), ambiente),
      homologacion_aprobada = coalesce((p_payload->>'homologacion_aprobada')::boolean, homologacion_aprobada),
      fecha_aprobacion_homologacion = coalesce(nullif(p_payload->>'fecha_aprobacion_homologacion', '')::date, fecha_aprobacion_homologacion),
      numero_expediente_homologacion = coalesce(p_payload->>'numero_expediente_homologacion', numero_expediente_homologacion),
      url_wsaa_testing = coalesce(p_payload->>'url_wsaa_testing', url_wsaa_testing),
      url_wsaa_produccion = coalesce(p_payload->>'url_wsaa_produccion', url_wsaa_produccion),
      url_wsmtxca_testing = coalesce(p_payload->>'url_wsmtxca_testing', url_wsmtxca_testing),
      url_wsmtxca_produccion = coalesce(p_payload->>'url_wsmtxca_produccion', url_wsmtxca_produccion),
      ultimo_numero_factura_a = coalesce((p_payload->>'ultimo_numero_factura_a')::integer, ultimo_numero_factura_a),
      ultimo_numero_factura_b = coalesce((p_payload->>'ultimo_numero_factura_b')::integer, ultimo_numero_factura_b),
      ultimo_numero_factura_c = coalesce((p_payload->>'ultimo_numero_factura_c')::integer, ultimo_numero_factura_c),
      activo = coalesce((p_payload->>'activo')::boolean, activo),
      updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN public.get_configuracion_afip_resumen();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_configuracion_afip_resumen() TO anon;
GRANT EXECUTE ON FUNCTION public.get_configuracion_afip_resumen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracion_afip_facturacion() TO anon;
GRANT EXECUTE ON FUNCTION public.get_configuracion_afip_facturacion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_configuracion_afip(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.guardar_configuracion_afip(jsonb) TO authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.configuracion_afip FROM anon;

DROP POLICY IF EXISTS "erp_config_afip_all" ON public.configuracion_afip;
DROP POLICY IF EXISTS "AFIP solo admin" ON public.configuracion_afip;

COMMIT;
