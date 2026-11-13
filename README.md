# ♻ Nueva Vida — Plataforma de gestión

Sistema de la **Cooperativa Nueva Vida (Paraná)** para digitalizar retiros de reciclables, emitir certificados de disposición sustentable con QR y liquidar el servicio a grandes generadores.

| | |
|---|---|
| `apps/api` | API Node.js + Express 5 + MongoDB (Mongoose) |
| `apps/web` | Web React + Vite (administración, planta, validación pública de certificados) |
| `apps/mobile` | App Expo / React Native para choferes (offline-first) |
| `docs/` | Stack, arquitectura, modelo de datos, API, backlog, flujo de trabajo, equipo |
| `templates/` | Contrato tipo para grandes generadores |

## Arranque rápido

Requisitos: Node 20+.

**Opción rápida, sin instalar MongoDB.** La base vive en memoria y se pierde al cortar el proceso:

```bash
npm install
npm run dev:memoria  # API + datos de ejemplo → admin@nuevavida.local / admin1234
npm run dev:web      # http://localhost:5173 (en otra terminal)
```

**Con MongoDB persistente** (Docker o un Mongo accesible):

```bash
cp apps/api/.env.example apps/api/.env
npm run db:up        # MongoDB en Docker
npm run seed         # borra la base y carga datos de ejemplo
npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:5173
```

```bash
npm test             # tests de la API (MongoDB en memoria, no necesita Docker)
```

## Panel web

Inicio (métricas del mes) · Retiros (pesar en planta, emitir certificado) · Ingresos a planta · Ventas · Certificados (PDF, envío por WhatsApp/email, anulación) · Facturación (alertas de cobro, liquidación con vista previa, pagos, número de factura ARCA) · Clientes · Materiales. La página pública `/verificar/:codigo` es la que abre el QR.

## Carga inicial desde Excel

La cooperativa completa [templates/plantilla-carga-nueva-vida.xlsx](templates/plantilla-carga-nueva-vida.xlsx) (hojas *Materiales* y *Clientes*, con instrucciones y listas desplegables). Después:

```bash
npm run importar -- revisar datos-cooperativa.xlsx   # valida y muestra qué haría, sin guardar
npm run importar -- cargar datos-cooperativa.xlsx    # guarda en la base de MONGO_URI
npm run importar -- plantilla nueva-plantilla.xlsx   # vuelve a generar la planilla vacía
```

Si alguna fila tiene errores, se listan con hoja y número de fila y no se guarda nada. Volver a importar actualiza materiales (por código) y clientes (por CUIT) en vez de duplicarlos.

App móvil (se instala aparte para no mezclar dependencias nativas):

```bash
cd apps/mobile
npm install && npx expo install --fix
# editar app.json → extra.apiUrl con la IP de tu PC en la red local
npx expo start       # escanear el QR con Expo Go
```

## Documentación

1. [Stack y arquitectura](docs/01-stack-y-arquitectura.md) — incluye simplificaciones para el MVP
2. [Modelo de datos](docs/02-modelo-de-datos.md)
3. [API](docs/03-api.md)
4. [Backlog de user stories](docs/04-backlog.md)
5. [Flujo de desarrollo e integración](docs/05-flujo-de-desarrollo.md)
6. [Equipo y proyecto](docs/06-equipo-y-proyecto.md)
