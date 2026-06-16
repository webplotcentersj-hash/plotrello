BEGIN;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  100,
  'Franco Yacante',
  'francoyacante@gmail.com',
  '2645269900',
  'Electricista',
  NULL,
  'Buenas tardes
Poseo basta experiencia en electricidad, iluminación led y fibra óptica, etc
Atte
Franco Yacante 
2645269900',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_100_cv_68c86a47a00b74.35315119.pdf',
  'cv_68c86a47a00b74.35315119.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68c86a47a00b74.35315119.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T19:34:31+00:00'::timestamptz,
  '2025-09-15T19:34:31+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  101,
  'Carrizo gabriel',
  'gabrielcarrizoo8@gmail.com',
  '2645770332',
  'Operario en fabrica de polietileno,chofer de autoelevadoresy chofer guia',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_101_cv_68c86e381912a5.09617749.pdf',
  'cv_68c86e381912a5.09617749.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c86e381912a5.09617749.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T19:51:20+00:00'::timestamptz,
  '2025-09-15T19:51:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  102,
  'Melisa Agustina Flores',
  'melisaaflores13@gmail.com',
  '2645315967',
  'Atención al Cliente',
  NULL,
  'me interesaría trabajar con ustedes ,ayudando ,haciendo crecer la empresa',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_102_cv_68c8703b32ffb4.99648207.pdf',
  'cv_68c8703b32ffb4.99648207.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8703b32ffb4.99648207.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T19:59:55+00:00'::timestamptz,
  '2025-09-15T19:59:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  103,
  'Helena Martinez',
  'helenammartinezz@gmail.com',
  '02644162309',
  'Atención al Cliente',
  NULL,
  'Estimados:
Espero que se encuentren muy bien. Me complace expresar mi interés en unirme a Plotcenter y solicitar el puesto de atención al publico.
Considero que tengo las habilidades y los conocimientos necesarios para poder formar parte de su equipo de trabajo. 

Agradezco su tiempo y atención y estoy ansiosa por la posibilidad de ser considerada para este puesto. Por favor, no duden en ponerse en contacto conmigo para cualquier información o duda.

Atentamente, 

Helena.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_103_cv_68c871df64ae74.81975415.pdf',
  'cv_68c871df64ae74.81975415.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c871df64ae74.81975415.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T20:06:55+00:00'::timestamptz,
  '2025-09-15T20:06:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  104,
  'Nahuel Jesús Zepeda',
  'nahuelzepeda900@gmail.com',
  '2644478988',
  'Instalador/a de Cartelería',
  NULL,
  'Soy muy responsable, organizando, con capacidad de resolver problemas y aportar ideas. Me gusta colaborar y tengo buena predisposición para aprender siempre cosas nuevas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_104_cv_68c88dab84dc38.39897851.pdf',
  'cv_68c88dab84dc38.39897851.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_68c88dab84dc38.39897851.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T22:05:31+00:00'::timestamptz,
  '2025-09-15T22:05:31+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  105,
  'Marcela Ivana Muñoz',
  'munozmarcela707@gmail.com',
  '2645445757',
  'Atención al Cliente',
  NULL,
  'Me considero una persona responsable, atenta y con muy buena predisposición para ayudar a los demás. Disfruto del trato con el público, soy paciente, organizada y me adapto con facilidad a diferentes situaciones para brindar siempre la mejor atención. Tengo experiencia en atención al cliente, tanto presencial como por medios digitales. Me destaco por mi trato cordial, la escucha y la capacidad de resolver consultas de manera eficiente. Mi objetivo es ofrecer un servicio de calidad y generar una experiencia positiva en cada cliente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_105_cv_68c88e80bcdaf3.69764806.pdf',
  'cv_68c88e80bcdaf3.69764806.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c88e80bcdaf3.69764806.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T22:09:04+00:00'::timestamptz,
  '2025-09-15T22:09:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  106,
  'Daniel Lopez',
  'lopezdanielartes@gmail.com',
  '+541158567332',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_106_cv_68c8a265ca4455.68161657.pdf',
  'cv_68c8a265ca4455.68161657.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8a265ca4455.68161657.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T23:33:57+00:00'::timestamptz,
  '2025-09-15T23:33:57+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  107,
  'sebastian domingo',
  'sebastiansj2017@gmail.com',
  '2646258893',
  'Coordinador/a de Proyectos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_107_cv_68c8cee30be468.04283662.pdf',
  'cv_68c8cee30be468.04283662.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8cee30be468.04283662.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T02:43:47+00:00'::timestamptz,
  '2025-09-16T02:43:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  108,
  'Mariano Daniel Neyem',
  'marianoneyem32@gmail.com',
  '2644360819',
  'Atención al Cliente',
  NULL,
  'Soy responsable y con muchas ganas de trabajar',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_108_cv_68c8d9705b3667.48672794.pdf',
  'cv_68c8d9705b3667.48672794.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8d9705b3667.48672794.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T03:28:48+00:00'::timestamptz,
  '2025-09-16T03:28:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  109,
  'Francisco Daniel Flores Pizarro',
  'floresfran146@gmail.com',
  '02644439847',
  'Atención al Cliente',
  NULL,
  'Soy un chico muy responsable y puntual con todas las tareas que se me sean asignadas y los hago en tiempo y forma designada , aprendí muy rápido y busco un trabajo para poder aprender cosas nuevas y poder sustentarme con los gastos de mis estudios, espero que me puedan brindar empleo, desde ya muchísimas gracias, un saludo!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_109_cv_68c8e2010515d8.67799742.pdf',
  'cv_68c8e2010515d8.67799742.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8e2010515d8.67799742.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T04:05:21+00:00'::timestamptz,
  '2025-09-16T04:05:21+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  111,
  'Francisco Daniel Flores Pizarro',
  'floresfancisco7@gmail.com',
  '02644439847',
  'Cajero/a',
  NULL,
  'Soy una persona muy responsable y puntual, hago las tareas que se me son asignadas en tiempo y forma , me gusta aprender nuevas cosas , y necesito un trabajo para poder cubrir gastos de mis estudios, actualmente estudio ingeniería alimentaria. Desde ya muchísimas gracias, un saludo!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_111_cv_68c8e31f393832.81317786.pdf',
  'cv_68c8e31f393832.81317786.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8e31f393832.81317786.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T04:10:07+00:00'::timestamptz,
  '2025-09-16T04:10:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  112,
  'David Emanuel Vera',
  'davemvera@gmail.com',
  '2644672346',
  'Project Manager',
  NULL,
  'Puedo especificarme en varios puestos por mi capacidad tanto de ventas al publico, como gestion de proyectos, entre otro.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_112_cv_68c8e6ea007d18.03408099.pdf',
  'cv_68c8e6ea007d18.03408099.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8e6ea007d18.03408099.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T04:26:18+00:00'::timestamptz,
  '2025-09-16T04:26:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  113,
  'David Emanuel Vera',
  'davidvera.dev@gmail.com',
  '2644672346',
  'Vendedor/a',
  NULL,
  'Soy una persona muy proactiva, que puede manejarse en diferentes puestos por mi capacidades y experiencia en el ambito publico frente a personas, clientes, etc.
