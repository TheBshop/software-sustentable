# 1. Stack tecnológico y arquitectura

## 1.1 Stack definitivo

| Capa | Elección | Por qué |
|---|---|---|
| Backend | **Node.js 22 LTS + Express 5** | Lo pidieron, es lo más conocido por desarrolladores junior/voluntarios. Express 5 maneja errores de handlers `async` sin librerías extra. |
| Base de datos | **MongoDB 7 + Mongoose 8** (Atlas en producción) | Los retiros son documentos naturales (cliente + lista de materiales + fotos). Atlas tiene plan gratuito (M0, 512 MB) que alcanza holgado para el MVP. |
| Validación | **Zod** | Un solo lugar donde se definen las reglas de cada request; errores claros en español. |
| Web | **React 18 + Vite** (SPA) | Build rápido, sin servidor propio: se publica como sitio estático. Sin framework de UI pesado en el MVP. |
| Móvil | **React Native con Expo** | Mismo lenguaje (JS) y mismo modelo mental (React) que la web → el mismo equipo hace las dos. Expo resuelve cámara, GPS y almacenamiento offline sin tocar código nativo, y permite generar el APK en la nube (EAS) sin tener Android Studio. |
| PDF + QR | **pdfkit + qrcode** | Generación en el servidor, sin navegador headless (Puppeteer es pesado para un hosting barato). |
| Auth | **JWT** (bcrypt para passwords) | Simple, sirve igual para web y app. Pocos usuarios, roles fijos. |
| Tests | **Vitest + Supertest + mongodb-memory-server** | Tests de API reales contra un Mongo en memoria; corren en CI sin infraestructura. |
| CI | **GitHub Actions** | Gratis para repos públicos y con cuota gratuita en privados. |

### Por qué Expo y no Ionic o Flutter

- **Flutter**: muy bueno, pero obliga a aprender Dart y separa al equipo en dos tecnologías. Para un equipo chico es un costo alto.
- **Ionic/Capacitor**: reusa más la web, pero el manejo offline + cámara + cola de sincronización termina siendo igual de trabajoso, y la experiencia en teléfonos Android de gama baja es peor.
- **Expo (React Native)**: comparte lenguaje, librerías (fetch, lógica de validación) y gente con la web. Además, con **EAS Update** se pueden mandar correcciones a los teléfonos sin reinstalar el APK.

> **Simplificación fuerte para el MVP:** distribuir la app como **APK directo** (link de descarga o WhatsApp) a los 3–5 teléfonos de los choferes, sin publicar en Play Store todavía.

### Hosting sugerido (costo ≈ 0 en el MVP)

| Pieza | Servicio | Plan |
|---|---|---|
| API | Render / Railway / Fly.io | Free o el plan más chico (~USD 5–7/mes, recomendado para que no "se duerma") |
| Base | MongoDB Atlas | M0 gratis |
| Web | Netlify / Vercel / Cloudflare Pages | Gratis |
| Fotos | Cloudflare R2 o Cloudinary | Gratis hasta varios GB |
| Email | Brevo / Resend (SMTP) | Gratis hasta ~300 mails/día |
| App | Expo EAS Build | Gratis (cola compartida) |

## 1.2 Arquitectura

**Monolito modular** (una sola API dividida en módulos por dominio). No microservicios: para este volumen sería complejidad sin beneficio.

```mermaid
flowchart LR
  subgraph Campo
    APP[App móvil Expo<br/>chofer<br/>cola offline]
  end
  subgraph Oficina/Planta
    WEB[Web React<br/>administración, planta]
  end
  subgraph Público
    QR[Página /verificar/:codigo<br/>cliente generador o auditor]
  end

  APP -- HTTPS + JWT --> API
  WEB -- HTTPS + JWT --> API
  QR -- HTTPS sin login --> API

  subgraph API[API Node/Express]
    direction TB
    M1[auth / usuarios]
    M2[clientes · materiales]
    M3[retiros · ingresos · ventas]
    M4[certificados<br/>PDF + QR]
    M5[facturas · alertas]
    M6[dashboard]
  end

  API --> DB[(MongoDB Atlas)]
  API --> FS[(Storage de fotos<br/>R2 / Cloudinary)]
  API --> MAIL[SMTP]
  API -. link wa.me .-> WA[WhatsApp del operador]
  API -. MVP+1 .-> FE[Proveedor factura electrónica<br/>ARCA]
```

