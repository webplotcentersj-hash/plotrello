-- Datos bancarios del proveedor (CBU, alias, cuenta, banco, etc.).
ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS sucursal text,
  ADD COLUMN IF NOT EXISTS tipo_cuenta text,
  ADD COLUMN IF NOT EXISTS numero_cuenta text,
  ADD COLUMN IF NOT EXISTS cbu text,
  ADD COLUMN IF NOT EXISTS alias_cbu text,
  ADD COLUMN IF NOT EXISTS titular_cuenta text,
  ADD COLUMN IF NOT EXISTS cuit_titular text;

COMMENT ON COLUMN public.proveedores.banco IS 'Banco del CBU/cuenta del proveedor';
COMMENT ON COLUMN public.proveedores.cbu IS 'CBU o CVU (22 dígitos típico)';
COMMENT ON COLUMN public.proveedores.alias_cbu IS 'Alias CBU/CVU';
COMMENT ON COLUMN public.proveedores.numero_cuenta IS 'Número de cuenta';
COMMENT ON COLUMN public.proveedores.tipo_cuenta IS 'Caja de ahorro / Cuenta corriente / etc.';
COMMENT ON COLUMN public.proveedores.titular_cuenta IS 'Titular de la cuenta (si difiere del proveedor)';
COMMENT ON COLUMN public.proveedores.cuit_titular IS 'CUIT del titular de la cuenta';
COMMENT ON COLUMN public.proveedores.sucursal IS 'Sucursal bancaria';

NOTIFY pgrst, 'reload schema';
