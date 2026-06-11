-- Orígenes de importación: comprobante MP/POS y ventas PlotLab en vivo
ALTER TABLE public.control_caja_movimientos
  DROP CONSTRAINT IF EXISTS control_caja_movimientos_origen_importacion_check;

ALTER TABLE public.control_caja_movimientos
  ADD CONSTRAINT control_caja_movimientos_origen_importacion_check
  CHECK (
    origen_importacion IN (
      'manual',
      'excel',
      'planilla_pdf',
      'comprobante',
      'plotlab_venta'
    )
  );
