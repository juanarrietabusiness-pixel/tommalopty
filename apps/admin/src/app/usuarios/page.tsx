import { shortDate } from '@nebula/ui';
import { DataTable } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { UserRoleForm } from '@/components/settings-forms';
import { requireAdmin, roleLabel } from '@/lib/auth';
import { cargarUsuarios } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await requireAdmin();
  const profiles = await cargarUsuarios();

  return (
    <PanelPage
      title="Usuarios y roles"
      description="Operador consulta, administrador gestiona catálogo y pedidos, superadministrador controla roles e integraciones."
    >
      {session.role !== 'superadmin' ? (
        <div className="notice notice-info">
          Tu rol permite ver esta pantalla, pero solo un superadministrador puede cambiar roles.
        </div>
      ) : null}

      <DataTable
        rows={profiles ?? []}
        rowKey={(profile) => profile.id}
        emptyMessage="No hay usuarios visibles para tu rol."
        columns={[
          {
            key: 'name',
            header: 'Usuario',
            render: (profile) => (
              <div>
                <span className="cell-strong">{profile.full_name ?? profile.email}</span>
                <div className="cell-muted">{profile.email}</div>
              </div>
            ),
          },
          {
            key: 'role',
            header: 'Rol actual',
            render: (profile) => <span className="tag tag-dark">{roleLabel(profile.role)}</span>,
          },
          {
            key: 'active',
            header: 'Estado',
            render: (profile) =>
              profile.is_active ? (
                <span className="tag tag-success">Activo</span>
              ) : (
                <span className="tag tag-danger">Desactivado</span>
              ),
          },
          {
            key: 'created',
            header: 'Alta',
            render: (profile) => (
              <span className="cell-muted">{shortDate(profile.created_at)}</span>
            ),
          },
          {
            key: 'change',
            header: 'Cambiar rol',
            render: (profile) => (
              <UserRoleForm
                profileId={profile.id}
                role={profile.role}
                canEdit={session.role === 'superadmin'}
                isSelf={profile.id === session.userId}
              />
            ),
          },
        ]}
      />
    </PanelPage>
  );
}
