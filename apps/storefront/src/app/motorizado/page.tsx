import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from '@nebula/domain';
import { listMisEnvios, listMiDia } from '@nebula/db';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { destinoDelEnvio, resumenDeDestino } from '@/lib/entregas';

/**
 * Lo que lleva encima quien reparte.
 *
 * POR QUÉ ESTA PANTALLA NO PIDE UN IDENTIFICADOR
 *
 * No recibe ni pide el identificador del motorizado: la consulta trae lo que la
 * política RLS deja ver, que son los envíos con `assigned_to = auth.uid()`.
 * Pedirlo como parámetro habría dejado una pantalla que sabe preguntar por los
 * envíos de otro —la política lo impediría hoy, pero una pantalla que pide lo
 * que no le toca es la que un día se despliega sin la política.
 *
 * POR QUÉ VIVE EN LA TIENDA Y NO EN EL PANEL
 *
 * Un motorizado no entra al panel: el panel es de la oficina y trae el catálogo,
 * los clientes y los cobros. Aquí solo hay esto. Y de paso se instala como
 * aplicación desde el navegador, sin tienda de aplicaciones y sin esperar
 * aprobaciones de nadie.
 */

export const metadata: Metadata = {
  title: 'Mis entregas',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Medianoche de hoy en Panamá, en ISO, para «mi día». */
function comienzoDelDiaEnPanama(): string {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Panamá es UTC−5 todo el año: no cambia la hora, así que el desfase es fijo
  // y no hace falta una librería de husos para esto.
  return `${hoy}T05:00:00.000Z`;
}

export default async function MisEntregasPage() {
  if (!isSupabaseConfigured()) redirect('/entrar');

  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/entrar?siguiente=/motorizado');

  const [pendientes, cerradosHoy] = await Promise.all([
    listMisEnvios(supabase),
    listMiDia(supabase, comienzoDelDiaEnPanama()),
  ]);

  const entregados = cerradosHoy.filter((envio) => envio.status === 'entregado').length;
  const fallidos = cerradosHoy.length - entregados;

  return (
    <div className="motorizado">
      <header className="motorizado-cabecera">
        <h1>Mis entregas</h1>
        <p>
          {pendientes.length === 0
            ? 'No tienes entregas pendientes.'
            : `${pendientes.length} ${pendientes.length === 1 ? 'entrega' : 'entregas'} por hacer.`}
        </p>
      </header>

      {/*
        El resumen del día va arriba y no al final: es lo que quien reparte mira
        de reojo entre entrega y entrega, y hacerle bajar hasta el fondo de una
        lista para verlo es no haber visto nunca cómo se usa esto.
      */}
      <div className="motorizado-dia">
        <div>
          <strong>{entregados}</strong>
          <span>entregadas hoy</span>
        </div>
        <div>
          <strong>{fallidos}</strong>
          <span>{fallidos === 1 ? 'fallida' : 'fallidas'}</span>
        </div>
      </div>

      {pendientes.length === 0 ? (
        <div className="notice notice-info">
          Cuando te asignen una entrega aparecerá aquí. No hace falta que recargues: vuelve a abrir
          la aplicación y estará.
        </div>
      ) : (
        <ul className="motorizado-lista">
          {pendientes.map((envio) => {
            const destino = destinoDelEnvio(envio.destination);

            return (
              <li key={envio.id}>
                <Link href={`/motorizado/${envio.id}`} className="motorizado-tarjeta">
                  <span className="motorizado-guia">{envio.trackingNumber}</span>
                  <strong>{resumenDeDestino(destino)}</strong>
                  {destino.reference ? <span>{destino.reference}</span> : null}
                  <span className={`motorizado-estado estado-${envio.status}`}>
                    {SHIPMENT_STATUS_LABELS[envio.status as ShipmentStatus]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
