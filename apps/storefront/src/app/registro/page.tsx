import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { AuthFormFallback } from '@/components/auth-form-fallback';
import { AuthDemoNotice } from '@/components/auth-demo-notice';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <div className="container">
      <AuthDemoNotice />
      <Suspense fallback={<AuthFormFallback mode="signup" />}>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
