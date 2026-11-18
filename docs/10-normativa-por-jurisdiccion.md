# 10. Normativa por jurisdicción y prototipos a medida

Investigado en noviembre de 2026 para armar un prototipo por cada organización relevada. Los datos que usa el sistema están en `apps/api/src/modules/normativa/jurisdicciones.js`; cada organización los ve en **Marco normativo**.

> **Cómo leerlo:** "verificada" quiere decir que se contrastó con el texto oficial o con un organismo público. "A verificar" quiere decir que surge de prensa o de compilaciones. Antes de usar una norma frente a un cliente o una autoridad, hay que confirmar el texto vigente.

## Nación (aplica en todo el país)

Ley 25.675 (ambiente) · Ley 25.916 y Decreto 779/2022 (RSU) · Ley 25.612 (industriales) · Ley 24.051 (peligrosos, vigente) · Res. 522/2016 y 189/2019 (REGU) · Ley 27.279 (envases de fitosanitarios).

## Provincias

| Jurisdicción | Ley principal de RSU | Grandes generadores | Otras normas |
|---|---|---|---|
| CABA | Ley 1.854 "Basura Cero" (consolidada por Ley 6.347) | Generadores especiales: Ley 4.859, Decreto 128/2014, Res. 83/2014, 454/2021 y 47/2020. Registro, separación y plan anual | — |
| Buenos Aires | Ley 13.592 | Ley 14.273; Res. OPDS 317/2020 (más de 1.000 kg por mes; plan de gestión integral e inclusiva), mod. 331/2023; Res. 139/2013 (industrias del AMBA) | Ley 14.321 (RAEE). San Nicolás: Ord. 10.318/2021 (medianos generadores) |
| Córdoba | Ley 9.088 | Córdoba Capital: Ord. 12.648 (mod. 13.228): 200 kg o 0,4 m³ diarios; registro y certificado del IPA renovable cada 5 años | Ley 7.343 |
| Santa Fe | Ley 13.055 "Basura Cero" | Rosario: Ord. 7.007/2003, 7.600/2003 y 9.463/2015; meta de separación en tres fracciones para 2030 | Ley 13.940 (RAEE); Rosario: Ord. 8.335 |
| Entre Ríos | Ley 10.311 | Paraná: Ord. 9.233 remite a normativa específica | Ver doc. 08 |
| La Pampa | Sin ley GIRSU provincial encontrada: competencia municipal | — | Proyecto provincial en trámite |
| Mendoza | Ley 9.659 GIRSU (2025, reglamentada en 2026; deroga la 5.970) | Más de 50 kg diarios | Registros provinciales de transportistas y de centros de economía circular |
| San Juan | Ley 8.238 / 1114-L (a confirmar cuál rige) | — | Parque de Tecnologías Ambientales |
| San Luis | Ley IX-0873-2013 | — | Ley IX-0335-2004 (peligrosos) |
| Tucumán | Ley 8.177 (consorcio metropolitano) | — | — |
| Salta | Ley 7.070 (ambiente) y Decreto 1.365/2010 (Plan GIRSU) | — | — |
| Corrientes | Ley 6.422 (adhiere a la 25.916) | — | — |
| Chaco | Ley 7.034 y Decreto 2.417/2012 | — | — |
| Misiones | Ley XVI N° 89 | — | Ley XVI N° 133 (RAEE y neumáticos) |
| Jujuy | Ley 5.954 (GIRSU Jujuy S.E.) | — | Tasa GIRSU |
| Neuquén | Ley 2.648 (adhesión a la 25.916) | — | Sin ley RAEE provincial encontrada |
| Chubut | Ley XI N° 50 y Decreto 49/2015 | — | — |
| Río Negro | Ley 5.491 | — | Consorcios regionales |

## Prototipos

El listado de las 33 organizaciones, con lo que recibe cada una, está en `apps/api/src/demo/entidades.js`.

- **Contactos:** no se guardan en el código, porque el repositorio es público.
- **Corrientes habilitadas:** son una suposición hecha a partir de lo que reciben. Hay que confirmarlas con cada organización.
- **Filas con dos organizaciones:** el prototipo se arma para la primera y la segunda queda anotada.
- **Paraná:** Nueva Vida ya es el sistema base; para Paraná se agregó Quanta.

```bash
npm run dev:demo                         # API en memoria con los 33 prototipos; elegir en http://localhost:5173/demo
npm run crear-prototipo -- --lista       # slugs disponibles
npm run crear-prototipo -- promapla      # crea uno en la base real, con contraseña al azar
npm run crear-prototipo -- promapla --vacio   # sin datos de ejemplo, para cargar los reales
```

**Modo demostración:** con `DEMO_MODE=true` o `--demo` se puede entrar a cualquier prototipo sin contraseña. Está bloqueado con `NODE_ENV=production` y nunca debe usarse con datos reales.

## Pendientes por organización

- **Datos de cada organización:** pesar los fardos y bolsones propios, cargar la fuente de los factores de CO₂ y confirmar las inscripciones.
- **Pedidos específicos que surgen del relevamiento:**
  - Creando Conciencia: producción de madera plástica (kg de plástico → piezas).
  - Cooperativa REN: certificado de destrucción de datos para RAEE.
  - Clear Urbana: iglúes como sedes de un cliente municipal.
  - C.R.E.A.R.: si recibe envases de fitosanitarios, son una corriente separada (Ley 27.279).
