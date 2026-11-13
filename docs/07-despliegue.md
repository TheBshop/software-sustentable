# 7. Despliegue (staging y producción)

Guía para publicar el sistema por primera vez. Se hace **una vez por entorno**: primero *staging* (para probar con la cooperativa) y después *producción*, repitiendo los pasos con otros nombres.

| Pieza | Servicio | Archivo en el repo |
|---|---|---|
| Base de datos | MongoDB Atlas | — |
| Fotos y backups | Cloudflare R2 | `apps/api/src/lib/storage.js` |
| API | Render | `render.yaml` |
| Panel web | Netlify | `netlify.toml` |
| Backup diario | GitHub Actions | `.github/workflows/backup.yml` |
| App del chofer | Expo EAS | `apps/mobile/eas.json` |

Tiempo estimado: 2 a 3 horas la primera vez.

## 0. Antes de empezar

- Crear las cuentas **a nombre de la cooperativa** (un email institucional), con al menos **dos personas administradoras** en cada servicio. Si una cuenta queda a nombre de un desarrollador y esa persona se va, se pierde el acceso.
- El código tiene que estar en una organización de GitHub de la cooperativa.
- Tener a mano un gestor de contraseñas compartido (Bitwarden tiene plan gratuito para organizaciones) para guardar las credenciales que se generan.

## 1. MongoDB Atlas

1. Crear un proyecto `nueva-vida` y un cluster **M0 (gratis)**. Región: `São Paulo (sa-east-1)` en AWS, la más cercana.
2. *Database Access* → crear dos usuarios:
   - `api` con rol **readWrite** sobre la base `nueva-vida` → lo usa Render.
   - `backup` con rol **read** → lo usa el backup diario.
3. *Network Access* → `0.0.0.0/0`. Render no tiene una IP fija en los planes chicos; la seguridad la dan el usuario y la contraseña largos. Si más adelante se pasa a un plan con IPs fijas, restringirlo.
4. *Connect → Drivers* → copiar la cadena `mongodb+srv://api:<password>@.../nueva-vida?retryWrites=true&w=majority`. Ese es el `MONGO_URI`.

> El plan M0 **no incluye backups automáticos**. Por eso existe el paso 6.

## 2. Cloudflare R2 (fotos)

1. *R2 → Create bucket* → `nueva-vida-fotos` (uno por entorno: `-staging` y el de producción).
2. *Settings → Public access* → conectar un subdominio propio, por ejemplo `fotos.coopenuevavida.org.ar`. El subdominio `r2.dev` sirve para probar, pero Cloudflare lo limita y no se recomienda para producción.
3. *R2 → Manage API tokens → Create token* con permiso **Object Read & Write** solo para ese bucket. Anotar:
   - Access Key ID → `S3_ACCESS_KEY_ID`
   - Secret Access Key → `S3_SECRET_ACCESS_KEY`
   - Endpoint `https://<account-id>.r2.cloudflarestorage.com` → `S3_ENDPOINT`
4. *Bucket → Settings → Object lifecycle rules* → borrar objetos con prefijo `backups/` después de 90 días.

## 3. Render (API)

1. *New → Blueprint* → elegir el repositorio. Render lee `render.yaml` y crea el servicio `nueva-vida-api`.
2. Completar las variables marcadas como pendientes:

| Variable | Valor |
|---|---|
| `MONGO_URI` | la cadena del paso 1 |
| `PUBLIC_WEB_URL` | la URL del panel web (paso 5). Para el primer deploy se puede poner la de Netlify provisoria y corregirla después |
| `CORS_ORIGINS` | la misma URL del panel (sin `/` al final). Varias se separan con coma |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | paso 2 |
| `STORAGE_PUBLIC_URL` | `https://fotos.coopenuevavida.org.ar` |
| `SMTP_*`, `MAIL_FROM` | opcional: Brevo o Resend para enviar certificados por mail |

