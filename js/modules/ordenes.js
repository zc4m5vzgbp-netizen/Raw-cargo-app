import { supabase } from '../supabase.js';
import { mostrarCargando, mostrarError, mostrarVacio, mostrarExito, escaparHTML, confirmar, huboCambios } from '../utils/ui.js';
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
  if (primero === 'activas') {
    return renderListado(contenedor, null, { soloActivas: true });
  }
  if (primero) {
    return renderDetalle(contenedor, primero);
  }
  return renderListado(contenedor, null);
}

// ---------- LISTADO (con Seleccionar / Eliminar) ----------

async function renderListado(contenedor, clienteIdFiltro, opciones = {}) {
  const { soloActivas = false } = opciones;
  contenedor.innerHTML = `
    <div class="section-header">
      <h2 id="ordenes-titulo">Órdenes</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secundario btn-sm" id="btn-seleccionar">Seleccionar</button>
        <a href="${clienteIdFiltro ? `#ordenes/nuevo/${clienteIdFiltro}` : '#ordenes/nuevo'}" class="btn btn-primario btn-sm">+ Nueva orden</a>
      </div>
    </div>
    <div id="barra-seleccion" hidden style="display:flex;gap:8px;margin-bottom:8px;">
      <button class="btn btn-secundario btn-sm" id="btn-cancelar-seleccion">Cancelar selección</button>
      <button class="btn btn-primario btn-sm" id="btn-eliminar-seleccionadas" disabled>Eliminar seleccionadas (0)</button>
    </div>
    <div id="confirmar-eliminar"></div>
    <div id="lista-ordenes"></div>
  `;

  const elLista = contenedor.querySelector('#lista-ordenes');
  const elBtnSeleccionar = contenedor.querySelector('#btn-seleccionar');
  const elBarraSeleccion = contenedor.querySelector('#barra-seleccion');
  const elBtnCancelarSeleccion = contenedor.querySelector('#btn-cancelar-seleccion');
  const elBtnEliminarSeleccionadas = contenedor.querySelector('#btn-eliminar-seleccionadas');
  const elConfirmar = contenedor.querySelector('#confirmar-eliminar');

  mostrarCargando(elLista);

  let seleccionando = false;
  const seleccionados = new Set();
  let ordenesData = [];
  let totalesPorId = {};
  let mapaElegibilidad = {};

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
    } else if (soloActivas) {
      contenedor.querySelector('#ordenes-titulo').textContent = 'Órdenes activas';
    }

    let consulta = supabase
      .from('ordenes')
      .select('id, codigo, estado, tipo_operacion, creado_en, clientes(nombre, apellido)')
      .order('creado_en', { ascending: false });
    if (clienteIdFiltro) consulta = consulta.eq('cliente_id', clienteIdFiltro);
    if (soloActivas) consulta = consulta.not('estado', 'in', `(${ESTADOS_BLOQUEADOS.join(',')})`);

    const [
      { data: ordenes, error: errorOrdenes },
      { data: totales, error: errorTotales },
      { data: paquetesRows, error: errorPaquetes },
      { data: pagosRows, error: errorPagos },
      { data: gastosRows, error: errorGastos },
    ] = await Promise.all([
      consulta,
      supabase.from('v_orden_totales').select('orden_id, precio_total_cliente'),
      supabase.from('paquetes').select('orden_id'),
      supabase.from('pagos').select('orden_id'),
      supabase.from('gastos').select('orden_id'),
    ]);
    if (errorOrdenes) throw errorOrdenes;
    if (errorTotales) throw errorTotales;
    if (errorPaquetes) throw errorPaquetes;
    if (errorPagos) throw errorPagos;
    if (errorGastos) throw errorGastos;

    ordenesData = ordenes;
    totalesPorId = Object.fromEntries((totales || []).map((t) => [t.orden_id, t]));
    const idsConPaquete = new Set((paquetesRows || []).map((r) => r.orden_id));
    const idsConPago = new Set((pagosRows || []).map((r) => r.orden_id));
    const idsConGasto = new Set((gastosRows || []).map((r) => r.orden_id));

    mapaElegibilidad = Object.fromEntries(ordenes.map((o) => {
      const razones = [];
      if (ESTADOS_BLOQUEADOS.includes(o.estado)) razones.push(`ya está "${formatEstado(o.estado)}"`);
      if (idsConPaquete.has(o.id)) razones.push('tiene paquetes asociados');
      if (idsConPago.has(o.id)) razones.push('tiene pagos registrados');
      if (idsConGasto.has(o.id)) razones.push('tiene gastos registrados');
      return [o.id, { eliminable: razones.length === 0, razones, codigo: o.codigo }];
    }));

    if (!ordenes.length) {
      mostrarVacio(elLista, 'No hay órdenes todavía. Toca "+ Nueva orden" para crear la primera.');
      return;
    }

    pintarFilas();
  } catch (e) {
    mostrarError(elLista, traducirError(e), () => renderListado(contenedor, clienteIdFiltro, opciones));
    return;
  }

  function pintarFilas() {
    elLista.innerHTML = ordenesData.map((o) => {
      const total = totalesPorId[o.id];
      const nombreCliente = o.clientes ? `${o.clientes.nombre} ${o.clientes.apellido || ''}`.trim() : '—';
      const filaInterna = `
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
      `;

      if (seleccionando) {
        return `
          <div class="card" data-fila="${o.id}" style="display:flex;gap:10px;align-items:flex-start;">
            <input type="checkbox" data-check="${o.id}" ${seleccionados.has(o.id) ? 'checked' : ''} style="margin-top:4px;">
            <div style="flex:1;">${filaInterna}</div>
          </div>
        `;
      }
      return `<a href="#ordenes/${o.id}" class="card" style="display:block;text-decoration:none;color:inherit;">${filaInterna}</a>`;
    }).join('');

    if (seleccionando) {
      elLista.querySelectorAll('[data-fila]').forEach((fila) => {
        const id = fila.dataset.fila;
        const chk = fila.querySelector('input[type="checkbox"]');
        fila.addEventListener('click', (e) => {
          if (e.target === chk) return;
          chk.checked = !chk.checked;
          chk.dispatchEvent(new Event('change'));
        });
        chk.addEventListener('change', () => {
          if (chk.checked) seleccionados.add(id);
          else seleccionados.delete(id);
          actualizarBarra();
        });
      });
    }
  }

  function actualizarBarra() {
    elBtnEliminarSeleccionadas.textContent = `Eliminar seleccionadas (${seleccionados.size})`;
    elBtnEliminarSeleccionadas.disabled = seleccionados.size === 0;
  }

  elBtnSeleccionar.addEventListener('click', () => {
    seleccionando = true;
    seleccionados.clear();
    elBtnSeleccionar.hidden = true;
    elBarraSeleccion.hidden = false;
    elConfirmar.innerHTML = '';
    actualizarBarra();
    pintarFilas();
  });

  elBtnCancelarSeleccion.addEventListener('click', () => {
    seleccionando = false;
    seleccionados.clear();
    elBtnSeleccionar.hidden = false;
    elBarraSeleccion.hidden = true;
    elConfirmar.innerHTML = '';
    pintarFilas();
  });

  elBtnEliminarSeleccionadas.addEventListener('click', () => {
    const idsSeleccionados = [...seleccionados];
    const eliminables = idsSeleccionados.filter((id) => mapaElegibilidad[id]?.eliminable);
    const bloqueadas = idsSeleccionados.filter((id) => !mapaElegibilidad[id]?.eliminable);

    let html = '<div class="card">';
    if (bloqueadas.length) {
      html += `
        <div class="banner banner-error">
          ${bloqueadas.length} de ${idsSeleccionados.length} orden(es) seleccionada(s) NO se puede(n) eliminar:
          <ul style="margin:8px 0 0 18px;">
            ${bloqueadas.map((id) => `<li>${escaparHTML(mapaElegibilidad[id].codigo)}: ${escaparHTML(mapaElegibilidad[id].razones.join(', '))}. Considera usar el estado "Cancelada" en su lugar.</li>`).join('')}
          </ul>
        </div>
      `;
    }
    if (eliminables.length) {
      html += `
        <p style="margin-top:${bloqueadas.length ? '12px' : '0'};">
          ¿Eliminar ${eliminables.length} orden(es) (${eliminables.map((id) => escaparHTML(mapaElegibilidad[id].codigo)).join(', ')})?
          Sus productos asociados también se eliminarán automáticamente. Esta acción no se puede deshacer.
        </p>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-secundario btn-sm" id="btn-cancelar-confirmacion">Cancelar</button>
          <button class="btn btn-primario btn-sm" id="btn-confirmar-eliminacion">Sí, eliminar ${eliminables.length}</button>
        </div>
      `;
    } else {
      html += `
        <p style="margin-top:${bloqueadas.length ? '12px' : '0'};">Ninguna de las órdenes seleccionadas se puede eliminar.</p>
        <button class="btn btn-secundario btn-sm" id="btn-cancelar-confirmacion">Cerrar</button>
      `;
    }
    html += '</div>';
    elConfirmar.innerHTML = html;

    elConfirmar.querySelector('#btn-cancelar-confirmacion').addEventListener('click', () => {
      elConfirmar.innerHTML = '';
    });

    const btnConfirmar = elConfirmar.querySelector('#btn-confirmar-eliminacion');
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', async () => {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Eliminando...';
        try {
          const { error } = await supabase.from('ordenes').delete().in('id', eliminables);
          if (error) throw error;
          mostrarExito(`${eliminables.length} orden(es) eliminada(s)`);
          await renderListado(contenedor, clienteIdFiltro, opciones);
        } catch (err) {
          elConfirmar.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
        }
      });
    }
  });
}

// ---------- CREAR ----------

async function renderCrearOrden(contenedor, clienteIdPreseleccionado) {
  contenedor.innerHTML = `
    <div class="section-header">
      <h2>Nueva orden</h2>
      <a href="${clienteIdPreseleccionado ? `#ordenes/cliente/${clienteIdPreseleccionado}` : '#ordenes'}" class="btn btn-fantasma btn-sm" id="link-cancelar-crear-orden">Cancelar</a>
    </div>
    <div id="crear-orden-error"></div>
    <form id="form-crear-orden">
      <div class="form-grupo">
        <label class="form-label">Cliente <span class="requerido">*</span></label>
        <select id="co-cliente" class="select" required ${clienteIdPreseleccionado ? 'disabled' : ''}></select>
      </div>
      <div class="form-grupo">
        <label class="form-label">Tipo de operación <span class="requerido">*</span></label>
        <select id="co-tipo" class="select" required>
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
  const elSelectTipo = contenedor.querySelector('#co-tipo');
  const elForm = contenedor.querySelector('#form-crear-orden');
  const elBtn = contenedor.querySelector('#btn-crear-orden');
  const elCancelar = contenedor.querySelector('#link-cancelar-crear-orden');
  const destinoCancelar = elCancelar.getAttribute('href');

  function obtenerValoresFormulario() {
    return { cliente: elSelectCliente.value, tipo: elSelectTipo.value };
  }

  let valoresIniciales = {};

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

    valoresIniciales = obtenerValoresFormulario();
  } catch (e) {
    elError.innerHTML = `<div class="banner banner-error">${traducirError(e)}</div>`;
    return;
  }

  elCancelar.addEventListener('click', async (e) => {
    e.preventDefault();
    if (huboCambios(valoresIniciales, obtenerValoresFormulario())) {
      const salir = await confirmar({
        mensaje: '¿Seguro que quieres salir sin guardar?',
        detalle: 'Los cambios que has realizado se perderán.',
        textoConfirmar: 'Salir sin guardar',
        textoCancelar: 'Seguir editando',
        primarioEs: 'cancelar',
      });
      if (!salir) return;
    }
    window.location.hash = destinoCancelar;
  });

  elForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elError.innerHTML = '';

    const clienteId = clienteIdPreseleccionado || elSelectCliente.value;
    const tipoOperacion = elSelectTipo.value;

    if (!clienteId) {
      elError.innerHTML = '<div class="banner banner-error">Debes seleccionar un cliente.</div>';
      return;
    }

    const confirmado = await confirmar({ mensaje: '¿Guardar esta nueva orden?', textoConfirmar: 'Guardar' });
    if (!confirmado) return;

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
          : `<select id="detalle-estado" class="select">
              ${ESTADOS.map((estVal) => `<option value="${estVal}" ${estVal === orden.estado ? 'selected' : ''}>${formatEstado(estVal)}</option>`).join('')}
            </select>
            <div id="detalle-estado-error"></div>`
        }
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <a href="#paquetes/orden/${orden.id}" class="btn btn-secundario btn-sm">Ver paquetes</a>
        <a href="#paquetes/nuevo/${orden.id}" class="btn btn-secundario btn-sm">+ Nuevo paquete</a>
        <a href="#pagos/orden/${orden.id}" class="btn btn-secundario btn-sm">Ver pagos</a>
        <a href="#pagos/nuevo/${orden.id}" class="btn btn-secundario btn-sm">+ Registrar pago</a>
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
      <div style="display:flex;justify-content:space-between;"><span>Valor de la mercancía</span><span>${formatUSD(orden.valor_mercancia_total)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Precio total al cliente</span><strong>${formatUSD(totales.precio_total_cliente)}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Costo total</span><span>${formatUSD(totales.costo_total)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Ganancia</span><strong>${formatUSD(totales.ganancia)}</strong></div>
      <div class="texto-tenue" style="margin-top:8px;">Envío, seguro, costo de proveedor y ganancia se calculan a partir de los paquetes de la orden.</div>
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

      const confirmado = await confirmar({ mensaje: '¿Guardar este producto?', textoConfirmar: 'Guardar' });
      if (!confirmado) return;

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
