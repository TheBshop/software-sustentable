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

### Prioridades de la cooperativa

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `POST /api/retiros`, `POST /api/ingresos` | — | Cada ítem acepta `pesoEstimadoKg`/`pesoKg` **o** `cantidad` + `unidad` (por ejemplo `{cantidad: 3, unidad: "fardo"}`). Una unidad no configurada devuelve 422. |
| `POST /api/planta/clasificacion` | operador | `{desde, items:[{material, kg}], rechazoKg, causa}`. Clasifica lo recibido mezclado. |
| `POST /api/planta/rechazos` | operador | Suma `causa`, `cliente` (el generador) y `origenTipo`. |
| `GET /api/planta/calidad?desde&hasta` | — | Rechazo por origen o generador, con causas y recuperación de lo mezclado. |
| `POST /api/ventas` | administración | La respuesta incluye `avisos` si algún precio quedó debajo de la referencia de mercado. |
| `GET /api/ventas/resumen` | — | Precio promedio por comprador y material, y cuántas ventas quedaron debajo del mercado. |
| `GET/POST/DELETE /api/gastos` | administración | Gastos de la cooperativa. |
| `GET /api/balance?mes=AAAA-MM` y `/api/balance/csv` | administración | Balance mensual; el CSV usa `;` y coma decimal, y abre directo en Excel. |
| `PATCH /api/planta/organizacion` | admin | `{responsable, cargo}` de los certificados. |
| `POST /api/planta/organizacion/firma` y `/sello` | admin | Imagen PNG o JPG de hasta 2 MB (campo `imagen`). |
| `GET /api/v1/portal/resumen` | portal | Suma `separacion { ingresadoKg, rechazadoKg, tasaCorrecta, causas }`. |

### Ordenanza 9233 y herramientas de Manglai

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `PUT /api/planta/organizacion/registros` | admin | Inscripciones de la cooperativa (`descripcion`, `organismo`, `numero`, `vence`). Las vigentes se imprimen en el certificado. |
| `GET/POST/PATCH/DELETE /api/seguridad` y `GET /api/seguridad/resumen` | administración | Entregas de EPP y capacitaciones; el resumen marca a quién hay que renovar (EPP 180 días, capacitación 365). |
| `POST /api/retiros/:id/documentos` | chofer, planta, administración | Multipart: `tipo` (remito, ticket_pesaje, factura, manifiesto, otro), `numero` y `archivo` (PDF, JPG o PNG, 5 MB). |
| `GET` y `DELETE /api/retiros/:id/documentos/:docId` | — / planta | Descarga con sesión o baja del documento. |
| `GET /api/v1/portal/retiros/:id/documentos/:docId` | portal | El cliente descarga los documentos de sus retiros. |
| `GET /api/v1/portal/resumen` | portal | Suma `recomendaciones`, `porMaterial[].factores` (factor y fuente por cooperativa) e `inclusion` (solo municipios). |

### Ley 25.612

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /api/planta/movimientos/csv?desde&hasta` | administración, planta | Libro de movimientos del período (registro de operaciones, art. 34). |
| `GET /api/clientes/:id/constancia-reciclado.pdf?anio=` | administración | Constancia anual de reciclado firmada por la cooperativa. |
| `GET /api/v1/portal/constancias?anio=` y `/constancias/:cliente.pdf` | portal | Una constancia por cada cooperativa que atiende a la organización. |

Los materiales suman `tratamiento`: `reciclado`, `reuso`, `compostaje` o `disposicion_final`. Si no se indica, se completa solo.

### Productividad de la planta

Son los indicadores de la *Guía de productividad para plantas de valorización de residuos*, agrupados en procesamiento, personal y comercialización.

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /api/productividad?mes=AAAA-MM` | administración, planta | Devuelve:<br>• los datos del mes: t ingresadas, separadas, rechazadas y vendidas, facturación, tipos de material, horas de parada y accidentes;<br>• el índice de productividad (t vendidas por persona);<br>• los 11 indicadores, con su fórmula y qué dato falta;<br>• la evolución de los últimos 6 meses. |
| `PATCH /api/productividad/planta` | admin | Capacidad instalada (t/mes) y horas trabajables por mes. |
| `PUT /api/productividad/personal/:mes` | administración | Resumen del personal del mes: personas, formalizadas, días trabajados y perdidos, bajas, ingreso promedio y SMVM. |
| `GET/POST/DELETE /api/productividad/paradas` | administración, planta | Paradas de máquina con su causa. |

