-- Kanban asesor: columna Visitas a coordinar (antes de Asesor Técnico)
BEGIN;

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
      'Visitas a coordinar',
      'Asesor Técnico',
      'Presupuestos',
      'Armados/Enviados',
      'No Aprobados',
      'Finalizado'
    )
  );

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
    'Visitas a coordinar',
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

INSERT INTO public.sectores (nombre, color, activo, orden_visualizacion)
SELECT 'Visitas a coordinar', '#14b8a6', true, 12
WHERE NOT EXISTS (
  SELECT 1 FROM public.sectores WHERE nombre = 'Visitas a coordinar'
);

COMMIT;
