/**
 * Lo que se ve mientras una pantalla del panel carga.
 *
 * Las 25 son `force-dynamic`: cada navegación va al servidor y a Supabase antes
 * de pintar nada. Sin este fichero no pasaba NADA visible al pulsar un enlace
 * del menú —la pantalla anterior se quedaba congelada, sin indicador— y la
 * reacción natural de cualquiera es volver a pulsar. Era la causa estructural
 * de la sensación de «hay que darle varias veces» en las 25 pantallas.
 *
 * Reproduce la geometría del armazón (`.admin-shell`: barra lateral + columna
 * principal) para que al llegar el contenido real nada salte de sitio. No
 * reproduce el menú: la lista de secciones depende del rol y eso exige una
 * consulta, y un `loading` no puede esperar a nada — si esperase, no sería un
 * `loading`.
 *
 * NOTA para quien venga después: esto sustituye la pantalla entera, barra
 * lateral incluida, porque el armazón lo monta cada página con `PanelPage` en
 * vez de vivir en un `layout.tsx`. Moverlo a un layout haría que el menú se
 * quedara quieto y solo parpadease el contenido, que es lo suyo; es un cambio
 * mayor —las 25 pantallas le pasan título, descripción y acciones— y va aparte.
 */
export default function Cargando() {
  return (
    <div className="admin-shell" aria-busy="true">
      <aside className="admin-sidebar" aria-hidden="true">
        <div className="admin-brand">
          <span className="esqueleto esqueleto-marca" />
        </div>
        <div className="admin-nav">
          {[6, 5, 4].map((cuantos, grupo) => (
            <div className="admin-nav-group" key={grupo}>
              <span className="esqueleto esqueleto-titulo" />
              {Array.from({ length: cuantos }, (_, i) => (
                <span className="esqueleto esqueleto-enlace" key={i} />
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <span className="esqueleto esqueleto-h1" aria-hidden="true" />
        </header>
        <main className="admin-content">
          {/*
            El único texto de verdad de la pantalla, y no es decorativo: es lo
            que anuncia un lector de pantalla cuando el contenido se sustituye.
            `.visually-hidden` (de `base.css`) lo oculta a la vista, no a la
            asistencia.
          */}
          <p className="visually-hidden" role="status">
            Cargando…
          </p>
          <div className="esqueleto esqueleto-bloque" aria-hidden="true" />
          <div className="esqueleto esqueleto-bloque" aria-hidden="true" />
        </main>
      </div>
    </div>
  );
}
