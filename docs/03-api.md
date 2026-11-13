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
