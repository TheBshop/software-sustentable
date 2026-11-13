import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, fmtKg, publicPdfUrl } from '../api.js';

// Página PÚBLICA: es la que abre quien escanea el QR del certificado.
export default function VerificarCertificado() {
  const { codigo } = useParams();
  const [cert, setCert] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/public/certificados/${codigo}`).then(setCert).catch((e) => setError(e.message));
  }, [codigo]);

  return (
    <div className="center">
      <div className="card verify">
        <h2>♻ Cooperativa Nueva Vida</h2>
        {error && <p className="badge invalid">✗ {error}</p>}
        {!cert && !error && <p>Verificando…</p>}
        {cert && (
          <>
            <p className={`badge ${cert.valido ? 'valid' : 'invalid'}`}>
              {cert.valido ? '✓ Certificado auténtico' : '✗ Certificado anulado'}
            </p>
            <h3>Certificado de Disposición Sustentable N° {cert.numero}</h3>
            <p>
              <strong>{cert.generador.razonSocial}</strong>
              {cert.generador.cuit && ` · CUIT ${cert.generador.cuit}`}
              <br />
              Retiro del {new Date(cert.fechaRetiro).toLocaleDateString('es-AR')}
            </p>
            <div className="kpis">
              <div className="kpi"><span>Material recuperado</span><strong>{fmtKg(cert.totalKg)}</strong></div>
              <div className="kpi green"><span>CO₂ evitado</span><strong>{fmtKg(cert.co2EvitadoKg)}</strong></div>
            </div>
            <table>
              <thead><tr><th>Material</th><th>Peso</th><th>CO₂ evitado</th></tr></thead>
              <tbody>
                {cert.materiales.map((m) => (
                  <tr key={m.nombre}>
                    <td>{m.nombre}{m.pesoEstimado && ' *'}</td>
                    <td>{fmtKg(m.pesoKg)}</td>
                    <td>{fmtKg(m.co2EvitadoKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <a className="button" href={publicPdfUrl(cert.codigo)}>Descargar PDF</a>
          </>
        )}
      </div>
    </div>
  );
}
