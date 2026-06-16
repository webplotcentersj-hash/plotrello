BEGIN;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  304,
  'Fabio Herrera',
  'estrelladelrosario6@gmail.com',
  '+543513631094',
  'Administrativo/a de Personal',
  NULL,
  'Buenas tardes, espero que se encuentre bien adjunto mi cv ya que me encuentro buscando empleo, espero que mi perfil se adapte a futuras vacantes activas.
Me encuentro disponible para que puedan conocer más sobre mi experiencia y mi persona.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_304_cv_69275b56a3dce8.13116569.pdf',
  'cv_69275b56a3dce8.13116569.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69275b56a3dce8.13116569.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T19:56:06+00:00'::timestamptz,
  '2025-11-26T19:56:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  305,
  'Yanina Flores Yanzón',
  'yaflor.yf@gmail.com',
  '2646490091',
  'Administrativo/a de Personal',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_305_cv_69275e228ff4b1.16243633.pdf',
  'cv_69275e228ff4b1.16243633.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69275e228ff4b1.16243633.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T20:08:02+00:00'::timestamptz,
  '2025-11-26T20:08:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  307,
  'Carlos Emanuel Salinas',
  'emaa.salinass@gmail.com',
  '2645287092',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_307_cv_6927621cbf9133.21698661.pdf',
  'cv_6927621cbf9133.21698661.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927621cbf9133.21698661.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T20:25:00+00:00'::timestamptz,
  '2025-11-26T20:25:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  308,
  'Guillermo Rodrigo Martín Yornet',
  'informestrabajo2214@gmail.com',
  '2644181960',
  'Analista de Presupuestos',
  NULL,
  'Hola! Soy Guillermo Martín un joven con mucha experiencia en el área de ventas, soy muy emprendedor me desarrollo en diversas áreas, me caracterizo por siempre estar queriendo aprender de diversas actividades y estar en formación permanente. Tengo muchos contactos y conocidos y estaría dispuesto a usarlos para hacer crecer aún más la empresa, admiro el crecimiento y la historia de la empresa y me identifica mucho, por eso me encantaría poder trabajar con ustedes y aprender de ustedes! Gracias….',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_308_cv_6927628aef8e38.40322640.doc',
  'cv_6927628aef8e38.40322640.doc',
  'application/msword',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927628aef8e38.40322640.doc","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T20:26:50+00:00'::timestamptz,
  '2025-11-26T20:26:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  309,
  'Emiliano Vargas',
  'emilianovargas64@gmail.com',
  '2646277951',
  'Analista de Presupuestos',
  NULL,
  'Soy Emiliano Vargas, tengo 24 años y actualmente estoy estudiando Lic. en Finanzas en UES21. Siento que puedo aportar compromiso, orden, capacidad para trabajar con números y una actitud proactiva para aprender y mejorar continuamente. Me considero alguien confiable, con buena comunicación y acostumbrado a trabajar bajo responsabilidad y objetivos. Tengo muchas ganas de sumar mi esfuerzo y crecer dentro de un equipo técnico-administrativo como el de Plot Center.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_309_cv_69277115086d64.21113195.pdf',
  'cv_69277115086d64.21113195.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69277115086d64.21113195.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T21:28:53+00:00'::timestamptz,
  '2025-11-26T21:28:53+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  310,
  'Facundo Humberto Fernández Agüero',
  'facufernandez4589@gmail.com',
  '2645307532',
  'Analista de Presupuestos',
  NULL,
  'Soy estudiante de la carrera Contador Público. con conocimientos técnicos a partir de mi formación en el secundario, además de mi experiencia trabajando en el Area de cotizaciones de una empresa Metalúrgica. También me puedo desarrollar en cotizaciones para los clientes. Quedo atento a cualquier comentario. Saludos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_310_cv_6927752cede4f9.77451747.pdf',
  'cv_6927752cede4f9.77451747.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927752cede4f9.77451747.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T21:46:20+00:00'::timestamptz,
  '2025-11-26T21:46:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  313,
  'Fernando Ariel Guevara',
  'graficosdigital5@gmail.com',
  '264 584-4564',
  'Encargo de Presupuestos',
  NULL,
  'Amplía experiencia en el rubro, Imprenta, Gráfica y Digital',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_313_cv_69277a064b2543.38558832.pdf',
  'cv_69277a064b2543.38558832.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69277a064b2543.38558832.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T22:07:02+00:00'::timestamptz,
  '2025-11-26T22:07:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  314,
  'Leandro Caro Vera',
  'leandrocarovera138@gmail.com',
  '2646271014',
  'Analista de Presupuestos',
  NULL,
  'Amplia trayectoria comercial y administrativa, en entornos variados y dinámicos. Proactivo, con orientación a la resolución de problemas y con amor por los desafíos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_314_cv_69277de4adc729.16378792.pdf',
  'cv_69277de4adc729.16378792.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69277de4adc729.16378792.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T22:23:32+00:00'::timestamptz,
  '2025-11-26T22:23:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  315,
  'Gisel Esquivel',
  'giselesquivel2018@gmail.com',
  '2645657113',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_315_cv_6927a08441ffa2.41355800.pdf',
  'cv_6927a08441ffa2.41355800.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927a08441ffa2.41355800.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T00:51:16+00:00'::timestamptz,
  '2025-11-27T00:51:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  316,
  'Ramiro Guzman',
  'ramiroguzmanrg21@gmail.com',
  '2645446991',
  'Analista de Presupuestos',
  NULL,
  'Persona en busqueda laboral, responsable y con muchas ganas de tener experiencia laboral nueva.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_316_cv_6927ae7f4e2198.22465977.pdf',
  'cv_6927ae7f4e2198.22465977.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927ae7f4e2198.22465977.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T01:50:55+00:00'::timestamptz,
  '2025-11-27T01:50:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  317,
  'Leonel Campillay',
  'leocampillay39@gmail.com',
  '2645717166',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_317_cv_6927b962ad7e22.23268294.pdf',
  'cv_6927b962ad7e22.23268294.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927b962ad7e22.23268294.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T02:37:22+00:00'::timestamptz,
  '2025-11-27T02:37:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  319,
  'Maria Fernanda Tello',
  'mfernandatello1@hotmail.com',
  '2644523659',
  'Analista de Presupuestos',
  NULL,
  'Buenos dejo mis datos cuento con 5 años de experiencia en puesto similares a armado de presupuestos, atencion al cliente, cajera y administrativo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_319_cv_69282b62b30a38.92176962.pdf',
  'cv_69282b62b30a38.92176962.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69282b62b30a38.92176962.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T10:43:46+00:00'::timestamptz,
  '2025-11-27T10:43:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  320,
  'Ariel Funes',
  'sergioariel1977@gmail.com',
  '2644522166',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_320_cv_69282c19c81b86.87372095.docx',
  'cv_69282c19c81b86.87372095.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69282c19c81b86.87372095.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T10:46:49+00:00'::timestamptz,
  '2025-11-27T10:46:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  321,
  'Lucas Tello',
  'lucastello77@gmail.com',
  '264 4823637',
  'Analista de Presupuestos',
  NULL,
  'Profesional del área administrativa con más de siete años
