BEGIN;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  27,
  'Angela Denice Neira Carrizo',
  'angeladeniceneira@gmail.com',
  '02646301594',
  'Técnica en Higiene y Seguridad Laboral',
  NULL,
  'Soy una persona comprometida con la prevención de riesgos laborales y la promoción de la salud ocupacional. Aportando experiencia y conocimientos para lograr nuevas mejoras continuas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_27_cv_68b9c1328eee77.03225994.pdf',
  'cv_68b9c1328eee77.03225994.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68b9c1328eee77.03225994.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T16:41:22+00:00'::timestamptz,
  '2025-09-04T16:41:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  28,
  'Morales Mirella',
  'mirellamorales22@gmail.com',
  '2645190177',
  'Administración general',
  NULL,
  'Profesional en Administración de Empresas, apasionada por la innovación y la mejora continua. Combino habilidades administrativas y técnicas con una actitud proactiva y orientada al crecimiento, siempre buscando optimizar procesos y generar experiencias positivas en clientes y equipos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_28_cv_68b9d91807ed92.04702608.docx',
  'cv_68b9d91807ed92.04702608.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b9d91807ed92.04702608.docx","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T18:23:20+00:00'::timestamptz,
  '2025-09-04T18:23:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  29,
  'Leonel Sierra',
  'hleonel.sierra@gmail.com',
  '2645130343',
  'administrativo, venta',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_29_cv_68b9ec6cda19f5.59984373.pdf',
  'cv_68b9ec6cda19f5.59984373.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b9ec6cda19f5.59984373.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T19:45:48+00:00'::timestamptz,
  '2025-09-04T19:45:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  30,
  'Facundo Carrizo',
  'facundoivan1996@gmail.com',
  '(11) 7226-9436',
  'Varios',
  NULL,
  'Técnico Electromecánico, me gustaría formar parte de la empresa',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_30_cv_68b9ef3823e939.11301272.pdf',
  'cv_68b9ef3823e939.11301272.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b9ef3823e939.11301272.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T19:57:44+00:00'::timestamptz,
  '2025-09-04T19:57:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  31,
  'Jeremias Cabalin',
  'jeremiasfernandez07cc@gmail.com',
  '02645648600',
  'Cualquier vacante a la cual mi perfil se adapte',
  NULL,
  'Cuento con experiencia en manejo de personal, análisis de laboratorio, calidad alimentaria, normas ISO, Bpm, etc',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_31_cv_68ba067a9a4434.61634356.pdf',
  'cv_68ba067a9a4434.61634356.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba067a9a4434.61634356.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T21:36:58+00:00'::timestamptz,
  '2025-09-04T21:36:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  32,
  'Rosario Castañeda Donoso',
  'rosicas00@gmail.com',
  '2646728153',
  'Administrativo',
  NULL,
  'Me gustaría dejar mi CV en caso de que se abra alguna vacante administrativa, en este momento de la postulación tengo disponibilidad inmediata. 

Saludos y gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_32_cv_68ba0d315c44d5.63107876.pdf',
  'cv_68ba0d315c44d5.63107876.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba0d315c44d5.63107876.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T22:05:37+00:00'::timestamptz,
  '2025-09-04T22:05:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  33,
  'Ezequiel Eduardo Llanos',
  'llanosezequiel03@gmail.com',
  '02644621010',
  'ADMINISTRATIVO CONTABLE',
  NULL,
  'Hola, Soy Contador Publico con más de 9 años de experiencia en ambito privado.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_33_cv_68ba190c649bd5.46360521.pdf',
  'cv_68ba190c649bd5.46360521.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba190c649bd5.46360521.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T22:56:12+00:00'::timestamptz,
  '2025-09-04T22:56:12+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  34,
  'Verónica Noemi Grimal Terrera',
  'grimal_vero78@hotmail.com',
  '2645068574',
  'Administrariva',
  NULL,
  'Buenas noches mi nombre es Verónica, tengo  experiencia en Administración y Atención al cliente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_34_cv_68ba3e70ae5ac1.35130138.pdf',
  'cv_68ba3e70ae5ac1.35130138.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba3e70ae5ac1.35130138.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T01:35:44+00:00'::timestamptz,
  '2025-09-05T01:35:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  35,
  'Julián Celador',
  'juliancelador25@gmail.com',
  '02645137789',
  'Administrativo, Atención Al Cliente, Operario de Almacén',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_35_cv_68ba7c33c91eb1.36583213.pdf',
  'cv_68ba7c33c91eb1.36583213.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba7c33c91eb1.36583213.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T05:59:15+00:00'::timestamptz,
  '2025-09-05T05:59:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  36,
  'Brisa Oriana Davila',
  'brichudavila29@gmail.com',
  '02645733992',
  'Vendedora',
  NULL,
  'Buenos dias mi nombre es Brisa Dávila me comunico con ustedes por este medio para enviarles mi currículum vitae, cabe mencionar que poseo las siguientes aptitudes: Responsable, Puntual, Proactivo , Trabajo en equipo, aprender rápido
