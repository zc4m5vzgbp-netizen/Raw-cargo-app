import { supabase } from '../supabase.js';
import { mostrarCargando, mostrarError, mostrarVacio, mostrarExito, escaparHTML, confirmar, huboCambios } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';
import { formatUSD, formatFecha, formatEstado, formatLibras } from '../utils/formatters.js';

const ESTADOS = [
  'esperando_mercancia', 'recibido_houston', 'preparando_envio', 'enviado',
  'en_transito', 'recibido_venezuela', 'listo_entregar', 'entregado', 'cancelado',
];
const ESTADOS_BLOQUEADOS = ['entregado', 'cancelado'];

export async function render(contenedor, parametros = []) {
  const [primero, segundo] = parametros;

  if (primero === 'nuevo') {
    return renderCrearPaquete(contenedor, segundo || null);
  }
  if (primero === 'orden') {
    return renderListado(contenedor, segundo || null);
  }
  if (primero) {
    return renderDetalle(contenedor, primero);
  }
  return renderListado(contenedor, null);
}

// ---------- LISTADO ----------

async function renderListado(contenedor, ordenIdFiltro) {
  contenedor.innerHTML = `
    <div class="section-header">
      <h2 id="paquetes-titulo">Paquetes</h2>
      <a href="${ordenIdFiltro ? `#paquetes/nuevo/${ordenIdFiltro}` : '#paquetes/nuevo'}" class="btn btn-primario btn-sm">+ Nuevo paquete</a>
    </div>
    <div id="lista-paquetes"></div>
  `;

  const elLista = contenedor.querySelector('#lista-paquetes');
  mostrarCargando(elLista);

  try {
    if (ordenIdFiltro) {
      const { data: orden, error: errorOrden } = await supabase
        .from('ordenes')
        .select('codigo')
        .eq('id', ordenIdFiltro)
        .single();
      if (!errorOrden && orden) {
        contenedor.querySelector('#paquetes-titulo').textContent = `Paquetes de ${orden.codigo}`;
      }
    }

    let consulta = supabase
      .from('paquetes')
      .select('id, codigo, estado, peso_real, creado_en, ordenes(codigo, clientes(nombre, apellido))')
      .order('creado_en', { ascending: false });
    if (ordenIdFiltro) consulta = consulta.eq('orden_id', ordenIdFiltro);

    const { data: paquetes, error } = await consulta;
    if (error) throw error;

    if (!paquetes.length) {
      mostrarVacio(elLista, 'No hay paquetes todavía. Toca "+ Nuevo paquete" para crear el primero.');
      return;
    }

    elLista.innerHTML = paquetes.map((p) => {
      const cliente = p.ordenes?.clientes;
      const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido || ''}`.trim() : '—';
      return `
        <a href="#paquetes/${p.id}" class="card" style="display:block;text-decoration:none;color:inherit;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <strong>${escaparHTML(p.codigo)}</strong><br>
              <span class="texto-secundario">${escaparHTML(p.ordenes?.codigo || '—')} · ${escaparHTML(nombreCliente)}</span><br>
              <span class="texto-tenue">${formatFecha(p.creado_en)}${p.peso_real ? ` · ${formatLibras(p.peso_real)}` : ''}</span>
            </div>
            <span class="badge badge-neutro">${formatEstado(p.estado)}</span>
          </div>
        </a>
      `;
    }).join('');
  } catch (e) {
    mostrarError(elLista, traducirError(e), () => renderListado(contenedor, ordenIdFiltro));
  }
}

// ---------- CREAR ----------

