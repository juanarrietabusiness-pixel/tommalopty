import Link from 'next/link';

/**
 * Lo que se ve mientras carga el formulario de acceso.
 *
 * `AuthForm` lee `useSearchParams`, así que va envuelto en `<Suspense>`. Con
 * `fallback={null}` el servidor no mandaba nada: quien abría /entrar o
 * /registro veía la página vacía —sin título ni campos— hasta que llegaba el
 * JavaScript, y sin JavaScript no veía nada en absoluto.
 *
 * Este armazón sale ya en el HTML del servidor y lo sustituye el formulario
 * real al hidratar, así que nunca hay dos <h1> a la vez.
 */
export function AuthFormFallback({ mode }: { mode: 'login' | 'signup' }) {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <p>
          {mode === 'login'
            ? 'Accede para ver tus pedidos y direcciones guardadas.'
            : 'Crea tu cuenta para seguir tus pedidos y guardar favoritos.'}
        </p>

        <p className="field-hint">Cargando el formulario…</p>

        <p className="auth-footer">
          {mode === 'login' ? (
            <>
              ¿No tienes cuenta? <Link href="/registro">Regístrate</Link>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta? <Link href="/entrar">Inicia sesión</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
