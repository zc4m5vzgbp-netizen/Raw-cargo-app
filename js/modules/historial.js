import { supabase } from '../supabase.js';
import { mostrarCargando, mostrarError, mostrarVacio, escaparHTML } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';
import { formatFechaHora, formatEntidad, formatAccion } from '../utils/formatters.js';

const TIPOS_CON_ENLACE = { ordenes: '#ordenes/', paquetes: '#paquetes/' };
const LIMITE = 100;

export async function render(contenedor) {
  contenedor.innerHTML = `
    <div class="section-header"><h2>Historial</h2></div>
    <div class="form-grupo">
      <select id="historial-filtro" class="select">
        <option value="">Todas las entidades</option>
        <option value="clientes">Clientes</option>
        <option value="ordenes">Órdenes</option>
        <option value="productos">Productos</option>
        <option value="paquetes">Paquetes</option>
        <option value="producto_paquete">Asignaciones de producto</option>
        <option value="pagos">Pagos</option>
        <option value="gastos">Gastos</option>
        <option value="config_versiones">Configuración</option>
      </select>
    </div>
    <p class="texto-tenue" style="margin-top:-8px;">Se muestran los últimos ${LIMITE} cambios.</p>
    <div id="lista-historial"></div>
  `;

  const elLista = contenedor.querySelector('#lista-historial');
  const elFiltro = contenedor.querySelector('#historial-filtro');

  elFiltro.addEventListener('change', () => cargarHistorial(elFiltro.value));

  async function cargarHistorial(entidadTipo) {
    mostrarCargando(elLista, 6);
    try {
      let consulta = supabase
        .from('historial_cambios')
        .select('id, entidad_tipo, entidad_id, campo, valor_anterior, valor_nuevo, accion, origen, fecha_hora, usuarios(nombre)')
        .order('fecha_hora', { ascending: false })
        .limit(LIMITE);
      if (entidadTipo) consulta = consulta.eq('entidad_tipo', entidadTipo);

      const { data, error } = await consulta;
      if (error) throw error;

      if (!data.length) {
        mostrarVacio(elLista, 'No hay cambios registrados todavía.');
        return;
      }

      elLista.innerHTML = data.map((h) => {
        const enlace = TIPOS_CON_ENLACE[h.entidad_tipo];
        const idCorto = h.entidad_id ? h.entidad_id.slice(0, 8) : '—';
        const entidadTexto = enlace
          ? `<a href="${enlace}${h.entidad_id}">${formatEntidad(h.entidad_tipo)} ${idCorto}…</a>`
          : `${formatEntidad(h.entidad_tipo)} ${idCorto}…`;
        const cambio = h.campo
          ? `<div class="texto-secundario">${escaparHTML(h.campo)}: ${escaparHTML(h.valor_anterior ?? '—')} → ${escaparHTML(h.valor_nuevo ?? '—')}</div>`
          : '';

        return `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <strong>${entidadTexto}</strong> — ${formatAccion(h.accion)}
                ${cambio}
                <div class="texto-tenue">${h.usuarios?.nombre ? `Por ${escaparHTML(h.usuarios.nombre)} · ` : ''}${formatFechaHora(h.fecha_hora)}</div>
              </div>
              <span class="badge ${h.origen === 'usuario' ? 'badge-primario' : 'badge-neutro'}">${h.origen === 'usuario' ? 'Usuario' : 'Sistema'}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      mostrarError(elLista, traducirError(e), () => cargarHistorial(entidadTipo));
    }
  }

  await cargarHistorial('');
}