Cuento con conocimientos y estudios en marketing y la experienca laboral tanto en lo fisico como online.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_113_cv_68c8e756aa9f44.79018860.pdf',
  'cv_68c8e756aa9f44.79018860.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8e756aa9f44.79018860.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T04:28:06+00:00'::timestamptz,
  '2025-09-16T04:28:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  114,
  'Agustín Fernandez',
  'navarroagustinn144@gmail.com',
  '3515057649',
  'Atención al Cliente',
  NULL,
  'Me llamo Agustín, quisiera poder trabajar con ustedes porque me gustaría poder ayudar a mi familia y a la vez poder estudiar en una facultad, me gusta mucho trabajar en equipo, tener buenas relaciones con compañeros, me gusta poder ayudar, poder atender a la gente y brindarles la solución a sus problemas, tengo 20 años, no tengo una experiencia laboral demasiado amplia, pero si muchas ganas de poder aprender y especializarme, espero que mi perfil les interese y pueda ser parte de su empresa, muchas gracias por su atención.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_114_cv_68c941e4db76b9.47112878.pdf',
  'cv_68c941e4db76b9.47112878.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c941e4db76b9.47112878.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T10:54:28+00:00'::timestamptz,
  '2025-09-16T10:54:28+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  115,
  'Elias Rojas',
  'eliirojas57@gmail.com',
  '02645185162',
  'Administrativo/a de Personal',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_115_cv_68c96e00bf1ca0.06247634.pdf',
  'cv_68c96e00bf1ca0.06247634.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c96e00bf1ca0.06247634.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T14:02:40+00:00'::timestamptz,
  '2025-09-16T14:02:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  116,
  'Mayra Ailen Marcuzzi Garcia',
  'ailengarcia843@gmail.com',
  '02646629523',
  'Community Manager',
  NULL,
  'Soy técnica en Marketing, me recibí hace poco y estoy buscando mi primera experiencia laboral.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_116_cv_68c98e68652236.64689535.pdf',
  'cv_68c98e68652236.64689535.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c98e68652236.64689535.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T16:20:56+00:00'::timestamptz,
  '2025-09-16T16:20:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  118,
  'Mayra Ailen Marcuzzi Garcia',
  'mayramar2002@gmail.com',
  '02646629523',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_118_cv_68c98ebc6da519.90219258.pdf',
  'cv_68c98ebc6da519.90219258.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c98ebc6da519.90219258.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T16:22:20+00:00'::timestamptz,
  '2025-09-16T16:22:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  120,
  'Gonzalo Enrique Gárate Peralta',
  'garategonzalo298@gmail.com',
  '2644551603',
  'Cajero/a',
  NULL,
  'Tengo 27 años, soy estudiante de derecho, tengo conocimiento en diseño y experiencia en atención al público en el área comercio, como vendedor y facturador.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_120_cv_68c99fa8e19237.29129968.pdf',
  'cv_68c99fa8e19237.29129968.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c99fa8e19237.29129968.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T17:34:32+00:00'::timestamptz,
  '2025-09-16T17:34:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  121,
  'Carla Campillay',
  'carlacampillay77@gmail.com',
  '2645119173',
  'Cajero/a',
  NULL,
  'Buenas! Soy Carla Campillay y estoy dispuesta a formar parte de su equipo, tengo mucha experiencia en atención al publico, como vendedora y como cajera. 
Actualmente no estoy trabajando, espero poder quedar. 
Gracias!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_121_cv_68c9a0f1470031.15004092.pdf',
  'cv_68c9a0f1470031.15004092.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c9a0f1470031.15004092.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T17:40:01+00:00'::timestamptz,
  '2025-09-16T17:40:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  122,
  'Mayra Fredes',
  'fredemayra@gmail.com',
  '2645057710',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_122_cv_68c9bee30b6ca5.25001489.pdf',
  'cv_68c9bee30b6ca5.25001489.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c9bee30b6ca5.25001489.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T19:47:47+00:00'::timestamptz,
  '2025-09-16T19:47:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
COMMIT;