async function renderCrearPaquete(contenedor, ordenIdPreseleccionada) {
  contenedor.innerHTML = `
    <div class="section-header">
      <h2>Nuevo paquete</h2>
      <a href="${ordenIdPreseleccionada ? `#paquetes/orden/${ordenIdPreseleccionada}` : '#paquetes'}" class="btn btn-fantasma btn-sm" id="link-cancelar-crear-paquete">Cancelar</a>
    </div>
    <div id="crear-paquete-error"></div>
    <form id="form-crear-paquete">
      <div class="form-grupo">
        <label class="form-label">Orden <span class="requerido">*</span></label>
        <select id="cp-orden" class="select" required ${ordenIdPreseleccionada ? 'disabled' : ''}></select>
      </div>
      <p class="texto-secundario" style="margin-top:-8px;">El peso, dimensiones y productos se agregan después de crear el paquete.</p>
      <button type="submit" class="btn btn-primario" id="btn-crear-paquete" style="width:100%">Crear paquete</button>
    </form>
  `;

  const elError = contenedor.querySelector('#crear-paquete-error');
  const elSelectOrden = contenedor.querySelector('#cp-orden');
  const elForm = contenedor.querySelector('#form-crear-paquete');
  const elBtn = contenedor.querySelector('#btn-crear-paquete');
  const elCancelar = contenedor.querySelector('#link-cancelar-crear-paquete');
  const destinoCancelar = elCancelar.getAttribute('href');

  function obtenerValoresFormulario() {
    return { orden: elSelectOrden.value };
  }
  let valoresIniciales = {};

  try {
    const { data: ordenes, error } = await supabase
      .from('ordenes')
      .select('id, codigo, clientes(nombre, apellido)')
      .order('creado_en', { ascending: false });
    if (error) throw error;

    elSelectOrden.innerHTML = ordenes.map((o) => {
      const cliente = o.clientes ? `${o.clientes.nombre} ${o.clientes.apellido || ''}`.trim() : '—';
      return `<option value="${o.id}">${escaparHTML(o.codigo)} — ${escaparHTML(cliente)}</option>`;
    }).join('');

    if (ordenIdPreseleccionada) {
      elSelectOrden.value = ordenIdPreseleccionada;
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

    const ordenId = ordenIdPreseleccionada || elSelectOrden.value;
    if (!ordenId) {
      elError.innerHTML = '<div class="banner banner-error">Debes seleccionar una orden.</div>';
      return;
    }

    const confirmado = await confirmar({ mensaje: '¿Guardar este nuevo paquete?', textoConfirmar: 'Guardar' });
    if (!confirmado) return;

    elBtn.disabled = true;
    elBtn.textContent = 'Creando...';

    try {
      const { data, error } = await supabase
        .from('paquetes')
        .insert({ orden_id: ordenId })
        .select('id')
        .single();
      if (error) throw error;

      mostrarExito('Paquete creado');
      window.location.hash = `#paquetes/${data.id}`;
    } catch (err) {
      elError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
      elBtn.disabled = false;
      elBtn.textContent = 'Crear paquete';
    }
  });
}

// ---------- DETALLE ----------

async function renderDetalle(contenedor, paqueteId) {
  contenedor.innerHTML = `<div id="detalle-paquete"></div>`;
  const el = contenedor.querySelector('#detalle-paquete');
  mostrarCargando(el, 5);

  try {
    await cargarDetalle(contenedor, paqueteId);
  } catch (e) {
    mostrarError(el, traducirError(e), () => renderDetalle(contenedor, paqueteId));
  }
}

