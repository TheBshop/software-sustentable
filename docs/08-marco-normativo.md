# 8. Marco normativo y cómo lo implementa el sistema

Relevamiento hecho en noviembre de 2026 sobre la normativa argentina de residuos, y su traducción a funciones del software. **No es asesoramiento legal**: antes de usar el sistema para cumplir obligaciones ante un organismo, validarlo con el asesor de la cooperativa y con la autoridad local.

## Normas nacionales

| Norma | Qué establece | Cómo lo implementa el sistema |
|---|---|---|
| [Ley 25.916](https://www.argentina.gob.ar/normativa/nacional/norma-98327/texto): presupuestos mínimos de gestión de residuos domiciliarios | Siete etapas: generación, disposición inicial, recolección, transferencia, transporte, tratamiento y disposición final. Jerarquía: prevención, reúso, valorización y disposición final. | Cada movimiento de planta registra su **etapa** (`movimientos.etapa`). El certificado indica el **destino** de cada material: valorización o disposición final. |
| [Decreto 779/2022](https://www.boletinoficial.gob.ar/detalleAviso/primera/276572/20221128) (reglamenta la ley anterior), Anexo I, art. 6 | Lineamientos de cuna a cuna, proximidad, responsabilidad extendida del productor (REP), ecodiseño, gradualidad, mejores técnicas y **trazabilidad**: "conocer stocks, flujos de generación, trayectos y cantidades valorizadas y dispuestas finalmente en forma desagregada por cada etapa". | **Libro de movimientos inmutable**, del que se calculan el stock por material y los kilos valorizados y dispuestos. El dashboard muestra la tasa de desvío de relleno sanitario. Las correcciones quedan como ajustes; nada se borra. |
| Decreto 779/2022, **Anexo II** | Código unificado de colores por fracción: secos valorizables, basura, orgánicos, plásticos, papel y cartón, vidrio y metales. | Campo `fraccion` en materiales, con nombre y color. Se ve en el certificado, el portal y el informe anual. ⚠ Están confirmados verde (secos), negro (basura), marrón (orgánicos) y gris (metales). **Falta confirmar con el texto oficial** el amarillo de plásticos, el azul de papel y cartón y el blanco de vidrio, antes de imprimir etiquetas o contenedores. |
| [Res. 522/2016](https://www.argentina.gob.ar/normativa/nacional/268583/texto) y [Res. 189/2019](https://www.argentina.gob.ar/normativa/nacional/323372/texto): residuos especiales de generación universal (REGU) | Pilas, RAEE, neumáticos, aceite vegetal usado, lámparas, entre otros. Requieren sistemas de gestión propios. | Corriente `regu` con su tipo (`subtipoRegu`). Una cooperativa solo los gestiona si está **habilitada** para esa corriente. |
| [Ley 24.051](https://www.argentina.gob.ar/normativa/nacional/450/texto): residuos peligrosos | Registro de generadores, transportistas y operadores. **Manifiesto** por cada traslado. | Corriente `peligroso`, **bloqueada** salvo habilitación explícita. Las habilitaciones guardan el número de inscripción y su vencimiento. El manifiesto electrónico queda en el backlog. |
| Ley 25.612 (industriales) y [Ley 27.279](https://www.argentina.gob.ar/agricultura/envases) (envases de fitosanitarios) | Corrientes con régimen propio. | Se pueden representar (`industrial` y `fitosanitario`), pero no se gestionan en el MVP. |
| Ley de envases con responsabilidad extendida del productor | **Sin sancionar.** El proyecto de 2021 perdió estado parlamentario. | El modelo de organizaciones admite sumar un tipo "productor" si la ley se aprueba. |
| [ENGIRSU](https://www.argentina.gob.ar/node/161297): Estrategia Nacional de Gestión Integral de RSU | Estrategia federal, en actualización con COFEMA. | Los indicadores (kilos valorizados, dispuestos y desvío) se pueden exportar para informes municipales y provinciales. |

## Entre Ríos y Paraná

- **[Ley provincial 10.311](https://faolex.fao.org/docs/pdf/arg162565.pdf)** (gestión integral de RSU, 2014): prioriza la reducción en origen y la clasificación domiciliaria.
- **Paraná**: existe el programa Ecovecinales de separación en origen. **No encontré una ordenanza que defina "gran generador"** ni sus obligaciones.

## Preguntas pendientes para la cooperativa y el municipio

1. ¿Hay una ordenanza en Paraná que obligue a los grandes generadores a contratar la gestión diferenciada? ¿Con qué umbral (kg por día) y qué informes exige?
2. ¿El municipio pide algún informe periódico a la cooperativa? ¿Con qué formato?
3. ¿La cooperativa tiene o tramita alguna inscripción provincial (por ejemplo, como operador de REGU)?
4. ¿Qué fuente usar para los factores de CO₂ de cada material? Se sugieren EPA WARM o DEFRA, citadas en el certificado.
5. Confirmar los colores de plásticos, papel y cartón y vidrio con el texto oficial del Anexo II del Decreto 779/2022.

## Referencias del sector

- **Tonelada Justa** (FACCyR y Fundación Avina): plataforma que certifica la trazabilidad de materiales reciclables de cooperativas. Puede ser una integración futura o una referencia de formato de datos.
- **RENATEP**: registro de trabajadores de la economía popular, que incluye recicladores. No está integrado.
