// Extrae datos de un ticket/factura usando Claude Vision. Sin ANTHROPIC_API_KEY devuelve null
// para que la UI pida al usuario que cargue a mano.
import { env } from '../config/env.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

const SYSTEM = `Extraés datos de un ticket de carga de combustible argentino. Respondé SOLO JSON con esta forma:
{"fecha":"YYYY-MM-DD","tipoCombustible":"nafta|diesel|gnc","cantidad":<litros o m³>,"importe":<pesos>,"kmActual":<km opcional>,"observaciones":"<estación / dirección>"}
Si un campo no está claro, poné null. Nunca inventes.`;

export async function extraerDatosDeTicket(imagenBuffer, mimeType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { disponible: false, motivo: 'ANTHROPIC_API_KEY no configurada' };

  const base64 = imagenBuffer.toString('base64');
  const body = {
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: 'Extraé los datos de este ticket de combustible. Respondé solo con el JSON.' },
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
  // Remueve ```json ... ``` si viene envuelto
  const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let datos;
  try { datos = JSON.parse(limpio); }
  catch { throw new Error('No pude parsear la respuesta de IA'); }
  return { disponible: true, datos };
}
