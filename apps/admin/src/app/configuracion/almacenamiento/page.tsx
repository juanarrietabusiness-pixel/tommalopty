import type { Metadata } from 'next';
import { PanelPage } from '@/components/panel-page';
import { BarridoHuerfanos } from '@/components/barrido-huerfanos';
import { requireAdmin } from '@/lib/auth';
import { inspeccionarAlmacenamiento } from '@/lib/actions/almacenamiento';

export const metadata: Metadata = { title: 'Almacenamiento' };

export const dynamic = 'force-dynamic';

function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export default async function AlmacenamientoPage() {
  const sesion = await requireAdmin();
  const informe = await inspeccionarAlmacenamiento();

  return (
    <PanelPage
      title="Almacenamiento"
      description="Qué hay en el bucket de imágenes que ya no usa nadie."
    >
      {!informe.disponible || !informe.fiable ? (
        <div className="notice notice-error">
          <strong>No se puede barrer ahora mismo.</strong> {informe.motivo}
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            No es un fallo silencioso a propósito: si no se puede enumerar todo lo que está en uso,
            cualquier fichero parecería sobrar. Ante la duda no se borra nada.
          </p>
        </div>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <h2>Qué hay en el bucket</h2>
            </div>

            <table className="tabla">
              <tbody>
                <tr>
                  <td>En uso</td>
                  <td>
                    <strong>{informe.enUso}</strong> ficheros referenciados por alguna fila
                  </td>
                </tr>
                <tr>
                  <td>Recién subidos</td>
                  <td>
                    <strong>{informe.recientes}</strong> — sin fila todavía, pero de menos de 24 h.
                    No se tocan: el panel sube la imagen antes de guardar el formulario, y ésta
                    puede ser justo la que alguien está a punto de usar.
                  </td>
                </tr>
                <tr>
                  <td>Fuera de las carpetas de imágenes</td>
                  <td>
                    <strong>{informe.ajenos}</strong> — este barrido no los mira
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Sobran</strong>
                  </td>
                  <td>
                    <strong>{informe.huerfanos}</strong> ficheros ·{' '}
                    {pesoLegible(informe.bytesHuerfanos)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {informe.huerfanos > 0 ? (
            <section className="card">
              <div className="card-head">
                <h2>Una muestra de lo que se borraría</h2>
              </div>

              <p className="field-hint">
                Los {Math.min(informe.huerfanos, 20)} primeros, para poder mirarlos antes de
                decidir.
              </p>

              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fichero</th>
                    <th>Peso</th>
                    <th>Subido</th>
                  </tr>
                </thead>
                <tbody>
                  {informe.muestra.map((objeto) => (
                    <tr key={objeto.key}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{objeto.key}</td>
                      <td>{pesoLegible(objeto.bytes)}</td>
                      <td>{objeto.subidoEn.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 16 }}>
                <BarridoHuerfanos
                  cuantos={informe.huerfanos}
                  puedeBorrar={sesion.role === 'superadmin'}
                />
              </div>
            </section>
          ) : (
            <div className="notice notice-success">
              No sobra nada: todo lo que hay en el bucket lo referencia alguna fila.
            </div>
          )}
        </>
      )}
    </PanelPage>
  );
}
