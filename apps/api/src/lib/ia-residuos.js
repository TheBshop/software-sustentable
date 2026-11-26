import { env } from '../config/env.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

const SYSTEM = `Sos un experto en gestión de residuos en Argentina. Analizás fotos de residuos y respondés SOLO JSON con esta forma:
{"items":[{"tipo":"<tipo de residuo>","material":"<material principal>","reciclable":<true|false>,"peligroso":<true|false>,"corriente":"<corriente de tratamiento sugerida>","cantidad_estimada":"<descripción aproximada: ej '3 bolsas', '~50 kg', '1 contenedor'>","estado":"<limpio|sucio|mezclado|contaminado>"}],"observaciones":"<observación general del sitio o la situación>","recomendacion":"<qué debería hacerse con estos residuos>"}
Identificá todos los residuos visibles en la imagen. Si no hay residuos visibles, respondé con items vacío y una observación. Nunca inventes residuos que no se ven.`;

export async function identificarResiduos(imagenBuffer, mimeType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { disponible: false, motivo: 'ANTHROPIC_API_KEY no configurada' };

  const base64 = imagenBuffer.toString('base64');
  const body = {
    model: MODEL,
    max_tokens: 1000,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: 'Identificá los residuos en esta foto. Respondé solo con el JSON.' },
      ],
    }],
  };

  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Claude API ${r.status}: ${txt.slice(0, 200)}`);
  }
  const data = await r.json();
  const texto = data?.content?.[0]?.text?.trim() || '';
  const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return { disponible: true, datos: JSON.parse(limpio) }; }
  catch { throw new Error('No pude parsear la respuesta de IA'); }
}
