'use client';

import { useActionState, useMemo, useState } from 'react';
import { analizar, CAMPOS, type Campo, type Mapeo } from '@nebula/domain';
import { money } from '@nebula/ui';
import { importarProductos } from '@/lib/actions/importacion';
import { IDLE } from '@/lib/actions/result';
import { FormFeedback, SubmitButton } from './form';

/**
 * Importar productos desde una hoja de cálculo.
 *
 * La pantalla tiene tres momentos y el del medio es el que justifica todo:
 *
 *   1. Pegar o subir el fichero.
 *   2. **Ver qué se entendió** — qué columna es cada campo, cómo quedó cada
 *      precio, qué filas se descartan y por qué.
 *   3. Confirmar.
 *
 * Sin el segundo, importar es tirar mil productos a la base y descubrir después
 * que la columna de precio era la de peso. El análisis corre **en el navegador**
 * y no toca la base: es la misma función pura del dominio que usará el servidor,
 * así que lo que se ve aquí es exactamente lo que se va a guardar.
 */

const ETIQUETAS: Record<Campo, string> = {
  titulo: 'Título',
  precio: 'Precio',
  precioComparar: 'Precio anterior',
  sku: 'Código / SKU',
  existencias: 'Existencias',
  descripcion: 'Descripción',
  marca: 'Marca',
  imagen: 'Imagen (URL)',
};

const REQUERIDOS: Campo[] = ['titulo', 'precio'];

