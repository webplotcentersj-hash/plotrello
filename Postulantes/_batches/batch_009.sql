BEGIN;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  223,
  'Santiago Leonel Rodriguez',
  'samtycarp@gmail.com',
  '264 441-3103',
  'Cajero/a',
  NULL,
  'Tengo 7 años de experiencia en atención al público, caja, trámites bancarios y trato con proveedores. Estaba a cargo de ventas y reposición.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_223_cv_690374e054fe47.58882272.pdf',
  'cv_690374e054fe47.58882272.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690374e054fe47.58882272.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T14:23:28+00:00'::timestamptz,
  '2025-10-30T14:23:28+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  225,
  'Juan Jesus Emanuel Garro',
  'familiagarrooficial@gmail.com',
  '02644471267',
  'Community Manager',
  NULL,
  'Hola, soy Emanuel Garro, me encantaría trabajar con ustedes, mi disponibilidad es full time; y aprendo muy rápido',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_225_cv_69038fa2489983.84507211.pdf',
  'cv_69038fa2489983.84507211.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69038fa2489983.84507211.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T16:17:38+00:00'::timestamptz,
  '2025-10-30T16:17:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  226,
  'Thiago Benjamin Cepeda',
  'cepedathiago390@gmail.com',
  '02646304145',
  'Community Manager',
  NULL,
  'Hola! Soy Thiago, actualmente estudiando Comunnity Manager y Marketing Digital, estoy en busca de empleo y nuevas experiencias, tal vez no sepa alguna que otra cosa, pero puedo esforzarme para aprender todo lo que sea necesario.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_226_cv_69039923083751.25127057.pdf',
  'cv_69039923083751.25127057.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69039923083751.25127057.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T16:58:11+00:00'::timestamptz,
  '2025-10-30T16:58:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  228,
  'Lisandro Suarez',
  'lisandro458845@gmail.com',
  '2645508843',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_228_cv_6903a54c67c6f8.62976584.pdf',
  'cv_6903a54c67c6f8.62976584.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_6903a54c67c6f8.62976584.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T17:50:04+00:00'::timestamptz,
  '2025-10-30T17:50:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  229,
  'Eduardo Rosales',
  'eduroscar96@gmail.com',
  '2645262182',
  'Desarrollador/a Frontend',
  NULL,
  'Buenas tardes mi nombre es Eduardo Rosales, Técnico en Informática con experiencia en Desarrollo Web y conocimientos en Marketing Digital. Me enfoco en crear soluciones web innovadoras y efectivas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_229_cv_6903b82a2b52a7.30992139.pdf',
  'cv_6903b82a2b52a7.30992139.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6903b82a2b52a7.30992139.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T19:10:34+00:00'::timestamptz,
  '2025-10-30T19:10:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  230,
  'Montero Florencia',
  'florenciamontero2001@gmail.com',
  '2644048492',
  'Community Manager',
  NULL,
  'Hola! soy Flor Montero, community manager, muy proactiva y muy decidida a seguir aprendiendo, estoy dispuesta a realizar todas las tareas que sean necesarias! Me sigo formando todos los meses porque creo que en este rubro uno nunca termina de aprender.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_230_cv_69040d9a7fc841.94536443.pdf',
  'cv_69040d9a7fc841.94536443.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69040d9a7fc841.94536443.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T01:15:06+00:00'::timestamptz,
  '2025-10-31T01:15:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  231,
  'Ana González',
  'anagon161228@gmail.com',
  '+5492644440050',
  'Community Manager',
  NULL,
  'Soy Ana González, Social Media Manager y Community Manager con experiencia en la gestión estratégica de redes sociales, creación de contenido, planificación mensual y campañas publicitarias en Meta, Google y TikTok. Me especializo en desarrollar estrategias digitales orientadas a resultados, fortaleciendo la identidad de marca y mejorando la conexión con el público. Me encantaría formar parte del equipo de Plot Center para aportar mi experiencia y potenciar su presencia online.
