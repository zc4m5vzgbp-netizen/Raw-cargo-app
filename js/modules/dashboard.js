import { supabase } from '../supabase.js';
import { mostrarError } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';
import { formatUSD, formatFechaHora, formatEntidad, formatAccion } from '../utils/formatters.js';

const ESTADOS_ORDEN_BLOQUEADOS = ['completada', 'cancelada'];
const ESTADOS_PAQUETE_BLOQUEADOS = ['entregado', 'cancelado'];

export async function render(contenedor) {
  contenedor.innerHTML = `
    <h1>Dashboard</h1>
    <p class="texto-secundario">Resumen general</p>

    <div class="stat-grid" id="stat-grid">
      <a href="#clientes" class="stat-card stat-card-clickable">
        <div class="stat-label">Clientes</div>
        <div class="skeleton" style="width:50%;height:28px;"></div>
      </a>
      <a href="#ordenes/activas" class="stat-card stat-card-clickable">
        <div class="stat-label">Órdenes activas</div>
        <div class="skeleton" style="width:50%;height:28px;"></div>
      </a>
      <a href="#paquetes/transito" class="stat-card stat-card-clickable">
        <div class="stat-label">Paquetes en tránsito</div>
        <div class="skeleton" style="width:50%;height:28px;"></div>
      </a>
      <div class="stat-card stat-card-acento">
        <div class="stat-label">Ganancia total</div>
        <div class="skeleton" style="width:70%;height:28px;"></div>
      </div>
    </div>

    <div class="section-header"><h3>Actividad reciente</h3></div>
    <div id="actividad-reciente">
      <div class="skeleton" style="width:90%;"></div>
      <div class="skeleton" style="width:75%;"></div>
      <div class="skeleton" style="width:85%;margin-bottom:0;"></div>
    </div>

    <div class="section-header"><h3>Acciones rápidas</h3></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <a href="#clientes" class="btn btn-secundario btn-sm">+ Cliente</a>
      <a href="#ordenes/nuevo" class="btn btn-secundario btn-sm">+ Orden</a>
      <a href="#paquetes/nuevo" class="btn btn-secundario btn-sm">+ Paquete</a>
    </div>
  `;

  const elStatGrid = contenedor.querySelector('#stat-grid');
  const elActividad = contenedor.querySelector('#actividad-reciente');

  try {
    const [
      { count: totalClientes, error: e1 },
      { count: ordenesActivas, error: e2 },
      { count: paquetesEnTransito, error: e3 },
      { data: totales, error: e4 },
      { data: actividad, error: e5 },
    ] = await Promise.all([
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('ordenes').select('id', { count: 'exact', head: true }).not('estado', 'in', `(${ESTADOS_ORDEN_BLOQUEADOS.join(',')})`),
      supabase.from('paquetes').select('id', { count: 'exact', head: true }).not('estado', 'in', `(${ESTADOS_PAQUETE_BLOQUEADOS.join(',')})`),
      supabase.from('v_orden_totales').select('ganancia'),
      supabase.from('historial_cambios')
        .select('entidad_tipo, accion, fecha_hora, usuarios(nombre)')
        .eq('origen', 'usuario')
        .order('fecha_hora', { ascending: false })
        .limit(5),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;
    if (e4) throw e4;
    if (e5) throw e5;

    const gananciaTotal = (totales || []).reduce((acc, t) => acc + Number(t.ganancia || 0), 0);

    elStatGrid.innerHTML = `
      <a href="#clientes" class="stat-card stat-card-clickable">
        <div class="stat-label">Clientes</div>
        <div class="stat-valor">${totalClientes ?? 0}</div>
      </a>
      <a href="#ordenes/activas" class="stat-card stat-card-clickable">
        <div class="stat-label">Órdenes activas</div>
        <div class="stat-valor">${ordenesActivas ?? 0}</div>
      </a>
      <a href="#paquetes/transito" class="stat-card stat-card-clickable">
        <div class="stat-label">Paquetes en tránsito</div>
        <div class="stat-valor">${paquetesEnTransito ?? 0}</div>
      </a>
      <div class="stat-card stat-card-acento">
        <div class="stat-label">Ganancia total</div>
        <div class="stat-valor">${formatUSD(gananciaTotal)}</div>
      </div>
    `;

    if (!actividad || !actividad.length) {
      elActividad.innerHTML = '<div class="vacio">Sin actividad reciente todavía.</div>';
    } else {
      elActividad.innerHTML = `
        <div class="card">
          ${actividad.map((a, i) => `
            <div style="display:flex;justify-content:space-between;gap:8px;${i > 0 ? 'border-top:1px solid var(--color-border);padding-top:8px;margin-top:8px;' : ''}">
              <span>${formatEntidad(a.entidad_tipo)} ${formatAccion(a.accion)}${a.usuarios?.nombre ? ` por ${a.usuarios.nombre}` : ''}</span>
              <span class="texto-tenue">${formatFechaHora(a.fecha_hora)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (e) {
    mostrarError(elStatGrid, traducirError(e));
    elActividad.innerHTML = '';
  }
}
