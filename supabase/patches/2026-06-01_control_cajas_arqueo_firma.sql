-- Firma digital en arqueos de caja
ALTER TABLE public.control_caja_arqueos
  ADD COLUMN IF NOT EXISTS firma_data_url text;
