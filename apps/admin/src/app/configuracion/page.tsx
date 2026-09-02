import { PanelPage } from '@/components/panel-page';
import { IntegracionForm } from '@/components/integracion-form';
import { IntegrationForm } from '@/components/settings-forms';
import { requireAdmin } from '@/lib/auth';
import { cargarEstadoDeLaBoveda } from '@/lib/credenciales';
import { cargarIntegraciones } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

/**
 * Integraciones.
 *
 * Antes era una rejilla de tarjetas grandes, una por proveedor, sin agrupar: con
 * seis ya había que hacer scroll y con la siguiente pasarela sería peor. Ahora
 * son filas plegadas agrupadas por para qué sirven, y lo que se ve de un vistazo
 * es el estado de cada una, que es lo que se viene a mirar.
 *
 * La pantalla no conoce ninguna integración: las lee del catálogo. Añadir la
 * siguiente pasarela no toca este fichero.
 */
export default async function IntegrationsPage() {
  const session = await requireAdmin();
  const [estado, activaciones] = await Promise.all([
    cargarEstadoDeLaBoveda(),
    cargarIntegraciones(),
  ]);

  const esSuperadmin = session.role === 'superadmin';

  return (
    <PanelPage
      title="Integraciones"
      description="Las credenciales se pegan aquí. Se guardan cifradas y no vuelven a salir: solo se ven sus últimos caracteres."
    >
      {!estado.hayClaveMaestra ? (
        <div className="notice notice-warning">
          <strong>Falta la clave maestra.</strong> Sin ella no se puede cifrar nada, así que los
          campos están bloqueados y las integraciones siguen leyendo las variables de entorno del
          hosting. Es una variable, una sola y para siempre: <code>CREDENCIALES_CLAVE_MAESTRA</code>
          . Los pasos están en <code>docs/CONECTAR.md</code>.
        </div>
      ) : null}

      {estado.secciones.map((seccion) => (
        <section className="seccion-integraciones" key={seccion.grupo}>
          <h2 className="seccion-titulo">{seccion.titulo}</h2>

          <div className="lista-integraciones">
            {seccion.integraciones.map(({ integracion, campos, configurada }) => (
              <IntegracionForm
                key={integracion.proveedor}
                integracion={integracion}
                campos={campos}
                configurada={configurada}
                puedeEditar={esSuperadmin}
                bovedaDisponible={estado.bovedaDisponible}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="seccion-integraciones">
        <h2 className="seccion-titulo">Activación</h2>
        <p className="field-hint">
          Tener las credenciales puestas no basta: cada servicio se enciende aquí, y así se puede
          apagar uno sin borrar sus claves.
        </p>

        <div className="grid-2">
          {(activaciones ?? []).map((activacion) => (
            <IntegrationForm
              key={activacion.provider}
              provider={activacion.provider}
              label={(activacion.config as { label?: string })?.label ?? activacion.provider}
              isEnabled={activacion.is_enabled}
              environment={activacion.environment}
              canEdit={esSuperadmin}
            />
          ))}
        </div>
      </section>
    </PanelPage>
  );
}
