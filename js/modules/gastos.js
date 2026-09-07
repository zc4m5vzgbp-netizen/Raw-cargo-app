import { supabase } from '../supabase.js';
import { mostrarCargando, mostrarError, mostrarVacio, mostrarExito, escaparHTML, confirmar, huboCambios } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';
import { formatUSD, formatFecha } from '../utils/formatters.js';

const ESTADOS_ORDEN_BLOQUEADOS = ['completada', 'cancelada'];

export async function render(contenedor, parametros = []) {
  const [primero] = parametros;
  if (primero === 'nuevo') {
    return renderCrearGasto(contenedor);
  }
  return renderListado(contenedor);
}

// ---------- LISTADO ----------

async function renderListado(contenedor) {
  contenedor.innerHTML = `
    <div class="section-header">
      <h2>Gastos</h2>
      <a href="#gastos/nuevo" class="btn btn-primario btn-sm">+ Nuevo gasto</a>
    </div>
    <div id="gastos-aviso"></div>
    <div id="lista-gastos"></div>
  `;

  const elLista = contenedor.querySelector('#lista-gastos');
  mostrarCargando(elLista);

  try {
    const { data: gastos, error } = await supabase
      .from('gastos')
      .select('id, categoria, monto, descripcion, fecha, orden_id, paquete_id, ordenes(codigo), paquetes(codigo, orden_id, ordenes(codigo))')
      .order('fecha', { ascending: false });
    if (error) throw error;

    if (!gastos.length) {
      mostrarVacio(elLista, 'No hay gastos registrados todavía.');
      return;
    }

    elLista.innerHTML = gastos.map((g) => {
      let vinculo = 'General (sin vincular)';
      if (g.ordenes) vinculo = `Orden ${escaparHTML(g.ordenes.codigo)}`;
      else if (g.paquetes) vinculo = `Paquete ${escaparHTML(g.paquetes.codigo)}${g.paquetes.ordenes ? ` (${escaparHTML(g.paquetes.ordenes.codigo)})` : ''}`;

      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <strong>${escaparHTML(g.categoria)}</strong> — <strong>${formatUSD(g.monto)}</strong><br>
              <span class="texto-secundario">${vinculo}</span><br>
              <span class="texto-tenue">${formatFecha(g.fecha)}${g.descripcion ? ` · ${escaparHTML(g.descripcion)}` : ''}</span>
            </div>
            <button class="btn btn-fantasma btn-sm" data-eliminar="${g.id}">Eliminar</button>
          </div>
        </div>
      `;
    }).join('');

    elLista.querySelectorAll('[data-eliminar]').forEach((btn) => {
      btn.addEventListener('click', () => eliminarGasto(contenedor, btn.dataset.eliminar));
    });
  } catch (e) {
    mostrarError(elLista, traducirError(e), () => renderListado(contenedor));
  }
}

async function eliminarGasto(contenedor, gastoId) {
  try {
    const { data: gasto, error: errorGasto } = await supabase
      .from('gastos')
      .select('orden_id, paquete_id, paquetes(orden_id)')
      .eq('id', gastoId)
      .single();
    if (errorGasto) throw errorGasto;

    const ordenIdRelacionada = gasto.orden_id || gasto.paquetes?.orden_id;
    if (ordenIdRelacionada) {
      const { data: orden } = await supabase.from('ordenes').select('estado').eq('id', ordenIdRelacionada).single();
      if (orden && ESTADOS_ORDEN_BLOQUEADOS.includes(orden.estado)) {
        const elAviso = contenedor.querySelector('#gastos-aviso');
        elAviso.innerHTML = '<div class="banner banner-error">Este gasto pertenece a una orden ya cerrada — no se puede eliminar para no alterar su historial financiero definitivo.</div>';
        return;
      }
    }

    const confirmado = await confirmar({
      mensaje: '¿Eliminar este gasto?',
      detalle: 'Esta acción no se puede deshacer.',
      textoConfirmar: 'Eliminar',
    });
    if (!confirmado) return;

    const { error } = await supabase.from('gastos').delete().eq('id', gastoId);
    if (error) throw error;
    mostrarExito('Gasto eliminado');
    await renderListado(contenedor);
  } catch (err) {
    mostrarError(contenedor.querySelector('#lista-gastos'), traducirError(err));
  }
}

// ---------- CREAR ----------

async function renderCrearGasto(contenedor) {
  contenedor.innerHTML = `
    <div class="section-header">
      <h2>Nuevo gasto</h2>
      <a href="#gastos" class="btn btn-fantasma btn-sm" id="link-cancelar-crear-gasto">Cancelar</a>
    </div>
    <div id="crear-gasto-error"></div>
    <form id="form-crear-gasto">
      <div class="form-grupo">
        <label class="form-label">Categoría <span class="requerido">*</span></label>
        <input type="text" id="cg-categoria" class="input" placeholder="Ej: Transporte, Insumos, Oficina..." required>
      </div>
      <div class="form-grupo">
        <label class="form-label">Monto (USD) <span class="requerido">*</span></label>
        <input type="number" id="cg-monto" class="input" min="0" step="0.01" required>
      </div>
      <div class="form-grupo">
        <label class="form-label">Fecha</label>
        <input type="date" id="cg-fecha" class="input">
      </div>
      <div class="form-grupo">
        <label class="form-label">Descripción</label>
        <input type="text" id="cg-descripcion" class="input">
      </div>
      <div class="form-grupo">
        <label class="form-label">Vincular a</label>
        <select id="cg-vinculo" class="select">
          <option value="ninguno">Ninguno (gasto general)</option>
          <option value="orden">Una orden</option>
          <option value="paquete">Un paquete</option>
        </select>
      </div>
      <div class="form-grupo" id="cg-orden-grupo" hidden>
        <label class="form-label">Orden</label>
        <select id="cg-orden" class="select"></select>
      </div>
      <div class="form-grupo" id="cg-paquete-grupo" hidden>
        <label class="form-label">Paquete</label>
        <select id="cg-paquete" class="select"></select>
      </div>
      <button type="submit" class="btn btn-primario" id="btn-crear-gasto" style="width:100%">Guardar gasto</button>
    </form>
  `;

  const elError = contenedor.querySelector('#crear-gasto-error');
  const elForm = contenedor.querySelector('#form-crear-gasto');
  const elBtn = contenedor.querySelector('#btn-crear-gasto');
  const elVinculo = contenedor.querySelector('#cg-vinculo');
  const elOrdenGrupo = contenedor.querySelector('#cg-orden-grupo');
  const elPaqueteGrupo = contenedor.querySelector('#cg-paquete-grupo');
  const elSelectOrden = contenedor.querySelector('#cg-orden');
  const elSelectPaquete = contenedor.querySelector('#cg-paquete');
  const elCancelar = contenedor.querySelector('#link-cancelar-crear-gasto');

  contenedor.querySelector('#cg-fecha').value = new Date().toISOString().slice(0, 10);

  function obtenerValoresFormulario() {
    return {
      categoria: contenedor.querySelector('#cg-categoria').value,
      monto: contenedor.querySelector('#cg-monto').value,
      descripcion: contenedor.querySelector('#cg-descripcion').value,
      vinculo: elVinculo.value,
    };
  }
  const valoresIniciales = obtenerValoresFormulario();

  try {
    const [{ data: ordenes, error: errorO }, { data: paquetes, error: errorP }] = await Promise.all([
      supabase.from('ordenes').select('id, codigo').order('creado_en', { ascending: false }),
      supabase.from('paquetes').select('id, codigo').order('creado_en', { ascending: false }),
    ]);
    if (errorO) throw errorO;
    if (errorP) throw errorP;

    elSelectOrden.innerHTML = ordenes.map((o) => `<option value="${o.id}">${escaparHTML(o.codigo)}</option>`).join('');
    elSelectPaquete.innerHTML = paquetes.map((p) => `<option value="${p.id}">${escaparHTML(p.codigo)}</option>`).join('');
  } catch (e) {
    elError.innerHTML = `<div class="banner banner-error">${traducirError(e)}</div>`;
    return;
  }

  elVinculo.addEventListener('change', () => {
    elOrdenGrupo.hidden = elVinculo.value !== 'orden';
    elPaqueteGrupo.hidden = elVinculo.value !== 'paquete';
  });

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
    window.location.hash = '#gastos';
  });

  elForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elError.innerHTML = '';

    const categoria = contenedor.querySelector('#cg-categoria').value.trim();
    const monto = Number(contenedor.querySelector('#cg-monto').value);
    const fecha = contenedor.querySelector('#cg-fecha').value;
    const descripcion = contenedor.querySelector('#cg-descripcion').value.trim() || null;
    const vinculo = elVinculo.value;

    if (!categoria || isNaN(monto) || monto < 0) {
      elError.innerHTML = '<div class="banner banner-error">Completa la categoría y un monto válido.</div>';
      return;
    }

    const payload = { categoria, monto, descripcion, orden_id: null, paquete_id: null };
    if (fecha) payload.fecha = new Date(fecha + 'T12:00:00').toISOString();
    if (vinculo === 'orden') payload.orden_id = elSelectOrden.value;
    if (vinculo === 'paquete') payload.paquete_id = elSelectPaquete.value;

    const confirmado = await confirmar({ mensaje: '¿Guardar este gasto?', textoConfirmar: 'Guardar' });
    if (!confirmado) return;

    elBtn.disabled = true;
    elBtn.textContent = 'Guardando...';

    try {
      const { error } = await supabase.from('gastos').insert(payload);
      if (error) throw error;
      mostrarExito('Gasto guardado');
      window.location.hash = '#gastos';
    } catch (err) {
      elError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
      elBtn.disabled = false;
      elBtn.textContent = 'Guardar gasto';
    }
  });
}
