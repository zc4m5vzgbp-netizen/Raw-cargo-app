import { supabase } from '../supabase.js';
import { mostrarError, escaparHTML } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';
import { formatUSD, formatFecha } from '../utils/formatters.js';

export async function render(contenedor) {
  contenedor.innerHTML = `
    <h1>Finanzas</h1>
    <p class="texto-secundario">Datos reales tomados directamente de Supabase</p>
    <div class="stat-grid" id="finanzas-stat-grid">
      <div class="stat-card"><div class="stat-label">Ingresos (órdenes)</div><div class="skeleton" style="height:28px;"></div></div>
      <div class="stat-card"><div class="stat-label">Costos (órdenes)</div><div class="skeleton" style="height:28px;"></div></div>
      <div class="stat-card"><div class="stat-label">Ganancia (órdenes)</div><div class="skeleton" style="height:28px;"></div></div>
      <div class="stat-card"><div class="stat-label">Gastos generales</div><div class="skeleton" style="height:28px;"></div></div>
    </div>
    <div class="card" id="finanzas-cobrado">
      <div class="skeleton"></div>
    </div>
    <div class="section-header"><h3>Órdenes</h3></div>
    <div id="finanzas-ordenes"></div>
  `;

  const elGrid = contenedor.querySelector('#finanzas-stat-grid');
  const elCobrado = contenedor.querySelector('#finanzas-cobrado');
  const elOrdenes = contenedor.querySelector('#finanzas-ordenes');

  try {
    const [
      { data: totales, error: e1 },
      { data: gastosGenerales, error: e2 },
      { data: pagos, error: e3 },
    ] = await Promise.all([
      supabase.from('v_orden_totales').select('orden_id, codigo, precio_total_cliente, costo_total, ganancia'),
      supabase.from('gastos').select('monto').is('orden_id', null).is('paquete_id', null),
      supabase.from('pagos').select('monto'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    const ingresos = totales.reduce((acc, t) => acc + Number(t.precio_total_cliente || 0), 0);
    const costos = totales.reduce((acc, t) => acc + Number(t.costo_total || 0), 0);
    const ganancia = totales.reduce((acc, t) => acc + Number(t.ganancia || 0), 0);
    const gastosGralesTotal = (gastosGenerales || []).reduce((acc, g) => acc + Number(g.monto || 0), 0);
    const totalCobrado = (pagos || []).reduce((acc, p) => acc + Number(p.monto || 0), 0);
    const saldoPendienteGlobal = ingresos - totalCobrado;

    elGrid.innerHTML = `
      <div class="stat-card"><div class="stat-label">Ingresos (órdenes)</div><div class="stat-valor">${formatUSD(ingresos)}</div></div>
      <div class="stat-card"><div class="stat-label">Costos (órdenes)</div><div class="stat-valor">${formatUSD(costos)}</div></div>
      <div class="stat-card"><div class="stat-label">Ganancia (órdenes)</div><div class="stat-valor">${formatUSD(ganancia)}</div></div>
      <div class="stat-card"><div class="stat-label">Gastos generales</div><div class="stat-valor">${formatUSD(gastosGralesTotal)}</div></div>
    `;

    elCobrado.innerHTML = `
      <div style="display:flex;justify-content:space-between;"><span>Total cobrado a clientes</span><strong>${formatUSD(totalCobrado)}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Saldo pendiente por cobrar (todas las órdenes)</span><strong>${formatUSD(saldoPendienteGlobal)}</strong></div>
      <div class="texto-tenue" style="margin-top:8px;">La ganancia de "órdenes" ya descuenta los gastos vinculados a una orden o a uno de sus paquetes. Los "gastos generales" (sin vincular) se muestran aparte y no están restados de la ganancia por orden.</div>
    `;

    if (!totales.length) {
      elOrdenes.innerHTML = '<div class="vacio">No hay órdenes todavía.</div>';
    } else {
      const filas = [...totales].sort((a, b) => Number(b.ganancia) - Number(a.ganancia));
      elOrdenes.innerHTML = `
        <div class="tabla-wrap">
          <table class="tabla">
            <thead><tr><th>Orden</th><th>Precio cliente</th><th>Costo</th><th>Ganancia</th></tr></thead>
            <tbody>
              ${filas.map((t) => `
                <tr>
                  <td><a href="#ordenes/${t.orden_id}">${escaparHTML(t.codigo)}</a></td>
                  <td>${formatUSD(t.precio_total_cliente)}</td>
                  <td>${formatUSD(t.costo_total)}</td>
                  <td>${formatUSD(t.ganancia)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (e) {
    mostrarError(elGrid, traducirError(e));
    elCobrado.innerHTML = '';
    elOrdenes.innerHTML = '';
  }
}
