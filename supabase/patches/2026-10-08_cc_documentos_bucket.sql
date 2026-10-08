-- Bucket privado para DNI / estatuto / constancia AFIP / domicilio / pagaré del alta de CC.
-- El front sube con INSERT (sin upsert). La lectura es por URL firmada (/api/erp/cc-documento-url).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cc-documentos', 'cc-documentos', false, 8388608)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS cc_documentos_insert ON storage.objects;
CREATE POLICY cc_documentos_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'cc-documentos');
