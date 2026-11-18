// Residuos que gestiona cada organización y configuración inicial por perfil.
// Generado desde la página (nueva-vida-propuesta.html). Fuente única de estos datos para la API y la web.


export const RESIDUOS = { secos: 'Secos reciclables', organicos: 'Orgánicos', raee: 'RAEE', avu: 'Aceite vegetal usado', nfu: 'Neumáticos', obra: 'Poda, voluminosos y áridos', industriales: 'Industriales no peligrosos' };

export const RES_CATS = { secos: ['seco'], organicos: ['humedo', 'poda'], raee: ['raee'], avu: ['avu'], nfu: ['nfu'], obra: ['arido', 'poda', 'voluminoso'], industriales: ['industrial'] };

export const CONFIG_DEF = {
  cooperativa: { residuos: ['secos'], trat: ['plasticos', 'papel', 'metales'] },
  empresa: { residuos: ['secos', 'industriales'], trat: ['plasticos'] },
  municipio: { residuos: ['secos', 'organicos', 'obra'], trat: ['compostaje', 'relleno', 'aridos'] },
};