Sin más que decir les saludo antentamente.
Pd:espero sea de su agrado.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_36_cv_68babbb1e3f6a6.39736665.pdf',
  'cv_68babbb1e3f6a6.39736665.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68babbb1e3f6a6.39736665.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T10:30:09+00:00'::timestamptz,
  '2025-09-05T10:30:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  37,
  'Elian Adolfo Baigorria',
  'baigorriaelian29@gmail.com',
  '02644470779',
  'Vendedor',
  NULL,
  'Buenos dias mi nombre es Elian Baigorria me comunico con ustedes con el objetivo de hacerle llegar mi currículum vitae, para asi formar parte de su equipo. 
A continuación adjunto mi curriculum y mi Certificado Asistencia Primeros Auxilios. Reanimación Cardiopulmonar (RCP), cabe mencionar que cuento con certificado de Manipulación de Alimentos vigente.
Sin más que decirles les saludo atentamente.
PD: espero su pronta respuesta.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_37_cv_68babbd777e323.06397473.pdf',
  'cv_68babbd777e323.06397473.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68babbd777e323.06397473.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T10:30:47+00:00'::timestamptz,
  '2025-09-05T10:30:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  38,
  'Edgardo olmos',
  'edgardoolmos09@gmail.com',
  '2646304282',
  'Administración',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_38_cv_68bad0449d5896.88471672.pdf',
  'cv_68bad0449d5896.88471672.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bad0449d5896.88471672.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T11:57:56+00:00'::timestamptz,
  '2025-09-05T11:57:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  39,
  'Juan Manuel Cataldo Tapia',
  'juanmacataldo1411@gmail.com',
  '02644805327',
  'Técnico en Higiene y Seguridad.',
  NULL,
  'Hola, Mi nombre es Juan Manuel, me interesa formar parte del equipo de PlotCenter. Soy Técnico en Higiene y Seguridad, con experiencia en prevención de riesgos y mejoras en ambientes de trabajo.
Me considero una persona responsable, proactiva y con muchas ganas de aprender y aportar.
Adjunto mi CV para su consideración y quedo a disposición para una entrevista.

Muchas gracias por su tiempo y atención.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_39_cv_68bae6c2b27d39.48847278.pdf',
  'cv_68bae6c2b27d39.48847278.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bae6c2b27d39.48847278.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T13:33:54+00:00'::timestamptz,
  '2025-09-05T13:33:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  40,
  'Betty Cecilia Ruiz Nehme',
  'bruiznehme31@gmail.com',
  '2645021068',
  'Administración',
  NULL,
  'Profesional con mas de 10 años de experiencia en el rubro administrativo, contable, rrhh, atención al cliente, proveedores, etc....y en búsqueda de jueves oportunidades laborales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_40_cv_68bb05c5333fe5.00154201.pdf',
  'cv_68bb05c5333fe5.00154201.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bb05c5333fe5.00154201.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T15:46:13+00:00'::timestamptz,
  '2025-09-05T15:46:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  41,
  'Florencia Medina Quiñonero',
  'flormedinaq75@gmail.com',
  '2644123733',
  'Administrativo',
  NULL,
  'Tengo experiencia en gestión administrativa, contable y de recursos humanos, incluyendo manejo de Excel, Word, planillas de control y sistemas administrativos. Me considero organizada, proactiva y con capacidad para adaptarme a entornos dinámicos.
Me interesa sumarme a Plot Center porque valoro la posibilidad de aportar mis conocimientos a una empresa en crecimiento y seguir desarrollándome profesionalmente en el área administrativa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_41_cv_68bb0b43ad97a2.87559312.pdf',
  'cv_68bb0b43ad97a2.87559312.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bb0b43ad97a2.87559312.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T16:09:39+00:00'::timestamptz,
  '2025-09-05T16:09:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  42,
  'Hector Ventrice',
  'hector_ventrice@yahoo.com.ar',
  '2645055821',
  'Administrativo, comprador',
  NULL,
  'Con más de 20 años de experiencia en la industria Minera e Industrial, he desarrollado una sólida trayectoria en diversas áreas, incluyendo administración generalista, control de calidad, logística y gestión de inventario. Mi expertise en sistemas como SAP, Tango, Tac Tica, SIS , AS400 y Normas ISO 9001/45001, sumado a mi capacidad para trabajar de manera eficiente en entornos dinámicos, me permiten aportar un valor significativo a su equipo.
 Durante mi tiempo en mi ultimado trabajo, implementé un sistema de control de calidad que redujo el porcentaje de devoluciones en un 15%, optimizando así los procesos y generando un ahorro de costos. Asimismo, lideré un equipo de 4 personas en la gestión del almacén central, logrando una mejora del 60% en la eficiencia de las operaciones.

 Estoy altamente motivado a aplicar mis conocimientos y habilidades en un nuevo desafío. Mi objetivo es contribuir al crecimiento y éxito de su empresa, aportando mi experiencia y capacidad de adaptación.

 Adjunto mi currículum vitae para su consideración, donde podrá encontrar una descripción más detallada de mis logros y competencias.

 Quedo a su disposición para coordinar una entrevista y ampliar cualquier información que considere relevante.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_42_cv_68bb0b86b60605.70594939.pdf',
  'cv_68bb0b86b60605.70594939.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bb0b86b60605.70594939.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T16:10:46+00:00'::timestamptz,
  '2025-09-05T16:10:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  43,
  'Sofía Daniela Escudero Fernández',
  'sofidanielaescudero@gmail.com',
  '2646617320',
  'Sector de impresión o Diseñador Gráfico',
  NULL,
  'Hola Plotcenter
