# 9. Mercado y diferenciales

> Las plataformas, sus fallas y las cifras de esta sección provienen de un resumen aportado por el equipo, basado en reseñas de usuarios (Capterra, G2) y sitios de los proveedores. **No fueron verificadas de forma independiente.**

## Plataformas de referencia

| Plataforma | Segmento | Punto fuerte |
|---|---|---|
| AMCS Platform | Grandes operadores, plantas y municipios (Norteamérica, Europa, Oceanía) | Solución integral en la nube |
| SAP EHS | Corporaciones industriales | Integrada al ERP de SAP |
| Evreka | Ciudades inteligentes | Sensores IoT y optimización de rutas |
| Routeware / TRUX | Recolección municipal en EE. UU. y Canadá | Despacho en tiempo real y computadoras a bordo |
| CurbWaste / Trash Flow | Transportistas medianos | Facilidad de uso |
| TEIMAS Zero | Generadores en Europa y Latinoamérica | Economía circular y trámites legales |

**Núcleo funcional común**: rutas, trazabilidad y documentación, control de contenedores, operación de planta con balanza, facturación con portal de clientes, y analítica ESG o ISO 14001.

## Fallas reportadas y respuesta de este producto

| Falla reportada | Respuesta | Estado |
|---|---|---|
| La app del chofer pierde datos sin señal | La app guarda primero en el teléfono y el envío no duplica retiros | ✅ Hecho, falta probarlo en la calle |
| Pensadas para leyes de EE. UU. o Europa | Modelo nativo con la Ley 25.916, el Decreto 779/22 y los REGU (ver [08-marco-normativo.md](08-marco-normativo.md)) | ✅ Hecho |
| Interfaces poco intuitivas | App de 3 pasos. Regla: cada función nueva se prueba con un chofer y un operario antes de mergear | En la Definition of Done |
| Costos ocultos | Importador Excel, informe anual y certificados incluidos. Código abierto. USD 0–15 por mes | ✅ Hecho |
| Facturas que hay que auditar a mano | Cada liquidación guarda el detalle retiro por retiro, visible para la cooperativa y el cliente | ✅ Hecho (falta el PDF de la liquidación) |
| Dependencia de sensores IoT | Sin hardware obligatorio | ✅ Por diseño |
| Módulos que no se integran | Monolito modular con un único modelo de datos | ✅ Por diseño |
| Demasiados clics | Acciones frecuentes en la misma fila | ✅ Se mantiene |

## Roadmap posterior (núcleo de mercado que falta)

Ordenado por valor para cooperativas argentinas. Ver historias en [04-backlog.md](04-backlog.md).

1. **Solicitud de retiro desde el portal**: el cliente la pide y aparece en la agenda.
2. **Agenda y orden de recorrido**: retiros programados por día y camión, con orden sugerido por cercanía.
3. **Contenedores y bolsones con QR**: inventario y escaneo desde la app.
4. **Balanza conectada**: lectura por USB o serie (Web Serial) para evitar errores de tipeo.
5. **Reportes ESG / ISO 14001**: amplían el informe anual con su metodología.
6. **Manifiesto electrónico**: solo si una cooperativa se habilita para peligrosos (Ley 24.051).
