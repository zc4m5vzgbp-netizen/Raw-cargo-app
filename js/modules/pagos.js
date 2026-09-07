import { supabase } from '../supabase.js';
import { mostrarCargando, mostrarError, mostrarVacio, mostrarExito, escaparHTML, confirmar, huboCambios } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';
import { formatUSD, formatFecha } from '../utils/formatters.js';

const ESTADOS_ORDEN_BLOQUEADOS = ['completada', 'cancelada'];

export async function render(contenedor, parametros = []) {
  const [primero, segundo] = parametros;

  if (primero === 'nuevo') {
    return renderCrearPago(contenedor, segundo || null);
  }
  if (primero === 'orden') {
    return renderListado(contenedor, segundo || null);
  }
  return renderListado(contenedor, null);
}

// ---------- LISTADO ----------

async function renderListado(contenedor, ordenIdFiltro) {
  contenedor.innerHTML = `
    <div class="section-header">
      <h2 id="pagos-titulo">Pagos</h2>
      <a href="${ordenIdFiltro ? `#pagos/nuevo/${ordenIdFiltro}` : '#pagos/nuevo'}" class="btn btn-primario btn-sm">+ Registrar pago</a>
    </div>
    <div id="saldo-orden"></div>
    <div id="lista-pagos"></div>
  `;

  const elLista = contenedor.querySelector('#lista-pagos');
  const elSaldo = contenedor.querySelector('#saldo-orden');
  mostrarCargando(elLista);

  try {
    if (ordenIdFiltro) {
      const { data: orden, error: errorOrden } = await supabase
        .from('ordenes')
        .select('codigo, estado')
        .eq('id', ordenIdFiltro)
        .single();
      if (!errorOrden && orden) {
        contenedor.querySelector('#pagos-titulo').textContent = `Pagos de ${orden.codigo}`;
      }

      const { data: totales } = await supabase
        .from('v_orden_totales')
        .select('precio_total_cliente')
        .eq('orden_id', ordenIdFiltro)
        .single();

      const { data: pagosOrden } = await supabase
        .from('pagos')
        .select('monto')
        .eq('orden_id', ordenIdFiltro);

      const totalPagado = (pagosOrden || []).reduce((acc, p) => acc + Number(p.monto), 0);
      const totalCliente = Number(totales?.precio_total_cliente || 0);
      const saldo = totalCliente - totalPagado;

      elSaldo.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;"><span>Precio total al cliente</span><span>${formatUSD(totalCliente)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Total pagado</span><span>${formatUSD(totalPagado)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;"><strong>Saldo pendiente</strong><strong>${formatUSD(saldo)}</strong></div>
        </div>
      `;
    }

    let consulta = supabase
      .from('pagos')
      .select('id, monto, fecha, nota, orden_id, ordenes(codigo, estado, clientes(nombre, apellido))')
      .order('fecha', { ascending: false });
    if (ordenIdFiltro) consulta = consulta.eq('orden_id', ordenIdFiltro);

    const { data: pagos, error } = await consulta;
    if (error) throw error;

    if (!pagos.length) {
      mostrarVacio(elLista, 'No hay pagos registrados todavía.');
      return;
    }

    elLista.innerHTML = pagos.map((p) => {
      const cliente = p.ordenes?.clientes;
      const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido || ''}`.trim() : '—';
      const estaBloqueada = ESTADOS_ORDEN_BLOQUEADOS.includes(p.ordenes?.estado);
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <strong>${formatUSD(p.monto)}</strong><br>
              ${!ordenIdFiltro ? `<a href="#ordenes/${p.orden_id}">${escaparHTML(p.ordenes?.codigo || '—')}</a> · <span class="texto-secundario">${escaparHTML(nombreCliente)}</span><br>` : ''}
              <span class="texto-tenue">${formatFecha(p.fecha)}${p.nota ? ` · ${escaparHTML(p.nota)}` : ''}</span>
            </div>
            ${!estaBloqueada ? `<button class="btn btn-fantasma btn-sm" data-eliminar="${p.id}">Eliminar</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    elLista.querySelectorAll('[data-eliminar]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const confirmado = await confirmar({
          mensaje: '¿Eliminar este pago?',
          detalle: 'Esta acción no se puede deshacer.',
          textoConfirmar: 'Eliminar',
        });
        if (!confirmado) return;
        try {
          const { error } = await supabase.from('pagos').delete().eq('id', btn.dataset.eliminar);
          if (error) throw error;
          mostrarExito('Pago eliminado');
          await renderListado(contenedor, ordenIdFiltro);
        } catch (err) {
          mostrarError(elLista, traducirError(err));
        }
      });
    });
  } catch (e) {
    mostrarError(elLista, traducirError(e), () => renderListado(contenedor, ordenIdFiltro));
  }
}

