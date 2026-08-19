import Link from 'next/link';
import { EmptyState } from '@nebula/ui';

export default function NotFound() {
  return (
    <div className="container section">
      <h1 className="page-title">Página no encontrada</h1>
      <EmptyState
        message="La página que buscas no existe o ha cambiado de dirección."
        action={
          <Link href="/" className="btn btn-dark btn-sm">
            Volver al inicio
          </Link>
        }
      />
    </div>
  );
}
