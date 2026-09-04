'use client';

import { useState } from 'react';
import { ESTADOS_DESDE_LA_CALLE, type ShipmentStatus } from '@nebula/domain';

/**
 * Lo que quien entrega puede marcar desde la calle.
 *
 * Solo dos resultados: entregado o fallido. Asignar, devolver o reintentar son
 * decisiones de quien despacha y se toman desde el panel; ofrecerlas aquí sería
 * poner en manos de quien va en moto una decisión que no le toca, con el casco
 * puesto y el motor encendido.
 *
 * Los dos botones piden confirmación antes de enviar. No es ceremonia: son
 * acciones que no se pueden deshacer —la máquina de estados no deja volver de
 * «entregado»— y se tocan con una mano, a veces con guantes.
 */
export function AccionesDeEntrega({ token, estado }: { token: string; estado: ShipmentStatus }) {
  const [enviando, setEnviando] = useState<ShipmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recibidoPor, setRecibidoPor] = useState('');
  const [motivo, setMotivo] = useState('');

  async function marcar(nuevo: (typeof ESTADOS_DESDE_LA_CALLE)[number]) {
    const pregunta =
      nuevo === 'entregado'
        ? '¿Confirmas que el pedido quedó entregado?'
        : '¿Confirmas que la entrega no se pudo hacer?';

    if (!window.confirm(pregunta)) return;

    setEnviando(nuevo);
    setError(null);

    try {
      const respuesta = await fetch(`/api/g/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: nuevo,
          receivedBy: nuevo === 'entregado' ? recibidoPor.trim() || undefined : undefined,
          failureReason: nuevo === 'fallido' ? motivo.trim() || undefined : undefined,
        }),
      });

      if (respuesta.ok) {
        // Recarga entera y no actualización parcial: así lo que se ve viene de
        // la base, y no de lo que este componente cree que pasó.
        window.location.reload();
        return;
      }

      const datos = (await respuesta.json().catch(() => null)) as { message?: string } | null;
      setError(datos?.message ?? 'No se pudo guardar. Revisa la señal e inténtalo otra vez.');
    } catch {
      setError('Sin conexión. El pedido sigue asignado a ti; inténtalo cuando tengas señal.');
    } finally {
      setEnviando(null);
    }
  }

  return (
    <section className="entrega-bloque">
      <h2>¿Cómo terminó?</h2>

      {error ? (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      ) : null}

      {estado === 'en_ruta' || estado === 'recogido' ? null : (
        <p className="field-hint">
          Este envío todavía figura como «{estado}». Puedes marcar el resultado igual, pero avisa a
          quien despacha para que cuadre la ruta.
        </p>
      )}

      <div className="field">
        <label htmlFor="recibidoPor">Quién recibió (opcional)</label>
        <input
          id="recibidoPor"
          value={recibidoPor}
          onChange={(evento) => setRecibidoPor(evento.target.value)}
          maxLength={80}
          placeholder="Nombre de quien recibió"
        />
      </div>

      <button
        type="button"
        className="btn btn-dark entrega-boton"
        onClick={() => void marcar('entregado')}
        disabled={enviando !== null}
      >
        {enviando === 'entregado' ? 'Guardando…' : 'Marcar entregado'}
      </button>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="motivo">Si no se pudo entregar, ¿por qué?</label>
        <input
          id="motivo"
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          maxLength={200}
          placeholder="Nadie contestó · dirección no existe · rechazó el pedido"
        />
      </div>

      <button
        type="button"
        className="btn btn-outline entrega-boton"
        onClick={() => void marcar('fallido')}
        disabled={enviando !== null}
      >
        {enviando === 'fallido' ? 'Guardando…' : 'No se pudo entregar'}
      </button>
    </section>
  );
}
