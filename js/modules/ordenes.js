import { supabase } from '../supabase.js';
import { mostrarCargando, mostrarError, mostrarVacio, mostrarExito, escaparHTML } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';
import { formatUSD, formatFecha, formatEstado, formatTipoOperacion } from '../utils/formatters.js';

const ESTADOS = ['pendiente_pago', 'pagado', 'en_proceso', 'completada', 'cancelada'];
const ESTADOS_BLOQUEADOS = ['completada', 'cancelada'];

export async function render(contenedor, parametros = []) {
  const [primero, segundo] = parametros;

  if (primero === 'nuevo') {
    return renderCrearOrden(contenedor, segundo || null);
  }
  if (primero === 'cliente') {
    return renderListado(contenedor, segundo || null);
  }
  if (primero) {
    return renderDetalle(contenedor, primero);
  }
  return renderListado(contenedor, null);
}

// ---------- LISTADO ----------

async function renderListado(contenedor, clienteIdFiltro) {
  contenedor.innerHTML = `
    <div class="section-header">
      <h2 id="ordenes-titulo">Órdenes</h2>
      <a href="${clienteIdFiltro ? `#ordenes/nuevo/${clienteIdFiltro}` : '#ordenes/nuevo'}" class="btn btn-primario btn-sm">+ Nueva orden</a>
    </div>
    <div id="lista-ordenes"></div>
  `;

  const elLista = contenedor.querySelector('#lista-ordenes');
  mostrarCargando(elLista);

  try {
    if (clienteIdFiltro) {
      const { data: cliente, error: errorCliente } = await supabase
        .from('clientes')
        .select('nombre, apellido')
        .eq('id', clienteIdFiltro)
        .single();
      if (!errorCliente && cliente) {
        contenedor.querySelector('#ordenes-titulo').textContent =
          `Órdenes de ${cliente.nombre} ${cliente.apellido || ''}`.trim();
      }
    }

    let consulta = supabase
      .from('ordenes')
      .select('id, codigo, estado, tipo_operacion, creado_en, clientes(nombre, apellido)')
      .order('creado_en', { ascending: false });
    if (clienteIdFiltro) consulta = consulta.eq('cliente_id', clienteIdFiltro);

    const [{ data: ordenes, error: errorOrdenes }, { data: totales, error: errorTotales }] = await Promise.all([
      consulta,
      supabase.from('v_orden_totales').select('orden_id, precio_total_cliente'),
    ]);
    if (errorOrdenes) throw errorOrdenes;
    if (errorTotales) throw errorTotales;

    if (!ordenes.length) {
      mostrarVacio(elLista, 'No hay órdenes todavía. Toca "+ Nueva orden" para crear la primera.');
      return;
    }

    const totalesPorId = Object.fromEntries((totales || []).map((t) => [t.orden_id, t]));

    elLista.innerHTML = ordenes.map((o) => {
      const total = totalesPorId[o.id];
      const nombreCliente = o.clientes ? `${o.clientes.nombre} ${o.clientes.apellido || ''}`.trim() : '—';
      return `
        <a href="#ordenes/${o.id}" class="card" style="display:block;text-decoration:none;color:inherit;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <strong>${escaparHTML(o.codigo)}</strong><br>
              <span class="texto-secundario">${escaparHTML(nombreCliente)}</span><br>
              <span class="texto-tenue">${formatFecha(o.creado_en)} · ${formatTipoOperacion(o.tipo_operacion)}</span>
            </div>
            <div style="text-align:right;">
              <span>${formatEstado(o.estado)}</span><br>
              <strong>${total ? formatUSD(total.precio_total_cliente) : '—'}</strong>
            </div>
          </div>
        </a>
      `;
    }).join('');
  } catch (e) {
    mostrarError(elLista, traducirError(e), () => renderListado(contenedor, clienteIdFiltro));
  }
}

// ---------- CREAR ----------

async function renderCrearOrden(contenedor, clienteIdPreseleccionado) {
  contenedor.innerHTML = `
    <div class="section-header">
      <h2>Nueva orden</h2>
      <a href="${clienteIdPreseleccionado ? `#ordenes/cliente/${clienteIdPreseleccionado}` : '#ordenes'}" class="btn btn-fantasma btn-sm">Cancelar</a>
    </div>
    <div id="crear-orden-error"></div>
    <form id="form-crear-orden">
      <div class="form-grupo">
        <label class="form-label">Cliente <span class="requerido">*</span></label>
        <select id="co-cliente" class="input" required ${clienteIdPreseleccionado ? 'disabled' : ''}></select>
      </div>
      <div class="form-grupo">
        <label class="form-label">Tipo de operación <span class="requerido">*</span></label>
        <select id="co-tipo" class="input" required>
          <option value="personal_shopper">Personal Shopper</option>
          <option value="envio">Envío</option>
          <option value="personal_shopper_envio">Personal Shopper + Envío</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primario" id="btn-crear-orden" style="width:100%">Crear orden</button>
    </form>
  `;

  const elError = contenedor.querySelector('#crear-orden-error');
  const elSelectCliente = contenedor.querySelector('#co-cliente');
  const elForm = contenedor.querySelector('#form-crear-orden');
  const elBtn = contenedor.querySelector('#btn-crear-orden');

  try {
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('id, nombre, apellido')
      .order('nombre');
    if (error) throw error;

    elSelectCliente.innerHTML = clientes.map((c) =>
      `<option value="${c.id}">${escaparHTML(c.nombre)} ${escaparHTML(c.apellido || '')}</option>`
    ).join('');

    if (clienteIdPreseleccionado) {
      elSelectCliente.value = clienteIdPreseleccionado;
    }
  } catch (e) {
    elError.innerHTML = `<div class="banner banner-error">${traducirError(e)}</div>`;
    return;
  }

  elForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elError.innerHTML = '';

    const clienteId = clienteIdPreseleccionado || elSelectCliente.value;
    const tipoOperacion = contenedor.querySelector('#co-tipo').value;

    if (!clienteId) {
      elError.innerHTML = '<div class="banner banner-error">Debes seleccionar un cliente.</div>';
      return;
    }

    elBtn.disabled = true;
    elBtn.textContent = 'Creando...';

    try {
      const { data, error } = await supabase
        .from('ordenes')
        .insert({ cliente_id: clienteId, tipo_operacion: tipoOperacion })
        .select('id')
        .single();
      if (error) throw error;

      mostrarExito('Orden creada');
      window.location.hash = `#ordenes/${data.id}`;
    } catch (err) {
      elError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
      elBtn.disabled = false;
      elBtn.textContent = 'Crear orden';
    }
  });
}

