'use client';

import { useActionState } from 'react';
import { updateIntegration, updateUserRole } from '@/lib/actions/settings';
import { IDLE } from '@/lib/actions/result';
import { FormFeedback, SubmitButton } from './form';

export function IntegrationForm({
  provider,
  label,
  isEnabled,
  environment,
  hasCredentials,
  canEdit,
}: {
  provider: string;
  label: string;
  isEnabled: boolean;
  environment: string;
  hasCredentials: boolean;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(updateIntegration, IDLE);

  return (
    <form action={formAction} className="card">
      <div className="card-head">
        <h3>{label}</h3>
        {hasCredentials ? (
          <span className="tag tag-success">Credenciales cargadas</span>
        ) : (
          <span className="tag tag-warning">Sin credenciales</span>
        )}
      </div>

      <FormFeedback state={state} />

      <input type="hidden" name="provider" value={provider} />

      <div className="field">
        <label htmlFor={`environment-${provider}`}>Entorno</label>
        <select
          id={`environment-${provider}`}
          name="environment"
          defaultValue={environment}
          disabled={!canEdit}
        >
          <option value="sandbox">Sandbox (pruebas)</option>
          <option value="production">Producción</option>
        </select>
      </div>

      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: '0.85rem',
          marginBottom: 16,
        }}
      >
        <input type="checkbox" name="isEnabled" defaultChecked={isEnabled} disabled={!canEdit} />
        Activar integración
      </label>

      {canEdit ? (
        <SubmitButton className="btn btn-outline btn-sm" />
      ) : (
        <p className="field-hint">Solo un superadministrador puede modificarla.</p>
      )}
    </form>
  );
}

export function UserRoleForm({
  profileId,
  role,
  canEdit,
  isSelf,
}: {
  profileId: string;
  role: string;
  canEdit: boolean;
  isSelf: boolean;
}) {
  const [state, formAction] = useActionState(updateUserRole, IDLE);

  if (!canEdit || isSelf) {
    return <span className="tag">{role}</span>;
  }

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="hidden" name="profileId" value={profileId} />
      <select
        name="role"
        defaultValue={role}
        aria-label="Rol"
        style={{
          padding: '6px 10px',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          font: 'inherit',
          fontSize: '0.82rem',
        }}
      >
        <option value="customer">Cliente</option>
        <option value="operator">Operador</option>
        <option value="admin">Administrador</option>
        <option value="superadmin">Superadministrador</option>
      </select>
      <SubmitButton className="btn btn-outline btn-sm">Cambiar</SubmitButton>
      {state.status === 'error' ? <span className="tag tag-danger">!</span> : null}
    </form>
  );
}
