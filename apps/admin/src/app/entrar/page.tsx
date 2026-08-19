import { Suspense } from 'react';
import { AdminLoginForm } from '@/components/admin-login-form';

export default function AdminLoginPage() {
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Nébula Store';

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <h1>{brandName}</h1>
        <p>Panel administrativo — acceso restringido al equipo.</p>
        <Suspense fallback={null}>
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
