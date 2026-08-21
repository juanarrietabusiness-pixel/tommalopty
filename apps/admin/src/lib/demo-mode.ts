/**
 * ¿El panel corre en modo demostración?
 *
 * Vive en su propio módulo, sin importar nada, y eso es deliberado: lo
 * consultan tanto el servidor (guardia de sesión, capa de datos) como el
 * cliente (el resultado que devuelven los formularios). Cuando esta función
 * vivía en `auth.ts`, importarla desde una acción arrastraba `next/headers` al
 * bundle del navegador y el build se caía.
 *
 * Las referencias a `process.env.NEXT_PUBLIC_*` van escritas literalmente
 * porque Next las sustituye en tiempo de build; leerlas por variable no
 * funcionaría en el cliente.
 *
 * La condición es una sola: que NO haya Supabase configurado. Nunca que una
 * consulta falle. Un panel que rellena huecos con datos de ejemplo cuando la
 * base está caída lleva a decidir sobre cifras que no existen.
 */
export function esModoDemostracion(): boolean {
  return !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
