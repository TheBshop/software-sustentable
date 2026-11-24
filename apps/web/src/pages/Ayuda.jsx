// Ayuda en línea: tutoriales cortos por sección y contacto de soporte.
const SOPORTE_WPP = '5493435254141'; // TODO: reemplazar con el número real de soporte

const TUTORIALES = [
  { titulo: 'Primeros pasos', pasos: [
    'Completá los datos fiscales de tu organización (CUIT, domicilio, condición IVA).',
    'Dar de alta al menos 1 cliente y los materiales que recibís.',
    'Cargar el primer retiro desde "Operación → Retiros".',
    'Confirmar peso en planta desde "Operación → Ingresos".',
  ] },
  { titulo: 'Retiros y hoja de ruta', pasos: [
    'En "Operación → Agenda" armás la hoja de ruta de cada chofer por día.',
    'El chofer entra con su usuario desde el celular y marca cada retiro como "realizado" o "no pudo".',
    'Al volver a planta, se confirma el peso real de lo que entró.',
  ] },
  { titulo: 'Facturación', pasos: [
    'En "Comercial → Presupuestos" podés mandar una cotización previa; cuando el cliente acepta, la convertís en factura con un clic.',
    'En "Comercial → Facturación" armás la factura mensual sumando los retiros del período.',
    'Si usás ARCA (en pilotos arranca en modo simulado), el CAE y el QR se agregan cuando conectás tu certificado.',
  ] },
  { titulo: 'Manifiestos de traslado', pasos: [
    'Antes de llevar material a otro operador, generá un manifiesto en "Operación → Manifiestos".',
    'El PDF tiene un QR. Cuando llega al destino, escanean el QR y firman en el celular.',
    'La firma, GPS e IP quedan registrados: eso te sirve para la trazabilidad por Ley 25.612.',
  ] },
  { titulo: 'Reporte mensual (SNIGEI)', pasos: [
    'En "Cumplimiento → Reporte SNIGEI" elegís el mes.',
    'Te suma automáticamente los ingresos por corriente, fracción, tratamiento y categoría.',
    'Descargás un Excel con el detalle para presentarlo al municipio o al organismo nacional.',
  ] },
  { titulo: 'Exportar tus datos', pasos: [
    'En "Administración → Mi organización" tenés un botón "Descargar todos mis datos".',
    'Baja un ZIP con CSVs de clientes, materiales, retiros, ingresos, ventas y facturas.',
    'Tus datos son tuyos. Podés irte con ellos cuando quieras.',
  ] },
];

export default function Ayuda() {
  return (
    <div className="pant pant-ancha">
      <h1>Ayuda</h1>
      <p className="ayuda-pant">Guías rápidas para las tareas más comunes. Si algo no te cierra, escribinos: estamos en piloto y queremos que funcione para vos.</p>

      <div className="tarjeta" style={{ background: '#f0fdfa', borderLeft: '4px solid #0f766e' }}>
        <h3 style={{ margin: 0 }}>Soporte directo</h3>
        <p>Mandanos WhatsApp a <a href={`https://wa.me/${SOPORTE_WPP}`} target="_blank" rel="noreferrer"><strong>+54 9 343 555-1234</strong></a>. Respondemos en el día (hábil).</p>
        <p className="ayuda">Durante el piloto: si rompe algo, no pierdas tiempo. Avisanos y lo resolvemos.</p>
      </div>

      {TUTORIALES.map((t) => (
        <div key={t.titulo} className="tarjeta" style={{ marginTop: 12 }}>
          <h3>{t.titulo}</h3>
          <ol>{t.pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>
        </div>
      ))}
    </div>
  );
}
