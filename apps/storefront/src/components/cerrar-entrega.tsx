'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  SHIPMENT_STATUS_LABELS,
  allowedShipmentTransitions,
  type ShipmentStatus,
} from '@nebula/domain';
import { moverMiEnvio } from '@/lib/actions/motorizado';

/**
 * Los botones con los que se cierra una entrega, hechos para la calle.
 *
 * TRES DECISIONES DE FORMA QUE NO SON DE GUSTO
 *
 * **Un botón por paso, y grandes.** Se tocan con una mano, a veces con guantes,
 * a veces con el casco puesto. Un menú desplegable con siete estados es una
 * pantalla de oficina.
 *
 * **Solo se ofrece lo que la máquina de estados permite desde donde está**, y de
 * eso, solo lo que le corresponde a un motorizado. Asignar y devolver son
 * decisiones de quien despacha. Ofrecer algo que la base va a rechazar es hacer
 * que descubra el límite después de haber rellenado el formulario, de pie en la
 * acera.
 *
 * **Entregar y fallar piden confirmación; recoger y salir, no.** No es ceremonia
 * uniforme: los dos primeros no se pueden deshacer —la máquina no deja volver de
 * «entregado»— y los otros dos sí se corrigen solos avanzando. Pedir
 * confirmación para todo enseña a confirmar sin leer.
 */
const LO_QUE_PUEDE_MARCAR: readonly ShipmentStatus[] = [
  'recogido',
  'en_ruta',
  'entregado',
  'fallido',
];

const IRREVERSIBLES: readonly ShipmentStatus[] = ['entregado', 'fallido'];

export function CerrarEntrega({
  shipmentId,
  estado,
  recibidoPor,
  nota,
}: {
  shipmentId: string;
  estado: ShipmentStatus;
  recibidoPor: string;
  nota: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [quienRecibe, setQuienRecibe] = useState(recibidoPor);
  const [comentario, setComentario] = useState(nota);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const posibles = allowedShipmentTransitions(estado).filter((destino) =>
    LO_QUE_PUEDE_MARCAR.includes(destino),
  );

  if (posibles.length === 0) {
    return (
      <div className="notice notice-success">
        Esta entrega ya está cerrada. No hay nada más que hacer con ella.
      </div>
    );
  }

  function marcar(destino: ShipmentStatus) {
    if (IRREVERSIBLES.includes(destino)) {
      const pregunta =
        destino === 'entregado'
          ? '¿Confirmas que quedó entregado?'
          : '¿Confirmas que la entrega no se pudo hacer?';
      if (!window.confirm(pregunta)) return;
    }

    setAviso(null);

    startTransition(async () => {
      const resultado = await moverMiEnvio({
        shipmentId,
        status: destino,
        receivedBy: destino === 'entregado' ? quienRecibe.trim() || undefined : undefined,
        deliveryNote: destino === 'entregado' ? comentario.trim() || undefined : undefined,
        failureReason: destino === 'fallido' ? motivo.trim() || undefined : undefined,
      });

      setAviso(resultado.mensaje);

      // Al cerrar, de vuelta a la lista: la siguiente entrega es lo que quiere
      // ver, no la que acaba de terminar.
      if (resultado.ok && IRREVERSIBLES.includes(destino)) {
        router.push('/motorizado');
        return;
      }

      if (resultado.ok) router.refresh();
    });
  }

  return (
    <section className="motorizado-acciones">
      <h2>¿Qué pasó?</h2>

      {aviso ? <p className="notice notice-info">{aviso}</p> : null}

      {posibles.includes('entregado') ? (
        <>
          <div className="field">
            <label htmlFor="recibidoPor">¿Quién lo recibió? (opcional)</label>
            <input
              id="recibidoPor"
              value={quienRecibe}
              onChange={(evento) => setQuienRecibe(evento.target.value)}
              maxLength={120}
              placeholder="La vecina, el portero…"
            />
          </div>
          <div className="field">
            <label htmlFor="nota">Nota (opcional)</label>
            <input
              id="nota"
              value={comentario}
              onChange={(evento) => setComentario(evento.target.value)}
              maxLength={300}
            />
          </div>
        </>
      ) : null}

      {posibles.includes('fallido') ? (
        <div className="field">
          <label htmlFor="motivo">Si no se pudo, ¿por qué?</label>
          <input
            id="motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            maxLength={300}
            placeholder="Nadie en casa · dirección no existe"
          />
        </div>
      ) : null}

      <div className="motorizado-botones">
        {posibles.map((destino) => (
          <button
            key={destino}
            type="button"
            className={destino === 'fallido' ? 'btn btn-outline' : 'btn btn-dark'}
            disabled={pendiente}
            onClick={() => marcar(destino)}
          >
            {pendiente ? 'Guardando…' : SHIPMENT_STATUS_LABELS[destino]}
          </button>
        ))}
      </div>
    </section>
  );
}