https://a-ámba.my.canva.site/ana-gonzalez',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_231_cv_69041be76b7fa1.09732311.pdf',
  'cv_69041be76b7fa1.09732311.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69041be76b7fa1.09732311.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T02:16:07+00:00'::timestamptz,
  '2025-10-31T02:16:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  232,
  'Sofía Gimena Rojas Pereyra',
  'sofiagimenarojas@gmail.com',
  '2645685679',
  'Community Manager',
  NULL,
  'Mi perfil se alinea con la producción de contenido visual atractivo y estratégico . Cuento con habilidades en la toma y edición de fotografía y video, dominio de herramientas de diseño. Soy capaz de generar contenido que no solo se ve bien, sino que está respaldado por nociones de marketing digital.

Agradezco su tiempo y consideración.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_232_cv_69043176483a29.14777716.pdf',
  'cv_69043176483a29.14777716.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69043176483a29.14777716.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T03:48:06+00:00'::timestamptz,
  '2025-10-31T03:48:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  233,
  'Matias López',
  'matiaslopez4305@gmail.com',
  '2644654751',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_233_cv_690488ea1e7ab2.51770265.pdf',
  'cv_690488ea1e7ab2.51770265.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690488ea1e7ab2.51770265.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T10:01:14+00:00'::timestamptz,
  '2025-10-31T10:01:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  234,
  'Jazmin Bergara',
  'ariloujabergara@gmail.com',
  '02644897660',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_234_cv_6904acb4610fb3.95660837.pdf',
  'cv_6904acb4610fb3.95660837.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6904acb4610fb3.95660837.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T12:33:56+00:00'::timestamptz,
  '2025-10-31T12:33:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  235,
  'Tomas Jesús Deusedas',
  'deusedastomas@gmail.com',
  '2645259325',
  'Community Manager',
  NULL,
  'Buenos días, me presento soy Tomás Deusedas tengo amplio conocimiento en varios puestos la mayoría en marketing y ventas además de tareas administrativas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_235_cv_6904ba282ca0b1.79605866.pdf',
  'cv_6904ba282ca0b1.79605866.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6904ba282ca0b1.79605866.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T13:31:20+00:00'::timestamptz,
  '2025-10-31T13:31:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  236,
  'Tania Macarena Lambarri Páez',
  'tanialambarri@gmail.com',
  '2644843730',
  'Community Manager',
  NULL,
  'Mucho gusto. Además del seleccionado, también aplico a puestos como: Atención al cliente/ Operador de mostrador/ Analista de Marketing/ Vendedor y Asesor comercial. Tengo predisposición, enfoque y ganas de crecer, en lo personal y profesional, adaptando el marketing a cada área posible para potenciarla y expandirla. Desde ya, gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_236_cv_6904ec05d55da3.76146372.pdf',
  'cv_6904ec05d55da3.76146372.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6904ec05d55da3.76146372.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T17:04:05+00:00'::timestamptz,
  '2025-10-31T17:04:05+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  237,
  'Tania Figueroa',
  'taniafigmoncunill@gmail.com',
  '2645754322',
  'Community Manager',
  NULL,
  'Buenas! Poseo conocimientos y experiencia como cm, y nociones básicas de diseño gráfico como también en administración y atención. 
Actualmente tengo disponibilidad full time. 
Aclaro que el cv está desactualizado, ya no trabajo en Dione debido a su cierre.
Gracias!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_237_cv_6904f2abf361b9.02824931.pdf',
  'cv_6904f2abf361b9.02824931.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6904f2abf361b9.02824931.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T17:32:27+00:00'::timestamptz,
  '2025-10-31T17:32:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  238,
  'Aixa Yazmin Zabala Avila',
  'aixazabalayazmin@gmail.com',
  '2644517700',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_238_cv_69064a81370955.85089175.pdf',
  'cv_69064a81370955.85089175.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69064a81370955.85089175.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-01T17:59:29+00:00'::timestamptz,
  '2025-11-01T17:59:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  239,
  'Brian Vladimir Cortes Cortes Aguirre',
  'briacortes2@gmail.com',
  '02644881322',
  'Gerente General',
  NULL,
  'Buen día, estimado, espero que se encuentre bien.

