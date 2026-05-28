-- Cliente web usa auth propia (localStorage), no supabase.auth → subidas con rol anon.
-- Sin esta política, el mockup y archivos del pedido fallan al guardarse en Storage.

DROP POLICY IF EXISTS "Pedidos clientes upload publico" ON storage.objects;

CREATE POLICY "Pedidos clientes upload publico"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'pedidos-clientes');
