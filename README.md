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

Requisitos: Node 20+, Docker (o un MongoDB accesible).

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:up        # MongoDB en Docker
npm run seed         # datos de ejemplo → admin@nuevavida.local / admin1234
npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:5173
npm test             # tests de la API (MongoDB en memoria, no necesita Docker)
```

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
