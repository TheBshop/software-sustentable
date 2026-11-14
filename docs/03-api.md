# 3. API — endpoints implementados

Base: `/api`. Todo requiere `Authorization: Bearer <token>` salvo lo marcado como **público**.

| Método | Ruta | Rol para escribir | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público | `{email, password}` → `{token, user}` |
| GET | `/auth/me` | | usuario del token |
| GET/POST | `/usuarios` | admin | listar / crear usuarios |
| GET | `/clientes?q=&tipo=&page=&limit=` | | listado con búsqueda |
| GET/POST/PATCH/DELETE | `/clientes[/:id]` | administracion | ABM (DELETE = baja lógica) |
| GET/POST/PATCH/DELETE | `/materiales[/:id]` | administracion | ABM con factor CO2 y tarifas |
| GET | `/retiros?cliente=&estado=&desde=&hasta=` | | el chofer solo ve los suyos |
| POST | `/retiros` | chofer, planta, administracion | alta **idempotente** por `localId` |
| PATCH | `/retiros/:id` | planta, administracion | peso real, estado |
| POST | `/retiros/:id/fotos` | chofer, planta, administracion | multipart, campo `fotos` (hasta 6) |
| POST | `/retiros/:id/certificado` | planta, administracion | emite (o devuelve) el certificado |
| GET/POST/PATCH/DELETE | `/ingresos[/:id]` | planta, administracion | ingresos a planta |
| GET/POST/PATCH/DELETE | `/ventas[/:id]` | administracion | ventas de material |
| GET | `/certificados?cliente=` | | |
| GET | `/certificados/:id/pdf` | | PDF inline |
| POST | `/certificados/:id/enviar` | planta, administracion | `{canal: email\|whatsapp, destino}`; WhatsApp devuelve `{link}` wa.me |
| POST | `/certificados/:id/anular` | administracion | |
| GET | `/public/certificados/:codigo` | **público** | datos para la página de validación |
| GET | `/public/certificados/:codigo/pdf` | **público** | descarga del PDF |
| GET | `/facturas?cliente=&estado=` | administracion | |
| POST | `/facturas/preview` | administracion | `{cliente, desde, hasta}` → qué se facturaría |
| POST | `/facturas` | administracion | genera la liquidación y marca los retiros |
| POST | `/facturas/:id/pagos` | administracion | `{monto, fecha?, medio?, referencia?}` |
| PATCH | `/facturas/:id/comprobante` | administracion | `{tipo: A\|B\|C, puntoVenta, numero, cae?}` — factura fiscal emitida en ARCA |
| POST | `/facturas/:id/anular` | administracion | libera los retiros |
| GET | `/facturas/alertas?dias=7` | administracion | `{vencidas[], porVencer[], totalVencido, totalPorVencer}` |
| GET | `/dashboard?desde=&hasta=` | | KPIs, kg por material, kg por cliente, ventas |

## Ejemplos

```bash
# Login
curl -s localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@nuevavida.local","password":"admin1234"}'

# Registrar un retiro (lo que hace la app al sincronizar)
curl -s localhost:4000/api/retiros -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "localId": "7b0c1f3e-2a51-4b8a-9a43-0b4c3c6e1a11",
  "cliente": "<idCliente>",
  "items": [{"material": "<idCarton>", "pesoEstimadoKg": 120}]
}'

# Prefactura del mes
curl -s localhost:4000/api/facturas/preview -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"cliente":"<idCliente>","desde":"2026-11-01","hasta":"2026-11-30"}'
```

Fechas: una fecha sin hora (`"2026-11-13"`) se toma como la medianoche de ese día en hora de Argentina (UTC-3, configurable con `TZ_OFFSET`), y un `hasta` incluye el día completo.

Errores: siempre `{ "error": "mensaje", "details"?: [...] }` con 400 (validación), 401, 403, 404, 409 (duplicado/conflicto) o 422 (regla de negocio).

## Zonas de la API (multi-organización)

- `/api/auth/*` y `/api/public/*`: sin login.
- `/api/usuarios`: usuarios de la **propia** organización (admin de cooperativa o `cliente_admin`).
- `/api/*` (resto): **solo usuarios de cooperativas**. Cada consulta se filtra por la cooperativa del usuario. Un usuario de empresa o municipio recibe 403.
- `/api/v1/portal/*`: **solo empresas y municipios**. Solo lectura de sus datos, en todas las cooperativas que los atienden. Está versionada porque la pueden consumir terceros.

Todas las respuestas de `/api` llevan `Cache-Control: no-store`. El login devuelve `user.organizacion = { id, nombre, tipo }`; la web elige el panel o el portal según el tipo.

### Planta y trazabilidad
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/planta/organizacion` | | Datos y habilitaciones de la cooperativa |
| GET | `/planta/stock` | | Stock por material (Σ movimientos) |
| GET | `/planta/movimientos?material=&tipo=` | | Últimos 200 movimientos |
| POST | `/planta/rechazos` | planta, administracion | `{material, kg, motivo?}`: sale a disposición final |
| POST | `/planta/ajustes` | admin | `{material, kg (±), motivo}`: conteo físico |

Además, `/dashboard` devuelve `planta.indicadores = { ingresadoKg, valorizadoKg, dispuestoKg, tasaDesvio, tasaRechazo }`. Retiros, ingresos, ventas y materiales responden **422** si el material es de una corriente no habilitada. `DELETE` de ingresos y ventas responde **405**.

### Acceso al portal
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/clientes/:id/acceso-portal` | administracion | `{email, nombre, tipo: empresa\|municipio}`. Crea o vincula la organización por CUIT y un usuario `cliente_admin`. Devuelve la contraseña **una sola vez** |

### Portal (`/api/v1/portal`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/organizacion` | Nombre, cooperativas que lo atienden y sedes |
| GET | `/resumen?anio=` | Totales, por mes, material, fracción, cooperativa y sede |
| GET | `/retiros?anio=` | Historial con sede, fracción y estado |
| GET | `/certificados` y `/certificados/:id/pdf` | Solo los propios (404 si no) |
| GET | `/facturas` | Con saldo, vencimiento y detalle retiro por retiro |
| GET | `/informe-anual.pdf?anio=` | Informe de impacto en PDF |