Soy Brian Vladimir, Administrador Financiero Gerencial, con amplia trayectoria liderando la gestión financiera de tres empresas en los sectores minero, petrolero, industrial y comercial, tanto para el ámbito público como privado, a nivel nacional e internacional. Mi enfoque combina un análisis financiero riguroso con el desarrollo de estrategias de crecimiento y eficiencia, respaldado por un equipo de profesionales especializados.

Le adjunto mi currículum, donde detallo mi experiencia internacional en Dubai, ASIA y la coordinación con proveedores en China, Brasil y Chile.

Actualmente me encuentro trabajando en FULLBACK en el área de Producción y estoy buscando nuevas oportunidades.

¿Podríamos coordinar una reunión para conversar sobre cómo aportar valor a su organización?

Quedo a la espera de su respuesta.

Saludos cordiales,
Brian Vladimir Cortes Aguirre
M A16969',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_239_cv_69075369542ba1.74672721.pdf',
  'cv_69075369542ba1.74672721.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69075369542ba1.74672721.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-02T12:49:45+00:00'::timestamptz,
  '2025-11-02T12:49:45+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  240,
  'Emilio Rodriguez',
  'rodriguezemilio95@gmail.com',
  '+5492645467808',
  'Gerente de Marketing',
  NULL,
  'Soy Licenciado en Marketing con sólida experiencia liderando estrategias omnicanal, campañas de performance y posicionamiento de marca en sectores como consumo masivo, retail, tecnología y servicios. Me especializo en generar crecimiento medible, liderar equipos multidisciplinarios y optimizar inversiones publicitarias a través de un enfoque analítico, creativo y orientado a resultados.
Actualmente dirijo Rowth, mi consultora de marketing 360, desde donde acompaño a empresas y equipos en procesos de transformación digital, branding y expansión comercial.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_240_cv_69081983830778.99587055.pdf',
  'cv_69081983830778.99587055.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69081983830778.99587055.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-03T02:54:59+00:00'::timestamptz,
  '2025-11-03T02:54:59+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  241,
  'Angel Molina',
  'angelformal09@gmail.com',
  '2644436695',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_241_cv_6909434096d255.14346209.pdf',
  'cv_6909434096d255.14346209.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6909434096d255.14346209.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T00:05:20+00:00'::timestamptz,
  '2025-11-04T00:05:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  242,
  'Larisa Sanchez',
  'larisanchez96@gmail.com',
  '2645324129',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_242_cv_69097539726c41.90245558.docx',
  'cv_69097539726c41.90245558.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69097539726c41.90245558.docx","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T03:38:33+00:00'::timestamptz,
  '2025-11-04T03:38:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  244,
  'Rocio celeste lampasona',
  'celestelampasona@gmail.com',
  '2644826895',
  'Vendedor/a',
  NULL,
  'Soy Técnica en educación profesional, esta carrera tiene salida laboral en administración, también estudio abogacía, tengo diplomado en marketing digital, higiene y seguridad. Tengo experiencia en ventas, soy responsable, me adapto rápido al entorno laboral y me capacitó por mejorar mis habilidades 
Muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_244_cv_690a31b9a5beb6.43994703.pdf',
  'cv_690a31b9a5beb6.43994703.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_690a31b9a5beb6.43994703.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T17:02:49+00:00'::timestamptz,
  '2025-11-04T17:02:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  245,
  'Carolina Pereyra',
  'carop2005@gmail.com',
  '2920 607463',
  'Generalista de RRHH',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_245_cv_690a49050f40b8.94547681.pdf',
  'cv_690a49050f40b8.94547681.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690a49050f40b8.94547681.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T18:42:13+00:00'::timestamptz,
  '2025-11-04T18:42:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
COMMIT;