Los accidentes se registran en `POST /api/seguridad` con `tipo: "accidente"`, `diasPerdidos` y `observaciones`.

**"Separado y acopiado"** suma dos cosas:
- lo que ingresa ya separado por material, sin contar la mezcla ni el rechazo;
- lo que sale de clasificar la mezcla.

### Logística de retiros y recuperadores

Funciones tomadas del análisis de Rubicon, Routeware, Sensoneo, Enevo, Recy y Reaquila. No usan sensores ni servicios de mapas.

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `POST /api/v1/portal/solicitudes` y `GET` | portal | El cliente pide un retiro (`cliente` es uno de sus servicios: `GET /api/v1/portal/organizacion` → `servicios`) y sigue sus pedidos. `POST .../:id/cancelar` lo cancela. |
| `GET/POST /api/solicitudes`, `PATCH /api/solicitudes/:id` | administración, planta | Bandeja de pedidos: programar con fecha y chofer, rechazar o cancelar. `GET /api/solicitudes/choferes` lista los choferes. |
| `POST /api/solicitudes/:id/no-realizado` | chofer | Visita fallida con `motivo` (cerrado, sin_material, material_mezclado, acceso_bloqueado, falta_tiempo, otro), `detalle` y `foto` opcional. |
| `POST /api/retiros` con `solicitud` | chofer | El retiro cierra el pedido. Se rechaza si el pedido es de otro cliente o fue cancelado. |
| `GET /api/hoja-de-ruta?fecha=` | todos | Paradas del día en orden por cercanía, desde la ubicación de la planta o desde la primera parada. Usa la última ubicación GPS de los retiros de cada cliente; las paradas sin ubicación van al final. |
| `GET /api/solicitudes/sugeridos` | administración, planta | Frecuencia sugerida por cliente (3 o más retiros en 120 días): kg por retiro, intervalo, próximo retiro y estado. |
| `GET /api/logistica?mes=` | administración, planta | Retiros por día, kg por retiro, combustible por tonelada, pedidos cumplidos con los motivos de las visitas fallidas, y datos por chofer. |
| `PATCH /api/logistica/configuracion` | admin | `kgObjetivoRetiro` y `ubicacion` de la planta. |
| `GET/POST/PATCH /api/recuperadores`, `GET /api/recuperadores/resumen?mes=` | administración, planta | Registro de recuperadores y lo comprado a cada uno en el mes. |
| `GET/POST /api/compras`, `PATCH /api/compras/:id`, `GET /api/compras/:id/recibo.pdf` | administración, planta | Compra de material:<br>• entra al stock como ingreso de recuperador;<br>• acepta kg o unidades (fardos, bolsones);<br>• cuando se paga, va al balance como egreso;<br>• sale con un recibo numerado. |

### Clasificador y certificado verde (ver doc 11)

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /api/clasificador/catalogo` y `POST /api/clasificador` | cooperativa | Clasifica un residuo en los tres niveles: `{origen, cat, h[], y, riesgo, provincia?}`. |
| `GET /api/v1/portal/clasificador/catalogo` y `POST` | portal | Lo mismo para municipios y empresas generadoras. |
| `PATCH /api/planta/organizacion/certificado-verde` | admin | Domicilio, INAES, habilitación municipal, aptitud ambiental, registro provincial, calibración de la báscula, transporte, responsable técnico y procesos. |
| `GET /api/certificados/requisitos` | cooperativa | Lo que le falta a la organización para que sus certificados sean válidos. |
| `PATCH /api/retiros/:id` con `traslado` | planta | `{tipo: remito, carta_porte o manifiesto, numero}`, el documento del traslado. |

Los certificados devuelven:
- `validez` (`completo`, `documento`, `faltan`);
- `transportistaSnapshot`, `traslado`, `recepcion`, `balance`, `procesos`;
- la `operacion` R o D de cada material.
