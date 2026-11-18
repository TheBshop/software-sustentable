# 11. Clasificación de residuos y certificado verde

## Clasificador (`modules/normativa/clasificador.js`)

Clasifica un residuo a partir de cinco datos:
- dónde se genera;
- qué es;
- su corriente Y;
- sus características H;
- y, si es industrial, su nivel de riesgo.

Devuelve la clasificación en los tres niveles jurídicos:

| Nivel | Criterio | Categorías |
|---|---|---|
| Nacional | Origen y peligrosidad | Domiciliarios y asimilables (Ley 25.916) · Industriales de riesgo bajo, medio y alto (Ley 25.612, art. 7) · Peligrosos con corrientes Y y características H (Ley 24.051, Anexos I y II) · Patogénicos (art. 19) · Fitosanitarios Tipo A y B (Ley 27.279) · PCB (Ley 25.670) · Radiactivos (Ley 25.018) · Buques (MARPOL) |
| Provincial | Nombre de la categoría en cada provincia | Buenos Aires: residuos especiales (Ley 11.720) e industriales no especiales (Res. 137/13 y 317/20) · CABA: peligrosos (Ley 2.214), patogénicos Tipo A y B (Ley 154) y áridos (Ley 4.859) · Entre Ríos y Santa Fe: decretos 4.977/09 y 1.844/02 · Córdoba: Ley 8.973 · REGU |
| Municipal | Separación en origen y servicio | Seco, húmedo o rechazo · Domiciliario común o gran generador · Poda, voluminosos, áridos y puntos limpios |

Además informa:
- la operación del Anexo III (R con recuperación, D sin recuperación; códigos del Convenio de Basilea);
- la gestión y los documentos que lleva;
- si corresponde certificado verde;
- si lo puede recibir la organización del usuario: cooperativa, empresa recicladora, municipio o generador del portal.

Se usa desde **Clasificar residuos**, en el panel y en el portal (`/api/clasificador` y `/api/v1/portal/clasificador`).

## Certificado verde (`modules/certificates/certificado-verde.js`)

El generador responde por su residuo hasta que se trata (Leyes 25.675, 25.612 y 24.051). El certificado corta esa responsabilidad solo si lo emite un operador habilitado y si tiene los 6 requisitos formales:

| Requisito | De dónde sale |
|---|---|
| 1. Partes: generador, operador y transportista, con razón social, CUIT válido (dígito verificador) y domicilio | Cliente y domicilio del retiro · Organización (`domicilio`, `cuit`) · Transporte propio o de terceros (`certificadoVerde.transporte`) |
| 2. Habilitaciones: INAES (cooperativas), habilitación municipal, aptitud ambiental, registro provincial | `certificadoVerde` de la organización, en **Configuración** |
| 3. Traslado: remito, carta de porte o manifiesto | `traslado` del retiro (se carga al pesar). Sin él, el número del retiro. Buenos Aires exige el manifiesto digital |
| 4. Detalle gravimétrico: fecha, corriente y kg netos en báscula calibrada | Peso de balanza de cada material y vencimiento de la calibración (`basculaVence`) |
| 5. Destino y proceso: tratamiento, operación R/D, reinserción y balance de masa (recibido = recuperado + rechazo) | Tratamiento de cada material y procesos de la planta |
| 6. Firma: representante legal y, en empresas recicladoras, responsable técnico matriculado | `certificado.responsable` y `certificadoVerde.responsableTecnico` |

Cuando se emite, el certificado guarda una copia de todos esos datos y su `validez` (`completo`, `documento`, `faltan`):
- **Si cumple todo,** el PDF sale con el nombre que corresponde a la jurisdicción. Buenos Aires: Certificado de Destino Sustentable. CABA: Constancia de recepción y tratamiento. Entre Ríos, Santa Fe y Córdoba: Certificado de valorización.
- **Si falta algo,** sale como "Constancia de recepción de residuos", con la lista de lo que falta, para que no se use como certificado verde.

`GET /api/certificados/requisitos` muestra lo que le falta a la organización.

**Límites:**
- No reemplaza la inscripción en los registros ni el manifiesto oficial. Para peligrosos, patogénicos, PCB, radiactivos y fitosanitarios, el clasificador indica su régimen y no corresponde certificado verde.
- Algunas normas provinciales se tomaron de la información relevada y faltan confirmar con cada autoridad: Res. OPDS 44/21 y 269/19, Decretos 4.977/09 y 1.844/02, Leyes 11.720, 8.973, 2.214, 154 y 4.859.
