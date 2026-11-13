# 4. Backlog de user stories

Sprints de **2 semanas**. Estimación en puntos (1 = trivial, 8 = grande). Velocidad esperada de un equipo de 2–3 devs part-time: **15–20 pts/sprint**.
Lo marcado ✅ ya está implementado (al menos a nivel API) en este repo inicial.

Personas: **Chofer** (hace los retiros), **Planta** (recibe y pesa), **Administración** (clientes, facturación, cobranza), **Generador** (cliente que entrega residuos), **Coordinación** (la comisión directiva de la cooperativa).

---

## Sprint 0 — Puesta en marcha (1 semana)
| # | Historia | Pts |
|---|---|---|
| S0-1 | Como equipo, quiero el repo, CI y entornos (Atlas, Render, Netlify) para poder deployar desde el día 1. ✅ repo/CI | 3 |
| S0-2 | Como equipo, quiero relevar en la planta **un día de trabajo real** (acompañar un recorrido, ver la balanza, ver cómo facturan hoy) para validar el modelo de datos. | 2 |
| S0-3 | Como coordinación, quiero cargar la lista real de materiales, clientes y tarifas (desde Excel) para arrancar con datos verdaderos. ✅ importador + plantilla | 3 |

## Sprint 1 — Registro de retiros (objetivo: los choferes dejan el papel)
| # | Historia | Criterios de aceptación | Pts |
|---|---|---|---|
| 1.1 | Como **chofer**, quiero iniciar sesión en la app una vez y que me recuerde. | Token guardado; expira a los 30 días. | 2 |
| 1.2 | Como **chofer**, quiero registrar un retiro eligiendo cliente, materiales y kg estimados. ✅ API · ✅ pantalla | < 30 seg por retiro; busca cliente por nombre. | 5 |
| 1.3 | Como **chofer**, quiero registrar retiros **sin señal** y que se envíen solos al volver la conexión. ✅ | Indicador "N sin enviar"; no duplica al reintentar. | 5 |
| 1.4 | Como **chofer**, quiero sacar fotos del material. ✅ API · ✅ pantalla | Hasta 6 fotos comprimidas. | 3 |
| 1.5 | Como **chofer**, quiero ver mis retiros del día para saber qué me falta. | Lista por fecha con estado de sincronización. | 3 |
| 1.6 | Como **administración**, quiero el ABM de clientes en la web. ✅ | Alta, edición, baja lógica, búsqueda, validación de CUIT. | 3 |

## Sprint 2 — Planta y certificados (objetivo: primer certificado real a un cliente piloto)
| # | Historia | Pts |
|---|---|---|
| 2.1 | Como **planta**, quiero ver los retiros que llegan y cargar el peso real de balanza. ✅ | 5 |
| 2.2 | Como **planta**, quiero registrar ingresos que no vienen de retiros (recuperadores, entregas voluntarias). ✅ | 3 |
| 2.3 | Como **administración**, quiero emitir el certificado PDF con QR de un retiro. ✅ | 3 |
| 2.4 | Como **generador**, quiero escanear el QR y ver que el certificado es auténtico. ✅ | 2 |
| 2.5 | Como **administración**, quiero enviar el certificado por email o WhatsApp con un clic. ✅ | 3 |
| 2.6 | Como **coordinación**, quiero que los factores de CO2 tengan fuente citada y aparezca en el PDF. | 2 |
| 2.7 | Como **administración**, quiero el ABM de materiales con tarifas. ✅ | 2 |

## Sprint 3 — Facturación y cobranza (objetivo: liquidar el primer mes)
| # | Historia | Pts |
|---|---|---|
| 3.1 | Como **administración**, quiero configurar la tarifa de cada cliente (por retiro, por kg, abono). ✅ API | 3 |
| 3.2 | Como **administración**, quiero ver una vista previa de lo que le corresponde facturar a un cliente en un período y confirmarla. ✅ | 5 |
| 3.3 | Como **administración**, quiero registrar pagos (parciales o totales). ✅ | 2 |
| 3.4 | Como **administración**, quiero ver alertas de facturas vencidas y por vencer en el inicio. ✅ | 3 |
| 3.5 | Como **administración**, quiero un mail automático semanal con el resumen de cobros pendientes. | 3 |
| 3.6 | Como **administración**, quiero cargar el número y CAE de la factura fiscal emitida para cada liquidación. ✅ | 2 |

## Sprint 4 — Ventas, dashboard y contratos
| # | Historia | Pts |
|---|---|---|
| 4.1 | Como **administración**, quiero registrar ventas de material a compradores. ✅ | 3 |
| 4.2 | Como **coordinación**, quiero un dashboard con kg por material, por cliente y ventas del mes. ✅ | 3 |
| 4.3 | Como **coordinación**, quiero filtrar el dashboard por fechas y exportar a Excel. | 3 |
| 4.4 | Como **administración**, quiero generar el contrato de un gran generador en PDF a partir del template y sus datos. | 5 |
| 4.5 | Como **administración**, quiero ver qué contratos vencen en los próximos 60 días. | 2 |

## Backlog futuro (priorizar con la cooperativa)
- Portal del generador: ver sus retiros, certificados y facturas con su propio usuario.
- Certificado mensual consolidado por cliente (muchos grandes generadores lo prefieren al certificado por retiro).
- Integración con proveedor de factura electrónica (ARCA).
- WhatsApp Business API para envíos automáticos.
- Planificación de recorridos (rutas del día por chofer).
- Stock de planta (ingresos − ventas por material).
- Reporte de impacto anual para el municipio / informes de RSE de los clientes.
- Publicación en Play Store.

## Definition of Done
- Código revisado por otra persona (PR aprobado).
- Tests de API para la regla de negocio nueva; CI en verde.
- Deployado en **staging** y probado por alguien de la cooperativa.
- Documentación del endpoint actualizada en `docs/03-api.md`.
