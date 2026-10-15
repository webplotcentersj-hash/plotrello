-- Permitir "Pago mixto" en ventas (efectivo + MP, efectivo + tarjeta, etc.).

ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check;
ALTER TABLE public.ventas
  ADD CONSTRAINT ventas_metodo_pago_check CHECK (
    metodo_pago IS NULL
    OR metodo_pago IN (
      'Efectivo',
      'Transferencia',
      'Tarjeta',
      'Cheque',
      'Cuenta Corriente',
      'Mercado Pago',
      'Pago mixto',
      'Otro'
    )
  );