export function ImportarProductos() {
  const [texto, setTexto] = useState('');
  const [correcciones, setCorrecciones] = useState<Mapeo>({});
  const [state, formAction] = useActionState(importarProductos, IDLE);

  // El análisis automático se recalcula al cambiar el texto; las correcciones a
  // mano se aplican encima. Así cambiar de fichero no arrastra el mapeo del
  // anterior, que sería la clase de error que nadie relaciona con su causa.
  const analisis = useMemo(() => {
    if (texto.trim() === '') return null;

    const automatico = analizar(texto);
    const mapeo = { ...automatico.mapeo, ...correcciones };

    return analizar(texto, mapeo);
  }, [texto, correcciones]);

  async function alSubirFichero(evento: React.ChangeEvent<HTMLInputElement>) {
    const fichero = evento.target.files?.[0];
    if (!fichero) return;

    setCorrecciones({});
    setTexto(await fichero.text());
  }

  function corregir(campo: Campo, valor: string) {
    setCorrecciones((previas) => {
      const siguientes = { ...previas };
      if (valor === '') delete siguientes[campo];
      else siguientes[campo] = Number(valor);
      return siguientes;
    });
  }

  const puedeImportar =
    analisis !== null && analisis.faltanCampos.length === 0 && analisis.productos.length > 0;

  return (
    <div className="importador">
      <section className="card">
        <div className="card-head">
          <h2>1 · El fichero</h2>
        </div>

        <div className="field">
          <label htmlFor="fichero">Sube un CSV</label>
          <input id="fichero" type="file" accept=".csv,.txt,text/csv" onChange={alSubirFichero} />
          <span className="field-hint">
            Sirve lo que exporta Excel, Google Sheets o una extensión como «DS Amazon Quick View
            Extended». Los encabezados no tienen que llamarse de ninguna forma concreta: se
            reconocen solos y se pueden corregir abajo.
          </span>
        </div>

        <div className="field">
          <label htmlFor="pegado">…o pega las filas aquí</label>
          <textarea
            id="pegado"
            rows={5}
            value={texto}
            onChange={(evento) => {
              setCorrecciones({});
              setTexto(evento.target.value);
            }}
            placeholder={'Titulo,Precio,SKU,Existencias\nCamisa blanca,19.90,CAM-01,12'}
            spellCheck={false}
          />
          <span className="field-hint">
            Copiar y pegar desde una hoja de cálculo también funciona: se separa por tabuladores.
          </span>
        </div>
      </section>

      {analisis ? (
        <>
          <section className="card">
            <div className="card-head">
              <h2>2 · Qué columna es cada cosa</h2>
              <span className="tag tag-muted">
                {analisis.delimitador === '\t'
                  ? 'tabulador'
                  : `separador «${analisis.delimitador}»`}
              </span>
            </div>

            {analisis.faltanCampos.length > 0 ? (
              <p className="notice notice-warning">
                Falta indicar {analisis.faltanCampos.map((c) => ETIQUETAS[c]).join(' y ')}. Sin eso
                no se puede crear un producto.
              </p>
            ) : null}

            <div className="grid-2">
              {CAMPOS.map((campo) => (
                <div className="field" key={campo}>
                  <label htmlFor={`col-${campo}`}>
                    {ETIQUETAS[campo]}
                    {REQUERIDOS.includes(campo) ? null : (
                      <span className="field-opcional"> · opcional</span>
                    )}
                  </label>
                  <select
                    id={`col-${campo}`}
                    value={analisis.mapeo[campo] ?? ''}
                    onChange={(evento) => corregir(campo, evento.target.value)}
                  >
                    <option value="">— ninguna —</option>
                    {analisis.encabezados.map((encabezado, indice) => (
                      <option key={indice} value={indice}>
                        {encabezado || `(columna ${indice + 1})`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>3 · Lo que va a entrar</h2>
              <span className={puedeImportar ? 'tag tag-success' : 'tag tag-warning'}>
                {analisis.productos.length} de{' '}
                {analisis.productos.length + analisis.rechazadas.length}
              </span>
            </div>

            {analisis.rechazadas.length > 0 ? (
              <details className="importador-descartes">
                <summary>
                  {analisis.rechazadas.length} fila
                  {analisis.rechazadas.length === 1 ? '' : 's'} se descarta
                  {analisis.rechazadas.length === 1 ? '' : 'n'} — ver cuáles
                </summary>
                <ul>
                  {analisis.rechazadas.slice(0, 50).map((rechazada) => (
                    <li key={rechazada.fila}>
                      <strong>Fila {rechazada.fila}</strong>
                      {rechazada.referencia ? ` · ${rechazada.referencia}` : ''} —{' '}
                      {rechazada.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <div className="tabla-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Fila</th>
                    <th scope="col">Título</th>
                    <th scope="col">Precio</th>
                    <th scope="col">Código</th>
                    <th scope="col">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {analisis.productos.slice(0, 25).map((producto) => (
                    <tr key={producto.fila}>
                      <td>{producto.fila}</td>
                      <td>
                        {producto.titulo}
                        {producto.avisos.map((aviso) => (
                          <div className="importador-aviso" key={aviso}>
                            {aviso}
                          </div>
                        ))}
                      </td>
                      {/* Se enseña el importe ya interpretado y, debajo, el texto
                          original. Es la única forma de que alguien vea que
                          «1.299» se entendió como mil doscientos noventa y nueve
                          y no como uno con dos nueve nueve, antes de guardarlo. */}
                      <td>
                        {money(producto.precio)}
                        <div className="importador-aviso">{producto.precioLeido}</div>
                      </td>
                      <td>{producto.sku ?? '—'}</td>
                      <td>{producto.existencias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {analisis.productos.length > 25 ? (
              <p className="field-hint">
                Se muestran los primeros 25 de {analisis.productos.length}. Se importarán todos.
              </p>
            ) : null}
          </section>

          <form action={formAction} className="card">
            <FormFeedback state={state} />

            <input type="hidden" name="csv" value={texto} />
            <input type="hidden" name="mapeo" value={JSON.stringify(analisis.mapeo)} />

            <p className="field-hint">
              Entran todos como <strong>borrador</strong>. Un fichero de proveedor trae
              descripciones ajenas, precios sin margen y fotos que no son tuyas: nada aparece en la
              tienda hasta que lo actives a mano.
            </p>

            {puedeImportar ? (
              <SubmitButton className="btn btn-dark">{`Importar ${analisis.productos.length}`}</SubmitButton>
            ) : (
              <p className="field-hint">Corrige las columnas de arriba para poder importar.</p>
            )}
          </form>
        </>
      ) : null}
    </div>
  );
}