// ---------- CREAR ----------

async function renderCrearPago(contenedor, ordenIdPreseleccionada) {
  contenedor.innerHTML = `
    <div class="section-header">
      <h2>Registrar pago</h2>
      <a href="${ordenIdPreseleccionada ? `#pagos/orden/${ordenIdPreseleccionada}` : '#pagos'}" class="btn btn-fantasma btn-sm" id="link-cancelar-crear-pago">Cancelar</a>
    </div>
    <div id="crear-pago-error"></div>
    <form id="form-crear-pago">
      <div class="form-grupo">
        <label class="form-label">Orden <span class="requerido">*</span></label>
        <select id="cp-orden" class="select" required ${ordenIdPreseleccionada ? 'disabled' : ''}></select>
      </div>
      <div class="form-grupo">
        <label class="form-label">Monto (USD) <span class="requerido">*</span></label>
        <input type="number" id="cp-monto" class="input" min="0.01" step="0.01" required>
      </div>
      <div class="form-grupo">
        <label class="form-label">Fecha</label>
        <input type="date" id="cp-fecha" class="input">
      </div>
      <div class="form-grupo">
        <label class="form-label">Nota</label>
        <input type="text" id="cp-nota" class="input">
      </div>
      <button type="submit" class="btn btn-primario" id="btn-crear-pago" style="width:100%">Guardar pago</button>
    </form>
  `;

  const elError = contenedor.querySelector('#crear-pago-error');
  const elSelectOrden = contenedor.querySelector('#cp-orden');
  const elForm = contenedor.querySelector('#form-crear-pago');
  const elBtn = contenedor.querySelector('#btn-crear-pago');
  const elCancelar = contenedor.querySelector('#link-cancelar-crear-pago');
  const destinoCancelar = elCancelar.getAttribute('href');

  contenedor.querySelector('#cp-fecha').value = new Date().toISOString().slice(0, 10);

  function obtenerValoresFormulario() {
    return {
      orden: elSelectOrden.value,
      monto: contenedor.querySelector('#cp-monto').value,
      nota: contenedor.querySelector('#cp-nota').value,
    };
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

    if (ordenIdPreseleccionada) elSelectOrden.value = ordenIdPreseleccionada;
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
    const monto = Number(contenedor.querySelector('#cp-monto').value);
    const fecha = contenedor.querySelector('#cp-fecha').value;
    const nota = contenedor.querySelector('#cp-nota').value.trim() || null;

    if (!ordenId || !monto || monto <= 0) {
      elError.innerHTML = '<div class="banner banner-error">Selecciona una orden e indica un monto válido.</div>';
      return;
    }

    const confirmado = await confirmar({ mensaje: '¿Guardar este pago?', textoConfirmar: 'Guardar' });
    if (!confirmado) return;

    elBtn.disabled = true;
    elBtn.textContent = 'Guardando...';

    try {
      const payload = { orden_id: ordenId, monto, nota };
      if (fecha) payload.fecha = new Date(fecha + 'T12:00:00').toISOString();

      const { error } = await supabase.from('pagos').insert(payload);
      if (error) throw error;

      mostrarExito('Pago registrado');
      window.location.hash = `#pagos/orden/${ordenId}`;
    } catch (err) {
      elError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
      elBtn.disabled = false;
      elBtn.textContent = 'Guardar pago';
    }
  });
}
