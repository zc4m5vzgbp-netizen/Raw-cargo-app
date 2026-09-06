import { supabase } from '../supabase.js';

export async function render(contenedor) {
  const { data: { session } } = await supabase.auth.getSession();
  contenedor.innerHTML = `
    <h2>Raw Cargo</h2>
    <p>Bienvenido${session ? ', ' + session.user.email : ''}.</p>
    <p style="color:var(--color-texto-secundario)">El dashboard completo se construye en la siguiente fase.</p>
  `;
}