Mi nombre es Sofía Escudero, tengo 20 años y actualmente curso el tercer año de la carrera de Diseño Gráfico. Me entusiasma mucho la posibilidad de formar parte de un equipo como el de Plotcenter, ya que admiro el trabajo que realizan en el área de impresión y diseño, y me interesa aprender desde adentro cómo se desarrolla el proceso en una empresa de gran escala.
Me considero una persona creativa, responsable y con muchas ganas de seguir creciendo en el ámbito profesional. Además de mi formación académica, me motiva aplicar lo que voy aprendiendo en la práctica y aportar mi mirada fresca y comprometida en cada proyecto.
Me encantaría tener la oportunidad de conversar con ustedes, contarles un poco más sobre mi perfil y también conocer mejor sus necesidades. Quedo a disposición para entrevistas o charlas sobre el puesto.
Muchas gracias por su tiempo y consideración.
Saludos cordiales,
Sofía Escudero.
2646617320
sofidanielaescudero@gmail.com',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_43_cv_68bb183f406791.72968299.pdf',
  'cv_68bb183f406791.72968299.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bb183f406791.72968299.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T17:05:03+00:00'::timestamptz,
  '2025-09-05T17:05:03+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  44,
  'Gisela Diamantino',
  'sjdiamantinoarg@gmail.com',
  '02645420653',
  'Asistente Administrativa',
  NULL,
  'Me encanta la idea de sumarme como Asistente Administrativa en Plot Center porque me identifico con los espacios que combinan diseño, tecnología y atención al detalle. Me motiva aplicar herramientas digitales para hacer que el día a día sea más ágil, ordenado y eficiente. Además, soy fan de la mejora continua: siempre estoy buscando cómo optimizar procesos, facilitar tareas y aportar ideas que sumen al equipo. Tengo muchas ganas de aprender, compartir lo que sé y seguir creciendo en un entorno que valore la creatividad y el trabajo colaborativo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_44_cv_68bc5358ae0ac8.23923130.pdf',
  'cv_68bc5358ae0ac8.23923130.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bc5358ae0ac8.23923130.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-06T15:29:28+00:00'::timestamptz,
  '2025-09-06T15:29:28+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  45,
  'Emilce Yasmín Rodríguez Gordillo',
  'emilceyasmin01@gmail.com',
  '2644360227',
  'Recursos Humanos- Cajera- Atención',
  NULL,
  'Hola, buenos días. Me dirijo a usted con el objetivo de postularme para formar parte de su equipo de trabajo.
Soy Licenciada en Recursos Humanos, graduada en diciembre de 2024, y cuento con experiencia previa en caja, tareas administrativas y atención al cliente. 

Me considero una persona proactiva, responsable y con gran capacidad de adaptación a los cambios. Tengo facilidad para aprender rápidamente y aportar soluciones eficientes, buscando siempre cumplir con los objetivos propuestos y mantener un excelente trato interpersonal.

Estoy convencida de que mi formación académica, sumada a mi experiencia y habilidades, pueden contribuir positivamente al desarrollo de su organización.

Agradezco su tiempo y consideración, y quedo a disposición para ampliar cualquier información en una entrevista personal. Adjunto mi cv a continuación',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_45_cv_68bc568e6c58b4.15262136.pdf',
  'cv_68bc568e6c58b4.15262136.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bc568e6c58b4.15262136.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-06T15:43:10+00:00'::timestamptz,
  '2025-09-06T15:43:10+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  46,
  'Celeste Balaguer',
  'balaguercele@gmail.com',
  '2644765947',
  'Recursos Humanos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_46_cv_68bd8580aa3691.77807036.pdf',
  'cv_68bd8580aa3691.77807036.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bd8580aa3691.77807036.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-07T13:15:44+00:00'::timestamptz,
  '2025-09-07T13:15:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
COMMIT;