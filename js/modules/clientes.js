import { supabase } from '../supabase.js';
import { mostrarCargando, mostrarError, mostrarVacio } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';

export async function render(contenedor) {
  contenedor.innerHTML = '<h2>Clientes</h2><div id="lista-clientes"></div>';
  const lista = contenedor.querySelector('#lista-clientes');
  mostrarCargando(lista);

  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, telefono')
      .order('creado_en', { ascending: false });
    if (error) throw error;

    if (!data.length) {
      mostrarVacio(lista, 'No tienes clientes todavía.');
      return;
    }

    lista.innerHTML = data.map((c) => `
      <div class="card">
        <strong>${c.nombre} ${c.apellido || ''}</strong><br>
        <span style="color:var(--color-texto-secundario)">${c.telefono || 'Sin teléfono'}</span>
      </div>
    `).join('');
  } catch (e) {
    mostrarError(lista, traducirError(e), () => render(contenedor));
  }
}
