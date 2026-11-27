// Factores de huella ambiental por tipo de material reciclado.
// CO₂: kg de CO₂ evitado por kg de material reciclado vs producción virgen.
// Agua: litros de agua evitados por kg de material reciclado vs producción virgen.
// Fuentes: EPA WARM Model, Water Footprint Network, CEAMSE datos Argentina.

export const FACTORES_HUELLA = {
  plastico_pet:   { co2: 1.7,  agua: 170,  label: 'Plástico PET' },
  plastico_hdpe:  { co2: 1.5,  agua: 150,  label: 'Plástico HDPE' },
  plastico_blando:{ co2: 1.3,  agua: 130,  label: 'Plástico blando' },
  carton:         { co2: 0.9,  agua: 450,  label: 'Cartón' },
  papel:          { co2: 0.9,  agua: 400,  label: 'Papel' },
  vidrio:         { co2: 0.3,  agua: 30,   label: 'Vidrio' },
  metal:          { co2: 2.0,  agua: 200,  label: 'Metal' },
  cobre:          { co2: 4.5,  agua: 350,  label: 'Cobre' },
  aluminio:       { co2: 9.0,  agua: 500,  label: 'Aluminio' },
  film:           { co2: 1.1,  agua: 110,  label: 'Film' },
  stritch:        { co2: 1.0,  agua: 100,  label: 'Stritch' },
  textil:         { co2: 5.0,  agua: 2700, label: 'Textil' },
  electronico:    { co2: 3.0,  agua: 300,  label: 'Electrónico (RAEE)' },
  organico:       { co2: 0.4,  agua: 50,   label: 'Orgánico / compost' },
};

export const TIPOS_MATERIAL = Object.keys(FACTORES_HUELLA);

export function calcularHuella(materiales) {
  let co2Total = 0;
  let aguaTotal = 0;
  const detalle = [];

  for (const { tipo, pesoKg } of materiales) {
    const factor = FACTORES_HUELLA[tipo];
    if (!factor || !pesoKg || pesoKg <= 0) continue;
    const co2 = factor.co2 * pesoKg;
    const agua = factor.agua * pesoKg;
    co2Total += co2;
    aguaTotal += agua;
    detalle.push({ tipo, label: factor.label, pesoKg, co2EvitadoKg: round(co2), aguaEvitadaL: round(agua) });
  }

  return {
    co2EvitadoKg: round(co2Total),
    aguaEvitadaL: round(aguaTotal),
    detalle,
  };
}

function round(n) { return Math.round(n * 100) / 100; }
