# 5. Flujo de desarrollo e integración

## Ramas: trunk-based simple

```
main ────●────●────●────●────●──── (siempre deployable → staging automático)
          \       /  \      /
  feat/12-alta-retiro  fix/30-cuit
```

- `main` es la única rama larga. Siempre funciona.
- Una rama corta por historia: `feat/<n°>-descripcion`, `fix/<n°>-descripcion`. Vive **1–3 días**.
- Nada se mergea sin Pull Request + CI en verde + 1 aprobación.
- **Producción** se libera con un tag (`v0.3.0`) al cerrar cada sprint, después de la demo con la cooperativa.

## Ciclo de una historia

1. **Tomar** la tarjeta del tablero (columna *Listo para hacer*) y moverla a *En curso*.
2. **Rama**: `git switch -c feat/12-alta-retiro`
3. **Desarrollo local**:
   ```bash
   npm run db:up     # Mongo en Docker
   npm run seed      # datos de prueba
   npm run dev:api   # http://localhost:4000
   npm run dev:web   # http://localhost:5173
   cd apps/mobile && npx expo start   # app en el teléfono con Expo Go
   ```
4. **Test primero en la regla de negocio** (services). Agregar casos al test de flujo si corresponde. `npm test`.
5. **Commits chicos** con mensaje claro: `feat(retiros): idempotencia por localId`.
6. **PR** con: qué cambia, cómo probarlo, captura de pantalla si es UI. Enlazar la historia.
7. **CI** (GitHub Actions): instala, corre tests de API contra MongoDB en memoria y buildea la web.
8. **Review** de otra persona (máx. 24 h). Comentarios → cambios → aprobación.
9. **Merge** (squash) → deploy automático a **staging** (Render y Netlify se conectan al repo y despliegan `main` solos).
10. **Validación** en staging por alguien de la cooperativa → tarjeta a *Hecho*.

## Entornos

| Entorno | API | Web | Base | Quién lo usa |
|---|---|---|---|---|
| Local | localhost:4000 | localhost:5173 | Docker | devs |
| Staging | `api-staging…` (Render) | deploy preview Netlify | Atlas cluster *staging* | devs + referentes de la coope |
| Producción | `api…` (Render) | dominio de la coope | Atlas cluster *prod* | todos |

- Las variables (`MONGO_URI`, `JWT_SECRET`, SMTP) se cargan en el panel del hosting, **nunca** en el repo.
- **Backups**: activar snapshots de Atlas (o un `mongodump` diario programado) antes de cargar datos reales.

## App móvil

- **Desarrollo**: Expo Go en el teléfono (escaneando el QR de `expo start`).
- **APK de prueba**: `eas build -p android --profile preview` → link de descarga para los choferes.
- **Correcciones rápidas** (solo JS): `eas update` → los teléfonos lo reciben al reabrir la app, sin reinstalar.
- Cambios nativos (nuevo permiso, nueva librería nativa) → nuevo APK.

## Calidad mínima acordada
- Validación de entrada con Zod en **todos** los endpoints que escriben.
- Toda regla de dinero (facturas, pagos) con test.
- Prettier con configuración por defecto; ESLint cuando el equipo crezca.
- Logs de errores: Sentry (plan gratuito) en API, web y app desde el primer deploy a producción.