### Estructura del repo

```
nueva-vida/
├─ apps/
│  ├─ api/                 Express + Mongoose
│  │  ├─ src/
│  │  │  ├─ app.js         arma Express y monta los routers
│  │  │  ├─ server.js      conecta Mongo y levanta el puerto
│  │  │  ├─ seed.js        datos de ejemplo
│  │  │  ├─ config/        variables de entorno
│  │  │  ├─ middleware/    auth (JWT + roles), errores
│  │  │  ├─ lib/           crud genérico, contadores, validación
│  │  │  └─ modules/       un directorio por dominio (model + routes + service)
│  │  └─ tests/
│  ├─ web/                 React + Vite
│  └─ mobile/              Expo (React Native)
├─ docs/                   esta documentación
├─ templates/              contrato tipo
├─ docker-compose.yml      MongoDB local
└─ .github/workflows/      CI
```

Convención por módulo: `*.model.js` (esquema Mongoose + schema Zod de entrada), `*.routes.js` (HTTP), `*.service.js` (reglas de negocio, testeables sin HTTP). Los ABM simples usan `lib/crud.js` y no necesitan router propio.

### Decisiones clave

1. **Offline-first en la app.** Los retiros se guardan primero en el teléfono y se sincronizan cuando hay señal. Cada retiro lleva un `localId` (UUID) y `POST /api/retiros` es **idempotente** por ese campo: reintentar nunca duplica.
2. **Peso estimado vs. peso real.** El chofer carga el estimado; la planta carga el real de balanza. Todo cálculo usa `pesoReal ?? pesoEstimado`, y el certificado marca con `*` lo estimado.
3. **Snapshots en documentos "legales".** Certificados y facturas copian los datos (razón social, pesos, factores de CO2, precios) en el momento de emitirse. Cambiar una tarifa mañana no altera lo ya emitido.
4. **Código de certificado no adivinable.** El QR apunta a `/verificar/<código aleatorio de 12 caracteres>`, no al ID ni al número correlativo, para que nadie pueda recorrer certificados ajenos.
5. **Baja lógica** en clientes y materiales (`activo: false`): no se rompe el historial.
6. **Roles fijos**: `admin`, `administracion`, `operador_planta`, `chofer`. Suficiente para una cooperativa; si hace falta más granularidad se agrega después.

## 1.3 Simplificaciones recomendadas para llegar rápido al MVP

| Pedido original | Propuesta para el MVP | Después |
|---|---|---|
| Envío por WhatsApp | Link `wa.me` con el mensaje armado: el operador toca y envía desde su WhatsApp. Cero costo, cero trámite con Meta. | WhatsApp Business Cloud API cuando haya volumen. |
| Generación de facturas | **Liquidación / prefactura interna** (lo que se le cobra a cada cliente y por qué) + alertas de cobro. La factura fiscal se sigue haciendo como hoy y se registra el número/CAE. | Integrar un proveedor de factura electrónica con API (ARCA, ex AFIP). **No** integrar ARCA directo: certificados digitales y WSFE consumen semanas. |
| Contratos | Un template Markdown/Word con campos a completar (en `templates/`). | Generación automática del PDF del contrato desde los datos del cliente y firma digital. |
| Dashboard | KPIs + 2 rankings (kg por material, kg por cliente) del mes. | Filtros de fecha, gráficos históricos, exportar a Excel. |
| Fotos | Disco del servidor. | Storage externo (R2/Cloudinary) — **obligatorio antes de producción**, porque Render/Railway borran el disco en cada deploy. |
| CO2 evitado | Factor fijo por material, configurable. | Revisar factores con una fuente citada (ver modelo de datos). |