async function cargarDetalle(contenedor, paqueteId) {
  const el = contenedor.querySelector('#detalle-paquete');

  const { data: paquete, error: errorPaquete } = await supabase
    .from('paquetes')
    .select('*, ordenes(id, codigo, cliente_id, clientes(nombre, apellido))')
    .eq('id', paqueteId)
    .single();
  if (errorPaquete) throw errorPaquete;

  const [{ data: asignaciones, error: errorAsig }, { data: productosOrden, error: errorProd }] = await Promise.all([
    supabase.from('producto_paquete')
      .select('id, cantidad_asignada, precio_unitario_snapshot, valor_asignado, productos(id, nombre)')
      .eq('paquete_id', paqueteId),
    supabase.from('productos')
      .select('id, nombre, cantidad, precio_unitario')
      .eq('orden_id', paquete.orden_id),
  ]);
  if (errorAsig) throw errorAsig;
  if (errorProd) throw errorProd;

  // Cuánto de cada producto de la orden ya está asignado (a este paquete u otros)
  const idsProductos = productosOrden.map((p) => p.id);
  let asignadoPorProducto = {};
  if (idsProductos.length) {
    const { data: todasAsig, error: errorTodas } = await supabase
      .from('producto_paquete')
      .select('producto_id, cantidad_asignada')
      .in('producto_id', idsProductos);
    if (errorTodas) throw errorTodas;
    asignadoPorProducto = (todasAsig || []).reduce((acc, r) => {
      acc[r.producto_id] = (acc[r.producto_id] || 0) + Number(r.cantidad_asignada);
      return acc;
    }, {});
  }

  const idsYaEnEstePaquete = new Set(asignaciones.map((a) => a.productos?.id));
  const candidatos = productosOrden
    .filter((p) => !idsYaEnEstePaquete.has(p.id))
    .map((p) => ({ ...p, disponible: p.cantidad - (asignadoPorProducto[p.id] || 0) }))
    .filter((p) => p.disponible > 0);

  const bloqueado = ESTADOS_BLOQUEADOS.includes(paquete.estado);
  const orden = paquete.ordenes;
  const nombreCliente = orden?.clientes ? `${orden.clientes.nombre} ${orden.clientes.apellido || ''}`.trim() : '—';

  el.innerHTML = `
    <div class="section-header">
      <h2>${escaparHTML(paquete.codigo)}</h2>
      <a href="#paquetes" class="btn btn-fantasma btn-sm">← Volver</a>
    </div>

    <div class="card">
      <div><span class="texto-secundario">Orden</span><br><a href="#ordenes/${paquete.orden_id}">${escaparHTML(orden?.codigo || '—')}</a></div>
      <div style="margin-top:8px;"><span class="texto-secundario">Cliente</span><br>${escaparHTML(nombreCliente)}</div>
      <div style="margin-top:8px;">
        <span class="texto-secundario">Estado</span><br>
        ${bloqueado
          ? `${formatEstado(paquete.estado)} — estado final, no puede modificarse`
          : `<select id="detalle-paquete-estado" class="select">
              ${ESTADOS.map((estVal) => `<option value="${estVal}" ${estVal === paquete.estado ? 'selected' : ''}>${formatEstado(estVal)}</option>`).join('')}
            </select>
            <div id="detalle-paquete-estado-error"></div>`
        }
      </div>
    </div>

    <div class="section-header"><h3>Peso y dimensiones</h3></div>
    <div class="card">
      ${bloqueado ? `
        <div>${paquete.peso_real ? formatLibras(paquete.peso_real) : 'Sin peso registrado'}${paquete.largo ? ` · ${paquete.largo}×${paquete.ancho}×${paquete.alto} ${paquete.unidad}` : ''}</div>
      ` : `
        <div id="peso-form-error"></div>
        <form id="form-peso">
          <div class="form-grupo">
            <label class="form-label">Peso real (lb)</label>
            <input type="number" id="pp-peso" class="input" min="0" step="0.01" value="${paquete.peso_real ?? ''}">
          </div>
          <div style="display:flex;gap:8px;">
            <div class="form-grupo" style="flex:1;"><label class="form-label">Largo</label><input type="number" id="pp-largo" class="input" min="0" step="0.01" value="${paquete.largo ?? ''}"></div>
            <div class="form-grupo" style="flex:1;"><label class="form-label">Ancho</label><input type="number" id="pp-ancho" class="input" min="0" step="0.01" value="${paquete.ancho ?? ''}"></div>
            <div class="form-grupo" style="flex:1;"><label class="form-label">Alto</label><input type="number" id="pp-alto" class="input" min="0" step="0.01" value="${paquete.alto ?? ''}"></div>
          </div>
          <div class="form-grupo">
            <label class="form-label">Unidad</label>
            <select id="pp-unidad" class="select">
              <option value="in" ${paquete.unidad === 'in' ? 'selected' : ''}>Pulgadas (in)</option>
              <option value="cm" ${paquete.unidad === 'cm' ? 'selected' : ''}>Centímetros (cm)</option>
            </select>
          </div>
          <button type="submit" class="btn btn-secundario" id="btn-guardar-peso">Guardar peso y dimensiones</button>
        </form>
      `}
    </div>

    <div class="section-header"><h3>Productos en este paquete</h3></div>
    <div id="lista-asignaciones">
      ${asignaciones.length ? asignaciones.map((a) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span>${escaparHTML(a.productos?.nombre || '—')} × ${a.cantidad_asignada}</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <strong>${formatUSD(a.valor_asignado)}</strong>
              ${!bloqueado ? `<button class="btn btn-fantasma btn-sm" data-quitar="${a.id}">Quitar</button>` : ''}
            </div>
          </div>
        </div>
      `).join('') : '<div class="vacio">Sin productos asignados todavía.</div>'}
    </div>

    ${!bloqueado ? `
      <div id="asignar-form-error"></div>
      ${candidatos.length ? `
        <form id="form-asignar-producto" style="margin-top:12px;">
          <div class="form-grupo">
            <label class="form-label">Producto de la orden <span class="requerido">*</span></label>
            <select id="ap-producto" class="select" required>
              ${candidatos.map((p) => `<option value="${p.id}" data-disponible="${p.disponible}" data-precio="${p.precio_unitario}">${escaparHTML(p.nombre)} (disponible: ${p.disponible})</option>`).join('')}
            </select>
          </div>
          <div class="form-grupo">
            <label class="form-label">Cantidad a asignar <span class="requerido">*</span></label>
            <input type="number" id="ap-cantidad" class="input" min="0.01" step="any" required>
          </div>
          <button type="submit" class="btn btn-secundario" id="btn-asignar-producto" style="width:100%">+ Asignar producto</button>
        </form>
      ` : '<p class="texto-secundario">No hay productos de esta orden disponibles para asignar (ya están todos asignados, o la orden no tiene productos).</p>'}
    ` : ''}
  `;

  if (!bloqueado) {
    // --- Cambiar estado ---
    el.querySelector('#detalle-paquete-estado').addEventListener('change', async (e) => {
      const nuevoEstado = e.target.value;
      const elEstadoError = el.querySelector('#detalle-paquete-estado-error');
      try {
        const { error } = await supabase.from('paquetes').update({ estado: nuevoEstado }).eq('id', paqueteId);
        if (error) throw error;
        mostrarExito('Estado actualizado');
        await cargarDetalle(contenedor, paqueteId);
      } catch (err) {
        elEstadoError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
        e.target.value = paquete.estado;
      }
    });

    // --- Guardar peso/dimensiones ---
    const elFormPeso = el.querySelector('#form-peso');
    elFormPeso.addEventListener('submit', async (e) => {
      e.preventDefault();
      const elPesoError = el.querySelector('#peso-form-error');
      elPesoError.innerHTML = '';

      const confirmado = await confirmar({ mensaje: '¿Guardar peso y dimensiones?', textoConfirmar: 'Guardar' });
      if (!confirmado) return;

      const btn = el.querySelector('#btn-guardar-peso');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      const val = (id) => {
        const v = el.querySelector(id).value;
        return v === '' ? null : Number(v);
      };

      try {
        const { error } = await supabase.from('paquetes').update({
          peso_real: val('#pp-peso'),
          largo: val('#pp-largo'),
          ancho: val('#pp-ancho'),
          alto: val('#pp-alto'),
          unidad: el.querySelector('#pp-unidad').value,
        }).eq('id', paqueteId);
        if (error) throw error;
        mostrarExito('Peso y dimensiones actualizados');
        await cargarDetalle(contenedor, paqueteId);
      } catch (err) {
        elPesoError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
        btn.disabled = false;
        btn.textContent = 'Guardar peso y dimensiones';
      }
    });

    // --- Quitar producto asignado ---
    el.querySelectorAll('[data-quitar]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const confirmado = await confirmar({
          mensaje: '¿Quitar este producto del paquete?',
          textoConfirmar: 'Quitar',
        });
        if (!confirmado) return;
        try {
          const { error } = await supabase.from('producto_paquete').delete().eq('id', btn.dataset.quitar);
          if (error) throw error;
          mostrarExito('Producto quitado');
          await cargarDetalle(contenedor, paqueteId);
        } catch (err) {
          mostrarError(el.querySelector('#lista-asignaciones'), traducirError(err));
        }
      });
    });

    // --- Asignar producto nuevo ---
    const elFormAsignar = el.querySelector('#form-asignar-producto');
    if (elFormAsignar) {
      elFormAsignar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const elAsignarError = el.querySelector('#asignar-form-error');
        elAsignarError.innerHTML = '';

        const productoId = el.querySelector('#ap-producto').value;
        const cantidad = Number(el.querySelector('#ap-cantidad').value);
        const opcionSeleccionada = el.querySelector('#ap-producto').selectedOptions[0];
        const disponible = Number(opcionSeleccionada?.dataset.disponible || 0);

        if (!productoId || !cantidad || cantidad <= 0) {
          elAsignarError.innerHTML = '<div class="banner banner-error">Selecciona un producto y una cantidad válida.</div>';
          return;
        }
        if (cantidad > disponible) {
          elAsignarError.innerHTML = `<div class="banner banner-error">Solo hay ${disponible} unidades disponibles de ese producto.</div>`;
          return;
        }

        const btn = el.querySelector('#btn-asignar-producto');
        btn.disabled = true;
        btn.textContent = 'Asignando...';

        try {
          const { error } = await supabase.from('producto_paquete').insert({
            paquete_id: paqueteId,
            producto_id: productoId,
            cantidad_asignada: cantidad,
          });
          if (error) throw error;
          mostrarExito('Producto asignado');
          await cargarDetalle(contenedor, paqueteId);
        } catch (err) {
          elAsignarError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
          btn.disabled = false;
          btn.textContent = '+ Asignar producto';
        }
      });
    }
  }
}
