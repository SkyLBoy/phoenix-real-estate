This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Acceso individual al panel

Crea una cuenta con correo y contraseña para el vendedor en Supabase Auth.
Si el responsable técnico necesita entrar, crea otra cuenta. Copia los IDs de
usuario de las cuentas autorizadas y configura `ADMIN_USER_IDS` en el servidor
como una lista separada por comas. Ejemplo con un identificador ficticio:

```dotenv
ADMIN_USER_IDS=11111111-1111-4111-8111-111111111111
```

En local, configura la variable en `.env.local` y reinicia el servidor. En
Vercel, configúrala en el entorno del despliegue correspondiente. El panel
usa la misma URL y clave anónima de Supabase que el catálogo.
`SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` siguen siendo variables
exclusivas del servidor. Retira `ADMIN_PIN` de la configuración.

Abre `/admin` e inicia sesión con el correo y la contraseña de una cuenta
autorizada. El catálogo público sigue disponible sin cuenta.

Ejecuta `npm test` con Node.js 22.15 o posterior para comprobar las rutas
privadas con Supabase y Gemini simulados. La prueba con una cuenta real se
puede hacer después de configurar `ADMIN_USER_IDS`.

## Migración del catálogo y publicación de fichas

Ejecuta el SQL de `supabase/migrations/20261119000200_publicacion_propiedades.sql`
en el SQL Editor de Supabase antes de desplegar esta versión. Requiere Postgres 15
o posterior y las tablas existentes `propiedades` y `leads_compradores`.
Prepara el cambio de código y SQL para la misma ventana. El catálogo quedará
vacío hasta que vuelvas a publicar fichas desde el panel.

Las propiedades existentes conservan sus datos, textos e ID y pasan a borrador
privado. Desde el panel, completa los campos que falten, abre la portada y la
carpeta de Drive para revisarlas y pulsa **Confirmar revisión y publicar**.
El catálogo lee de `propiedades_publicas`. La vista respeta RLS y expone los
campos públicos solo para fichas publicadas. El formulario VIP conserva la
inserción anónima y su listado queda protegido.

Configura `NEXT_PUBLIC_WHATSAPP_ASESOR` como el número del vendedor con código
de país, solo dígitos. Sin la variable, se conserva el número de prueba.

## Fotos de Google Drive

1. Aplica la migración de publicación de fichas y después ejecuta
   `supabase/migrations/20261119000400_fotos_drive.sql` en el SQL Editor.
2. En Drive, comparte la carpeta como **Cualquier persona con el enlace →
   Lector** y permite las descargas. Pega el enlace completo de la carpeta en
   el panel, incluido `resourcekey` cuando aparezca. Revisa el nombre de la
   carpeta, los archivos y las imágenes antes de publicar.
3. Deja `GOOGLE_DRIVE_API_KEY` sin definir para usar la vista pública de Drive.
   El selector lee el HTML del primer nivel y abre miniaturas y descargas
   directamente en Google. Si Drive cambia la vista, el panel informará que
   no pudo leerla. Comprueba el enlace en una ventana sin sesión de Google.

Si ya tienes una clave y quieres usar la API oficial, habilita **Google Drive
API**, restringe la clave a esa API y configura `GOOGLE_DRIVE_API_KEY` solo en
el servidor. [Configuración de claves](https://docs.cloud.google.com/docs/authentication/api-keys).

El selector admite JPEG, PNG, WebP, GIF y AVIF que Drive muestre en el primer
nivel. **Usar de portada** incluye esa imagen en la selección. Se puede
descargar cada original desde el selector o la ficha guardada. La ficha pública
muestra la portada y mantiene el enlace a la carpeta completa.

## Generar y aprobar textos

Después de las migraciones de publicación y fotos, ejecuta
`supabase/migrations/20261119000500_aprobacion_textos.sql` en el SQL Editor.
Los textos existentes permanecen guardados y requieren su primera aprobación.

En el inventario de `/admin`, abre **Textos de la propiedad**. Marca las
condiciones confirmadas para esa ficha y genera los cuatro borradores. Edita
y guarda cada texto, apruébalo y copia la versión final para publicar
manualmente. Si vuelves a generar, el panel pide confirmar el reemplazo.

Se reutiliza `GEMINI_API_KEY`. Si falta la clave o Gemini no devuelve cuatro
textos válidos, se usan plantillas con las condiciones confirmadas. Ambos
resultados requieren revisión y aprobación.

## Actualizar disponibilidad

Ejecuta `supabase/migrations/20261119000600_disponibilidad_publica.sql`
después de las migraciones anteriores. Añade la fecha de última confirmación
a la vista pública y conserva los estados actuales.

Desde el inventario publicado en `/admin`, usa **Confirmar disponible**,
**Marcar en contrato** o **Marcar ya no disponible**. Tras 72 horas sin
confirmación, una propiedad disponible permanece visible como **Por
confirmar**. Cuando cambia a **En contrato** o **Ya no disponible**, su ficha
sigue abriendo con el estado y acceso a otras propiedades. **Volver a
disponible** confirma la fecha y devuelve la ficha al catálogo con el mismo
enlace.