// ---------- DETALLE ----------

async function renderDetalle(contenedor, ordenId) {
  contenedor.innerHTML = `<div id="detalle-orden"></div>`;
  const el = contenedor.querySelector('#detalle-orden');
  mostrarCargando(el, 5);

  try {
    await cargarDetalle(contenedor, ordenId);
  } catch (e) {
    mostrarError(el, traducirError(e), () => renderDetalle(contenedor, ordenId));
  }
}

async function cargarDetalle(contenedor, ordenId) {
  const el = contenedor.querySelector('#detalle-orden');

  const [{ data: orden, error: errorOrden }, { data: productos, error: errorProductos }, { data: totales, error: errorTotales }] =
    await Promise.all([
      supabase.from('ordenes').select('*, clientes(id, nombre, apellido)').eq('id', ordenId).single(),
      supabase.from('productos').select('id, nombre, cantidad, precio_unitario, total').eq('orden_id', ordenId),
      supabase.from('v_orden_totales').select('*').eq('orden_id', ordenId).single(),
    ]);

  if (errorOrden) throw errorOrden;
  if (errorProductos) throw errorProductos;
  if (errorTotales) throw errorTotales;

  const bloqueada = ESTADOS_BLOQUEADOS.includes(orden.estado);
  const nombreCliente = orden.clientes ? `${orden.clientes.nombre} ${orden.clientes.apellido || ''}`.trim() : '—';

  el.innerHTML = `
    <div class="section-header">
      <h2>${escaparHTML(orden.codigo)}</h2>
      <a href="#ordenes" class="btn btn-fantasma btn-sm">← Volver</a>
    </div>

    <div class="card">
      <div><span class="texto-secundario">Cliente</span><br><a href="#ordenes/cliente/${orden.cliente_id}">${escaparHTML(nombreCliente)}</a></div>
      <div style="margin-top:8px;"><span class="texto-secundario">Fecha</span><br>${formatFecha(orden.creado_en)}</div>
      <div style="margin-top:8px;"><span class="texto-secundario">Tipo de operación</span><br>${formatTipoOperacion(orden.tipo_operacion)}</div>
      <div style="margin-top:8px;">
        <span class="texto-secundario">Estado</span><br>
        ${bloqueada
          ? `${formatEstado(orden.estado)} — estado final, no puede modificarse`
          : `<select id="detalle-estado" class="input">
              ${ESTADOS.map((estVal) => `<option value="${estVal}" ${estVal === orden.estado ? 'selected' : ''}>${formatEstado(estVal)}</option>`).join('')}
            </select>
            <div id="detalle-estado-error"></div>`
        }
      </div>
    </div>

    <div class="section-header"><h3>Productos</h3></div>
    <div id="lista-productos">
      ${productos.length ? productos.map((p) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;">
            <span>${escaparHTML(p.nombre)} × ${p.cantidad}</span>
            <strong>${formatUSD(p.total)}</strong>
          </div>
          <span class="texto-tenue">${formatUSD(p.precio_unitario)} c/u</span>
        </div>
      `).join('') : '<div class="vacio">Sin productos todavía.</div>'}
    </div>

    ${!bloqueada ? `
      <div id="producto-form-error"></div>
      <form id="form-agregar-producto" style="margin-top:12px;">
        <div class="form-grupo">
          <label class="form-label">Producto <span class="requerido">*</span></label>
          <input type="text" id="pf-nombre" class="input" required>
        </div>
        <div class="form-grupo">
          <label class="form-label">Cantidad <span class="requerido">*</span></label>
          <input type="number" id="pf-cantidad" class="input" min="0.01" step="any" required>
        </div>
        <div class="form-grupo">
          <label class="form-label">Precio unitario <span class="requerido">*</span></label>
          <input type="number" id="pf-precio" class="input" min="0" step="0.01" required>
        </div>
        <button type="submit" class="btn btn-secundario" id="btn-agregar-producto" style="width:100%">+ Agregar producto</button>
      </form>
    ` : ''}

    <div class="section-header"><h3>Totales</h3></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;"><span>Precio total al cliente</span><strong>${formatUSD(totales.precio_total_cliente)}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Costo total</span><span>${formatUSD(totales.costo_total)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Ganancia</span><strong>${formatUSD(totales.ganancia)}</strong></div>
    </div>
  `;

  if (!bloqueada) {
    el.querySelector('#detalle-estado').addEventListener('change', async (e) => {
      const nuevoEstado = e.target.value;
      const elEstadoError = el.querySelector('#detalle-estado-error');
      try {
        const { error } = await supabase.from('ordenes').update({ estado: nuevoEstado }).eq('id', ordenId);
        if (error) throw error;
        mostrarExito('Estado actualizado');
        await cargarDetalle(contenedor, ordenId);
      } catch (err) {
        elEstadoError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
        e.target.value = orden.estado;
      }
    });

    const elFormProducto = el.querySelector('#form-agregar-producto');
    const elProductoError = el.querySelector('#producto-form-error');
    elFormProducto.addEventListener('submit', async (e) => {
      e.preventDefault();
      elProductoError.innerHTML = '';
      const nombre = el.querySelector('#pf-nombre').value.trim();
      const cantidad = Number(el.querySelector('#pf-cantidad').value);
      const precioUnitario = Number(el.querySelector('#pf-precio').value);

      if (!nombre || !cantidad || precioUnitario < 0) {
        elProductoError.innerHTML = '<div class="banner banner-error">Completa todos los campos correctamente.</div>';
        return;
      }

      const btn = el.querySelector('#btn-agregar-producto');
      btn.disabled = true;
      btn.textContent = 'Agregando...';

      try {
        const { error } = await supabase
          .from('productos')
          .insert({ orden_id: ordenId, nombre, cantidad, precio_unitario: precioUnitario });
        if (error) throw error;
        mostrarExito('Producto agregado');
        await cargarDetalle(contenedor, ordenId);
      } catch (err) {
        elProductoError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
        btn.disabled = false;
        btn.textContent = '+ Agregar producto';
      }
    });
  }
}
