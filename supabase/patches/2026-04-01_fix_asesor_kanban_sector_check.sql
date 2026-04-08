-- Kanban asesor: sectores Armados/Enviados, No Aprobados, Finalizado + columnas opcionales y RPC de contacto
BEGIN;

-- ============================================
-- 1) Columnas opcionales que el frontend ya usa
-- ============================================
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS reclamo_motivo text;

COMMENT ON COLUMN public.ordenes_trabajo.reclamo_motivo IS
  'Detalle opcional del reclamo; se limpia al quitar en_reclamo.';

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS related_id text;

COMMENT ON COLUMN public.user_notifications.related_id IS
  'Referencia libre (ej. id de artículo de stock) para deduplicar alertas.';

-- ============================================
-- 2) CHECK sector: incluir etapas del flujo asesor/presupuestos
-- ============================================
ALTER TABLE public.ordenes_trabajo
  DROP CONSTRAINT IF EXISTS ordenes_trabajo_sector_check;

ALTER TABLE public.ordenes_trabajo
  ADD CONSTRAINT ordenes_trabajo_sector_check CHECK (
    sector IS NULL OR sector IN (
      'Diseño Gráfico',
      'Diseño en Proceso',
      'En Espera',
      'Imprenta (Área de Impresión)',
      'Taller de Imprenta',
      'Taller Gráfico',
      'Instalaciones',
      'Metalúrgica',
      'Mostrador',
      'Caja',
      'Finalizado en Taller',
      'Almacén de Entrega',
      'Asesor Técnico',
      'Presupuestos',
      'Armados/Enviados',
      'No Aprobados',
      'Finalizado'
    )
  );

-- ============================================
-- 3) validar_sectores_kanban (arrays de configuración)
-- ============================================
CREATE OR REPLACE FUNCTION public.validar_sectores_kanban(
  p_sectores text[],
  p_sector_inicial text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sectores_validos text[] := ARRAY[
    'Diseño Gráfico',
    'Diseño en Proceso',
    'En Espera',
    'Imprenta (Área de Impresión)',
    'Taller de Imprenta',
    'Taller Gráfico',
    'Instalaciones',
    'Metalúrgica',
    'Finalizado en Taller',
    'Almacén de Entrega',
    'Asesor Técnico',
    'Presupuestos',
    'Armados/Enviados',
    'No Aprobados',
    'Finalizado'
  ];
  sector_item text;
BEGIN
  IF p_sector_inicial IS NOT NULL AND NOT (p_sector_inicial = ANY(sectores_validos)) THEN
    RETURN false;
  END IF;

  IF p_sectores IS NOT NULL THEN
    FOREACH sector_item IN ARRAY p_sectores
    LOOP
      IF NOT (sector_item = ANY(sectores_validos)) THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

-- ============================================
-- 4) RPC update_orden_with_contact (PostgREST / app)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_orden_with_contact(
  p_id integer,
  p_telefono_cliente text DEFAULT NULL,
  p_email_cliente text DEFAULT NULL,
  p_direccion_cliente text DEFAULT NULL,
  p_whatsapp_link text DEFAULT NULL,
  p_ubicacion_link text DEFAULT NULL,
  p_drive_link text DEFAULT NULL,
  p_foto_url text DEFAULT NULL,
  p_otros_campos jsonb DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  numero_op varchar,
  cliente varchar,
  telefono_cliente text,
  email_cliente text,
  direccion_cliente text,
  whatsapp_link text,
  ubicacion_link text,
  drive_link text,
  foto_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.ordenes_trabajo%ROWTYPE;
BEGIN
  UPDATE public.ordenes_trabajo
  SET
    telefono_cliente = COALESCE(p_telefono_cliente, telefono_cliente),
    email_cliente = COALESCE(p_email_cliente, email_cliente),
    direccion_cliente = COALESCE(p_direccion_cliente, direccion_cliente),
    whatsapp_link = COALESCE(p_whatsapp_link, whatsapp_link),
    ubicacion_link = COALESCE(p_ubicacion_link, ubicacion_link),
    drive_link = COALESCE(p_drive_link, drive_link),
    foto_url = COALESCE(p_foto_url, foto_url)
  WHERE id = p_id
  RETURNING * INTO updated_row;

  IF p_otros_campos IS NOT NULL THEN
    NULL;
  END IF;

  RETURN QUERY
  SELECT
    updated_row.id,
    updated_row.numero_op,
    updated_row.cliente,
    updated_row.telefono_cliente,
    updated_row.email_cliente,
    updated_row.direccion_cliente,
    updated_row.whatsapp_link,
    updated_row.ubicacion_link,
    updated_row.drive_link,
    updated_row.foto_url;
END;
$$;

-- Permisos RPC (ajustar si tu proyecto no usa anon)
GRANT EXECUTE ON FUNCTION public.update_orden_with_contact TO anon;
GRANT EXECUTE ON FUNCTION public.update_orden_with_contact TO authenticated;

COMMIT;