de experiencia, colaborando con diversas empresas en la
optimización de procesos, la organización eficiente de
datos y documentación.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_321_cv_69284b81c9fd18.17880653.pdf',
  'cv_69284b81c9fd18.17880653.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69284b81c9fd18.17880653.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T13:00:49+00:00'::timestamptz,
  '2025-11-27T13:00:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  323,
  'Matías Uriel Quiroga Cabrera',
  'urielquiroga17@gmail.com',
  '2644860517',
  'Atención al Cliente',
  NULL,
  'Buenas!
Me gustaría postularme para trabajar en Plot Center.
Cuento con sólidos conocimientos en el área del diseño y experiencia en la creación y preparación de piezas para impresión, lo que me permite comprender muy bien los procesos y las necesidades del cliente. Soy responsable, detallista y tengo buena comunicación, por lo que puedo adaptarme rápido al ritmo de trabajo y colaborar tanto en la atención como en la producción.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_323_cv_69285ac79e5949.97839672.pdf',
  'cv_69285ac79e5949.97839672.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69285ac79e5949.97839672.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T14:05:59+00:00'::timestamptz,
  '2025-11-27T14:05:59+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  325,
  'Gonzalo Martin Zavala Lopez',
  'gonzalomartinzavalalopez@gmail.com',
  '02646300097',
  'Analista de Presupuestos',
  NULL,
  'Actualmente trabajando en carteleria elebe producciones',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_325_cv_69286fb8210182.41366969.pdf',
  'cv_69286fb8210182.41366969.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69286fb8210182.41366969.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T15:35:20+00:00'::timestamptz,
  '2025-11-27T15:35:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  326,
  'Yanella Aylen Alameda',
  'yane.alameda06@gmail.com',
  '2645855638',
  'Asistente Administrativo/a',
  NULL,
  'Hola, buen día. Mi nombre es Yanella Alameda. Si bien me postulé para el puesto de Asistente Administrativo, deseo expresar que también estoy disponible y con interés en otros roles dentro de la empresa, tales como cajera, sector administrativo, atención al cliente, analista de presupuesto, vendedora o asesora comercial.
Una vez dicho eso, les contaré un poco de mi cuento con experiencia en atención al público, recepción, ventas y tareas administrativas. Actualmente estudio el Profesorado de Matemática. Me caracterizo por la responsabilidad, el compromiso y la buena disposición para aprender y asumir nuevos desafíos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_326_cv_6928787ce67375.45772758.pdf',
  'cv_6928787ce67375.45772758.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928787ce67375.45772758.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T16:12:44+00:00'::timestamptz,
  '2025-11-27T16:12:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  327,
  'Agustín Pereyra',
  'agusabel555@gmail.com',
  '2645255797',
  'Analista de Presupuestos',
  NULL,
  'Hola buenos días, como dice mi CV trabajé de secretario atendiendo, vendiendo, generando y mandando presupuestos, como también haciendo los contratos. Espero su respuesta. Muchas Gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_327_cv_692878951bcc02.90435056.pdf',
  'cv_692878951bcc02.90435056.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692878951bcc02.90435056.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T16:13:09+00:00'::timestamptz,
  '2025-11-27T16:13:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  329,
  'Tomas Jesús Deusedas',
  'tomyjes25@gmail.com',
  '2645259325',
  'ENCARGADO DE PRESUPUESTO',
  NULL,
  'Buenas tardes adjunto mí CV para el puesto o cualquiera afín a mis habilidades.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_329_cv_69288ca37bd823.32685869.pdf',
  'cv_69288ca37bd823.32685869.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69288ca37bd823.32685869.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T17:38:43+00:00'::timestamptz,
  '2025-11-27T17:38:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  330,
  'Luis Cesar Maza',
  'luis.c.maza@gmail.com',
  '2646209064',
  'Gerente de Marketing',
  NULL,
  'Consultor en estrategias de comunicación y posicionamiento digital. Combino creatividad con enfoque analítico para resolver problemas reales y potenciar marcas. Me apasiona transformar ideas en proyectos concretos y sumar valor en equipos que buscan crecer con visión y criterio.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_330_cv_6928988a211343.80006123.pdf',
  'cv_6928988a211343.80006123.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928988a211343.80006123.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T18:29:30+00:00'::timestamptz,
  '2025-11-27T18:29:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
COMMIT;