`JWT_SECRET` lo genera Render solo. **Si falta alguna variable, la API no arranca** y el log de Render dice cuál falta.

3. Verificar: `https://<servicio>.onrender.com/health` responde `{"ok":true}`.

> El plan `starter` (USD 7/mes) queda siempre encendido. El plan `free` se duerme a los 15 minutos sin uso y tarda cerca de un minuto en despertar: sirve para staging, no para que lo usen los choferes.

## 4. Primer usuario administrador

Desde la computadora de quien despliega, con acceso a Atlas:

```bash
cd apps/api
MONGO_URI="mongodb+srv://api:...@.../nueva-vida" npm run crear-usuario -- admin@coopenuevavida.org.ar "Nombre Apellido"
```

Muestra una contraseña aleatoria **una sola vez**. Guardarla en el gestor de contraseñas. El mismo comando con otro rol crea choferes (`chofer`), personal de planta (`operador_planta`) o administración (`administracion`). Si alguien olvida su contraseña, correrlo de nuevo con su email le genera una nueva.

## 5. Netlify (panel web)

1. *Add new site → Import from Git* → elegir el repositorio. Netlify toma la configuración de `netlify.toml`.
2. *Site settings → Environment variables* → `VITE_API_URL = https://<servicio>.onrender.com`.
3. *Domain management* → conectar el dominio de la cooperativa (por ejemplo `panel.coopenuevavida.org.ar`). Netlify gestiona el certificado HTTPS.
4. Volver a Render y poner esa URL definitiva en `PUBLIC_WEB_URL` y `CORS_ORIGINS`. `PUBLIC_WEB_URL` es la que va en el QR de los certificados: **definirla antes de emitir certificados reales**, porque los QR ya impresos no se pueden cambiar.

Cada pull request genera un *deploy preview* con su propia URL. Para que funcione contra la API de staging, agregar ese dominio a `CORS_ORIGINS` de staging (por ejemplo `https://deploy-preview-12--nueva-vida.netlify.app`) o usar el panel de staging directamente.

## 6. Backup diario

1. En GitHub: *Settings → Secrets and variables → Actions* → crear `BACKUP_MONGO_URI` (usuario `backup` del paso 1), `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
2. *Actions → Backup diario → Run workflow* para correrlo a mano la primera vez y confirmar que aparece el archivo en `backups/` del bucket.
3. **Probar la restauración** al menos una vez, en una base de prueba:

```bash
mongorestore --uri "mongodb+srv://...base-de-prueba" --archive=nueva-vida-AAAA-MM-DD.gz --gzip
```

Un backup que nunca se restauró no está probado.

## 7. App del chofer (APK)

1. Cuenta de Expo de la cooperativa → `npx eas-cli login` y `npx eas-cli init` dentro de `apps/mobile` (agrega el `projectId` a `app.json`).
2. En `apps/mobile/eas.json`, reemplazar `CAMBIAR` por la URL real de la API (staging en el perfil `preview`).
3. `npx eas-cli build -p android --profile preview` → al terminar da un link para descargar el APK. Se instala en los teléfonos de los choferes (Android pide habilitar "instalar apps de origen desconocido").
4. Correcciones que solo tocan JavaScript se pueden mandar sin reinstalar con `npx eas-cli update`.

## 8. Verificación final

- [ ] `/health` de la API responde.
- [ ] Login en el panel con el admin.
- [ ] Cargar materiales y clientes reales: `npm run importar -- revisar planilla.xlsx` y después `cargar`, con `MONGO_URI` de producción.
- [ ] Desde un teléfono con el APK: login de un chofer, cargar un retiro **con foto** y verificar que la foto se ve desde Retiros en el panel (confirma R2).
- [ ] Emitir un certificado y escanear el QR con otro teléfono: tiene que abrir `PUBLIC_WEB_URL/verificar/...`.
- [ ] Enviar un certificado por mail (si se configuró SMTP).
- [ ] El backup del día aparece en el bucket.
