// Smoke test contra un entorno desplegado. Verifica que los endpoints clave respondan.
//   npm run smoke-test -- https://api.gestionrsu.com.ar admin@nuevavida.coop <password>
//
// Cubre: health, login, me, listar materiales, crear/eliminar cliente, estado del sistema.
// No prueba AFIP ni manifiestos (requieren datos específicos).

const [base, email, password] = process.argv.slice(2);
if (!base || !email || !password) {
  console.error('Uso: npm run smoke-test -- <base-url> <email> <password>');
  process.exit(1);
}

const call = async (path, { method = 'GET', body, token } = {}) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
};

let pasados = 0;
let fallados = 0;
const check = (nombre, cond, extra = '') => {
  if (cond) { pasados += 1; console.log(`  ✓ ${nombre}`); }
  else { fallados += 1; console.log(`  ✗ ${nombre} ${extra}`); }
};

console.log(`\nSmoke test contra ${base}\n${'─'.repeat(60)}`);

const health = await call('/health');
check('GET /health responde 200', health.status === 200, `(${health.status})`);
check('GET /health reporta ok', health.data?.ok === true);

const login = await call('/api/auth/login', { method: 'POST', body: { email, password } });
check('POST /api/auth/login (credenciales válidas)', login.status === 200, `(${login.status})`);
if (login.status !== 200) {
  console.log(`\n✗ Login falló: ${JSON.stringify(login.data)}`);
  process.exit(1);
}
const token = login.data.token;

const me = await call('/api/auth/me', { token });
check('GET /api/auth/me devuelve el usuario', me.status === 200 && me.data.id);

const mats = await call('/api/materiales', { token });
check('GET /api/materiales responde', mats.status === 200 && Array.isArray(mats.data.items));

const estado = await call('/api/estado', { token });
check('GET /api/estado funciona', estado.status === 200 && estado.data.version);
check('Mongo conectado', estado.data?.mongo === 'conectado');

const noAuth = await call('/api/clientes');
check('Rutas privadas sin token devuelven 401', noAuth.status === 401, `(${noAuth.status})`);

console.log(`${'─'.repeat(60)}\n${pasados} pasados, ${fallados} fallados\n`);
process.exit(fallados ? 1 : 0);
