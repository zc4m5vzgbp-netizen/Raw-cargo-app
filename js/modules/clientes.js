import { supabase } from '../supabase.js';
import { mostrarCargando, mostrarError, mostrarVacio, mostrarExito, escaparHTML, confirmar, huboCambios } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';

export async function render(contenedor) {
  let clienteEditando = null;
  let valoresIniciales = {};
  let debounceId = null;

  contenedor.innerHTML = `
    <div class="section-header">
      <h2>Clientes</h2>
      <button class="btn btn-primario btn-sm" id="btn-nuevo-cliente">+ Nuevo cliente</button>
    </div>
    <div class="form-grupo">
      <input type="search" id="buscar-clientes" class="input" placeholder="Buscar por nombre, teléfono o WhatsApp…">
    </div>
    <div id="lista-clientes"></div>

    <div class="modal-fondo" id="cliente-modal-fondo" hidden>
      <div class="modal">
        <div class="section-header">
          <h3 id="cliente-modal-titulo">Nuevo cliente</h3>
          <button class="btn btn-fantasma btn-sm" id="btn-cerrar-cliente-modal">Cerrar</button>
        </div>
        <div id="cliente-form-error"></div>
        <form id="cliente-form">
          <div class="form-grupo">
            <label class="form-label">Nombre <span class="requerido">*</span></label>
            <input type="text" id="cf-nombre" class="input" required>
          </div>
          <div class="form-grupo">
            <label class="form-label">Apellido</label>
            <input type="text" id="cf-apellido" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Teléfono</label>
            <input type="tel" id="cf-telefono" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">WhatsApp</label>
            <input type="tel" id="cf-whatsapp" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Ciudad</label>
            <input type="text" id="cf-ciudad" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Dirección de entrega</label>
            <input type="text" id="cf-direccion" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Notas</label>
            <textarea id="cf-notas" class="textarea"></textarea>
          </div>
          <button type="submit" class="btn btn-primario" id="btn-guardar-cliente" style="width:100%">Guardar</button>
        </form>
      </div>
    </div>
  `;

  const elLista = contenedor.querySelector('#lista-clientes');
  const elBuscar = contenedor.querySelector('#buscar-clientes');
  const elModalFondo = contenedor.querySelector('#cliente-modal-fondo');
  const elModalTitulo = contenedor.querySelector('#cliente-modal-titulo');
  const elForm = contenedor.querySelector('#cliente-form');
  const elFormError = contenedor.querySelector('#cliente-form-error');
  const elBtnGuardar = contenedor.querySelector('#btn-guardar-cliente');

  function obtenerValoresFormulario() {
    return {
      nombre: contenedor.querySelector('#cf-nombre').value,
      apellido: contenedor.querySelector('#cf-apellido').value,
      telefono: contenedor.querySelector('#cf-telefono').value,
      whatsapp: contenedor.querySelector('#cf-whatsapp').value,
      ciudad: contenedor.querySelector('#cf-ciudad').value,
      direccion: contenedor.querySelector('#cf-direccion').value,
      notas: contenedor.querySelector('#cf-notas').value,
    };
  }

  function abrirModal(cliente) {
    clienteEditando = cliente || null;
    elModalTitulo.textContent = cliente ? 'Editar cliente' : 'Nuevo cliente';
    elFormError.innerHTML = '';
    contenedor.querySelector('#cf-nombre').value = cliente?.nombre || '';
    contenedor.querySelector('#cf-apellido').value = cliente?.apellido || '';
    contenedor.querySelector('#cf-telefono').value = cliente?.telefono || '';
    contenedor.querySelector('#cf-whatsapp').value = cliente?.whatsapp || '';
    contenedor.querySelector('#cf-ciudad').value = cliente?.ciudad || '';
    contenedor.querySelector('#cf-direccion').value = cliente?.direccion_entrega || '';
    contenedor.querySelector('#cf-notas').value = cliente?.notas || '';
    elModalFondo.hidden = false;
    valoresIniciales = obtenerValoresFormulario();
  }

  function cerrarModal() {
    elModalFondo.hidden = true;
    clienteEditando = null;
  }

  async function intentarCerrarModal() {
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
    cerrarModal();
  }

  contenedor.querySelector('#btn-nuevo-cliente').addEventListener('click', () => abrirModal(null));
  contenedor.querySelector('#btn-cerrar-cliente-modal').addEventListener('click', intentarCerrarModal);
  elModalFondo.addEventListener('click', (e) => { if (e.target === elModalFondo) intentarCerrarModal(); });

  elBuscar.addEventListener('input', () => {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => cargarClientes(elBuscar.value), 300);
  });

  elForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elFormError.innerHTML = '';
    const datos = {
      nombre: contenedor.querySelector('#cf-nombre').value.trim(),
      apellido: contenedor.querySelector('#cf-apellido').value.trim() || null,
      telefono: contenedor.querySelector('#cf-telefono').value.trim() || null,
      whatsapp: contenedor.querySelector('#cf-whatsapp').value.trim() || null,
      ciudad: contenedor.querySelector('#cf-ciudad').value.trim() || null,
      direccion_entrega: contenedor.querySelector('#cf-direccion').value.trim() || null,
      notas: contenedor.querySelector('#cf-notas').value.trim() || null,
    };

    if (!datos.nombre) {
      elFormError.innerHTML = '<div class="banner banner-error">El nombre es obligatorio.</div>';
      return;
    }

    const confirmado = await confirmar({
      mensaje: clienteEditando ? '¿Seguro que quieres actualizar estos datos?' : '¿Guardar este nuevo cliente?',
      textoConfirmar: clienteEditando ? 'Confirmar actualización' : 'Guardar',
    });
    if (!confirmado) return;

    elBtnGuardar.disabled = true;
    elBtnGuardar.textContent = 'Guardando...';

    try {
      let error;
      if (clienteEditando) {
        ({ error } = await supabase.from('clientes').update(datos).eq('id', clienteEditando.id));
      } else {
        ({ error } = await supabase.from('clientes').insert(datos));
      }
      if (error) throw error;

      mostrarExito(clienteEditando ? 'Cliente actualizado' : 'Cliente creado');
      cerrarModal();
      await cargarClientes(elBuscar.value);
    } catch (err) {
      elFormError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
    } finally {
      elBtnGuardar.disabled = false;
      elBtnGuardar.textContent = 'Guardar';
    }
  });

  async function cargarClientes(termino = '') {
    mostrarCargando(elLista);
    const t = termino.trim();
    try {
      let consulta = supabase
        .from('clientes')
        .select('id, nombre, apellido, telefono, whatsapp, ciudad, direccion_entrega, notas')
        .order('creado_en', { ascending: false });

      if (t) {
        // Se remueven caracteres especiales del filtro .or() de PostgREST (, ( ) %)
        // para que un teléfono como "(555) 123-4567" no rompa la consulta.
        const seguro = t.replace(/[,()%]/g, ' ').trim();
        if (seguro) {
          consulta = consulta.or(
            `nombre.ilike.%${seguro}%,apellido.ilike.%${seguro}%,telefono.ilike.%${seguro}%,whatsapp.ilike.%${seguro}%`
          );
        }
      }

      const { data, error } = await consulta;
      if (error) throw error;

      if (!data.length) {
        mostrarVacio(elLista, t
          ? `No se encontraron clientes para "${escaparHTML(t)}".`
          : 'No tienes clientes todavía. Toca "+ Nuevo cliente" para agregar el primero.');
        return;
      }

      elLista.innerHTML = data.map((c) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <strong>${escaparHTML(c.nombre)} ${escaparHTML(c.apellido || '')}</strong><br>
              <span class="texto-secundario">${escaparHTML(c.telefono || 'Sin teléfono')}</span>
              ${c.ciudad ? `<br><span class="texto-tenue">${escaparHTML(c.ciudad)}</span>` : ''}
            </div>
            <button class="btn btn-secundario btn-sm" data-editar="${c.id}">Editar</button>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <a href="#ordenes/cliente/${c.id}" class="btn btn-secundario btn-sm">Ver órdenes</a>
            <a href="#ordenes/nuevo/${c.id}" class="btn btn-secundario btn-sm">+ Nueva orden</a>
          </div>
        </div>
      `).join('');

      elLista.querySelectorAll('[data-editar]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cliente = data.find((c) => c.id === btn.dataset.editar);
          abrirModal(cliente);
        });
      });
    } catch (e) {
      mostrarError(elLista, traducirError(e), () => cargarClientes(termino));
    }
  }

  await cargarClientes();
}
