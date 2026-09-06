import { supabase } from '../supabase.js';
import { mostrarCargando, mostrarError, mostrarExito } from '../utils/ui.js';
import { traducirError } from '../utils/errors.js';
import { formatUSD, formatPorcentaje, formatLibras } from '../utils/formatters.js';

export async function render(contenedor) {
  contenedor.innerHTML = `
    <h1>Configuración</h1>
    <p class="texto-secundario">Tarifas y parámetros vigentes del negocio</p>
    <div id="config-vigente"></div>

    <div class="modal-fondo" id="config-modal-fondo" hidden>
      <div class="modal">
        <div class="section-header">
          <h3>Crear nueva versión</h3>
          <button type="button" class="btn btn-fantasma btn-sm" id="btn-cerrar-config-modal">Cerrar</button>
        </div>
        <p class="texto-secundario" style="margin-top:-8px;">La configuración vigente se conserva como snapshot histórico — esto crea una versión nueva, nunca la edita.</p>
        <div id="config-form-error"></div>
        <form id="config-form">

          <div class="section-header"><h3 style="font-size:16px;">Envío — tramos</h3></div>
          <div id="tramos-editor"></div>
          <button type="button" class="btn btn-secundario btn-sm" id="btn-agregar-tramo" style="margin-bottom:12px;">+ Agregar tramo</button>

          <div class="form-grupo">
            <label class="form-label">Peso mínimo facturable (lb)</label>
            <input type="number" step="0.01" id="cf-envio-peso-minimo" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Precio mínimo (USD)</label>
            <input type="number" step="0.01" id="cf-envio-precio-minimo" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Divisor volumétrico</label>
            <input type="number" step="0.01" id="cf-divisor-volumetrico" class="input">
          </div>

          <hr class="divider">
          <div class="section-header"><h3 style="font-size:16px;">Proveedor</h3></div>
          <div class="form-grupo">
            <label class="form-label">Costo por libra (USD)</label>
            <input type="number" step="0.01" id="cf-proveedor-costo-lb" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Costo mínimo (USD)</label>
            <input type="number" step="0.01" id="cf-proveedor-costo-minimo" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Aplica mínimo por debajo de (lb)</label>
            <input type="number" step="0.01" id="cf-proveedor-minimo-lb" class="input">
          </div>

          <hr class="divider">
          <div class="section-header"><h3 style="font-size:16px;">Seguro</h3></div>
          <div class="form-grupo">
            <label class="form-label">Costo para Raw Cargo (%)</label>
            <input type="number" step="0.01" id="cf-seguro-costo-pct" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Precio cobrado al cliente (%)</label>
            <input type="number" step="0.01" id="cf-seguro-precio-pct" class="input">
          </div>

          <hr class="divider">
          <div class="section-header"><h3 style="font-size:16px;">Personal Shopper</h3></div>
          <div class="form-grupo">
            <label class="form-label">Comisión (%)</label>
            <input type="number" step="0.01" id="cf-ps-pct" class="input">
          </div>
          <div class="form-grupo">
            <label class="form-label">Comisión mínima (USD)</label>
            <input type="number" step="0.01" id="cf-ps-minimo" class="input">
          </div>

          <hr class="divider">
          <div class="section-header"><h3 style="font-size:16px;">Entrega</h3></div>
          <div class="form-grupo">
            <label class="form-label">Pago al repartidor por paquete (USD)</label>
            <input type="number" step="0.01" id="cf-entrega-repartidor" class="input" placeholder="Dejar vacío si no está definido">
            <div class="form-ayuda">Puedes dejarlo vacío hasta que definas la tarifa real — nunca se inventa un valor.</div>
          </div>
          <div class="form-grupo">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="cf-entrega-activa">
              <span class="form-label" style="margin:0;">Cobrar tarifa de entrega al cliente</span>
            </label>
          </div>
          <div class="form-grupo">
            <label class="form-label">Monto de la tarifa al cliente (USD)</label>
            <input type="number" step="0.01" id="cf-entrega-monto-cliente" class="input">
          </div>

          <button type="submit" class="btn btn-primario" id="btn-guardar-config" style="width:100%;">Crear nueva versión</button>
        </form>
      </div>
    </div>
  `;

  const elVigente = contenedor.querySelector('#config-vigente');
  const elModalFondo = contenedor.querySelector('#config-modal-fondo');
  const elTramosEditor = contenedor.querySelector('#tramos-editor');
  const elForm = contenedor.querySelector('#config-form');
  const elFormError = contenedor.querySelector('#config-form-error');
  const elBtnGuardar = contenedor.querySelector('#btn-guardar-config');

  let tramosEstado = [];

  function pintarTramos() {
    elTramosEditor.innerHTML = tramosEstado.map((t, i) => `
      <div class="card" style="display:flex;gap:8px;align-items:center;padding:8px;">
        <input type="number" step="0.01" class="input tramo-desde" data-i="${i}" placeholder="Desde" value="${t.desde ?? ''}" style="margin-bottom:0;">
        <input type="number" step="0.01" class="input tramo-hasta" data-i="${i}" placeholder="Hasta (vacío = sin límite)" value="${t.hasta ?? ''}" style="margin-bottom:0;">
        <input type="number" step="0.01" class="input tramo-precio" data-i="${i}" placeholder="Precio/lb" value="${t.precio_lb ?? ''}" style="margin-bottom:0;">
        <button type="button" class="btn btn-fantasma btn-sm tramo-eliminar" data-i="${i}">✕</button>
      </div>
    `).join('');

    elTramosEditor.querySelectorAll('.tramo-desde').forEach((el) => el.addEventListener('input', (e) => {
      tramosEstado[Number(e.target.dataset.i)].desde = e.target.value;
    }));
    elTramosEditor.querySelectorAll('.tramo-hasta').forEach((el) => el.addEventListener('input', (e) => {
      tramosEstado[Number(e.target.dataset.i)].hasta = e.target.value;
    }));
    elTramosEditor.querySelectorAll('.tramo-precio').forEach((el) => el.addEventListener('input', (e) => {
      tramosEstado[Number(e.target.dataset.i)].precio_lb = e.target.value;
    }));
    elTramosEditor.querySelectorAll('.tramo-eliminar').forEach((el) => el.addEventListener('click', (e) => {
      tramosEstado.splice(Number(e.target.dataset.i), 1);
      pintarTramos();
    }));
  }

  contenedor.querySelector('#btn-agregar-tramo').addEventListener('click', () => {
    tramosEstado.push({ desde: '', hasta: '', precio_lb: '' });
    pintarTramos();
  });

  function abrirModal(config) {
    tramosEstado = JSON.parse(JSON.stringify(config.envio_tramos || []));
    pintarTramos();
    contenedor.querySelector('#cf-envio-peso-minimo').value = config.envio_peso_minimo;
    contenedor.querySelector('#cf-envio-precio-minimo').value = config.envio_precio_minimo;
    contenedor.querySelector('#cf-divisor-volumetrico').value = config.divisor_volumetrico;
    contenedor.querySelector('#cf-proveedor-costo-lb').value = config.proveedor_costo_por_lb;
    contenedor.querySelector('#cf-proveedor-costo-minimo').value = config.proveedor_costo_minimo;
    contenedor.querySelector('#cf-proveedor-minimo-lb').value = config.proveedor_minimo_lb;
    contenedor.querySelector('#cf-seguro-costo-pct').value = (config.seguro_costo_pct * 100).toFixed(2);
    contenedor.querySelector('#cf-seguro-precio-pct').value = (config.seguro_precio_cliente_pct * 100).toFixed(2);
    contenedor.querySelector('#cf-ps-pct').value = (config.personal_shopper_pct * 100).toFixed(2);
    contenedor.querySelector('#cf-ps-minimo').value = config.personal_shopper_minimo;
    contenedor.querySelector('#cf-entrega-repartidor').value = config.entrega_pago_repartidor_monto ?? '';
    contenedor.querySelector('#cf-entrega-activa').checked = !!config.entrega_precio_cliente_activa;
    contenedor.querySelector('#cf-entrega-monto-cliente').value = config.entrega_precio_cliente_monto;
    elFormError.innerHTML = '';
    elModalFondo.hidden = false;
  }

  function cerrarModal() { elModalFondo.hidden = true; }
  contenedor.querySelector('#btn-cerrar-config-modal').addEventListener('click', cerrarModal);
  elModalFondo.addEventListener('click', (e) => { if (e.target === elModalFondo) cerrarModal(); });

  elForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elFormError.innerHTML = '';

    // Validaciones de UX — PostgreSQL sigue siendo la autoridad final
    const tramosLimpios = [];
    for (const t of tramosEstado) {
      const desde = Number(t.desde);
      const precio = Number(t.precio_lb);
      const hasta = (t.hasta === '' || t.hasta == null) ? null : Number(t.hasta);
      if (t.desde === '' || isNaN(desde) || t.precio_lb === '' || isNaN(precio)) {
        elFormError.innerHTML = '<div class="banner banner-error">Cada tramo necesita al menos "Desde" y "Precio/lb".</div>';
        return;
      }
      if (precio < 0 || desde < 0 || (hasta !== null && hasta < 0)) {
        elFormError.innerHTML = '<div class="banner banner-error">Los valores de los tramos no pueden ser negativos.</div>';
        return;
      }
      tramosLimpios.push({ desde, hasta, precio_lb: precio });
    }
    if (!tramosLimpios.length) {
      elFormError.innerHTML = '<div class="banner banner-error">Debe existir al menos un tramo de envío.</div>';
      return;
    }

    const repartidorTexto = contenedor.querySelector('#cf-entrega-repartidor').value.trim();
    const payload = {
      p_envio_tramos: tramosLimpios,
      p_envio_peso_minimo: Number(contenedor.querySelector('#cf-envio-peso-minimo').value),
      p_envio_precio_minimo: Number(contenedor.querySelector('#cf-envio-precio-minimo').value),
      p_divisor_volumetrico: Number(contenedor.querySelector('#cf-divisor-volumetrico').value),
      p_proveedor_costo_por_lb: Number(contenedor.querySelector('#cf-proveedor-costo-lb').value),
      p_proveedor_costo_minimo: Number(contenedor.querySelector('#cf-proveedor-costo-minimo').value),
      p_proveedor_minimo_lb: Number(contenedor.querySelector('#cf-proveedor-minimo-lb').value),
      p_seguro_costo_pct: Number(contenedor.querySelector('#cf-seguro-costo-pct').value) / 100,
      p_seguro_precio_cliente_pct: Number(contenedor.querySelector('#cf-seguro-precio-pct').value) / 100,
      p_personal_shopper_pct: Number(contenedor.querySelector('#cf-ps-pct').value) / 100,
      p_personal_shopper_minimo: Number(contenedor.querySelector('#cf-ps-minimo').value),
      p_entrega_pago_repartidor_monto: repartidorTexto === '' ? null : Number(repartidorTexto),
      p_entrega_precio_cliente_activa: contenedor.querySelector('#cf-entrega-activa').checked,
      p_entrega_precio_cliente_monto: Number(contenedor.querySelector('#cf-entrega-monto-cliente').value),
    };

    const camposNumericos = ['p_envio_peso_minimo','p_envio_precio_minimo','p_divisor_volumetrico','p_proveedor_costo_por_lb','p_proveedor_costo_minimo','p_proveedor_minimo_lb','p_seguro_costo_pct','p_seguro_precio_cliente_pct','p_personal_shopper_pct','p_personal_shopper_minimo','p_entrega_precio_cliente_monto'];
    for (const campo of camposNumericos) {
      if (isNaN(payload[campo]) || payload[campo] < 0) {
        elFormError.innerHTML = '<div class="banner banner-error">Todos los valores numéricos deben ser válidos y no negativos.</div>';
        return;
      }
    }
    if (payload.p_entrega_pago_repartidor_monto !== null && (isNaN(payload.p_entrega_pago_repartidor_monto) || payload.p_entrega_pago_repartidor_monto < 0)) {
      elFormError.innerHTML = '<div class="banner banner-error">La tarifa del repartidor no puede ser negativa.</div>';
      return;
    }

    elBtnGuardar.disabled = true;
    elBtnGuardar.textContent = 'Guardando...';
    try {
      const { error } = await supabase.rpc('crear_configuracion_nueva', payload);
      if (error) throw error;
      mostrarExito('Nueva versión de configuración creada');
      cerrarModal();
      await cargarConfiguracion();
    } catch (err) {
      elFormError.innerHTML = `<div class="banner banner-error">${traducirError(err)}</div>`;
    } finally {
      elBtnGuardar.disabled = false;
      elBtnGuardar.textContent = 'Crear nueva versión';
    }
  });

  function pintarConfiguracion(config) {
    const tramos = Array.isArray(config.envio_tramos) ? config.envio_tramos : [];
    elVigente.innerHTML = `
      <div class="section-header"><h3>Envío</h3></div>
      <div class="card">
        <div class="tabla-wrap">
          <table class="tabla">
            <thead><tr><th>Desde</th><th>Hasta</th><th>Precio/lb</th></tr></thead>
            <tbody>
              ${tramos.map((t) => `
                <tr>
                  <td>${formatLibras(t.desde)}</td>
                  <td>${t.hasta != null ? formatLibras(t.hasta) : 'en adelante'}</td>
                  <td>${formatUSD(t.precio_lb)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:12px;">
          <div>Peso mínimo facturable: <strong>${formatLibras(config.envio_peso_minimo)}</strong></div>
          <div>Precio mínimo: <strong>${formatUSD(config.envio_precio_minimo)}</strong></div>
          <div>Divisor volumétrico: <strong>${config.divisor_volumetrico}</strong></div>
        </div>
      </div>

      <div class="section-header"><h3>Proveedor</h3></div>
      <div class="card">
        <div>Costo por libra: <strong>${formatUSD(config.proveedor_costo_por_lb)}</strong></div>
        <div>Costo mínimo: <strong>${formatUSD(config.proveedor_costo_minimo)}</strong></div>
        <div>Aplica mínimo por debajo de: <strong>${formatLibras(config.proveedor_minimo_lb)}</strong></div>
      </div>

      <div class="section-header"><h3>Seguro</h3></div>
      <div class="card">
        <div>Costo para Raw Cargo: <strong>${formatPorcentaje(config.seguro_costo_pct)}</strong></div>
        <div>Precio cobrado al cliente: <strong>${formatPorcentaje(config.seguro_precio_cliente_pct)}</strong></div>
      </div>

      <div class="section-header"><h3>Personal Shopper</h3></div>
      <div class="card">
        <div>Comisión: <strong>${formatPorcentaje(config.personal_shopper_pct)}</strong></div>
        <div>Comisión mínima: <strong>${formatUSD(config.personal_shopper_minimo)}</strong></div>
      </div>

      <div class="section-header"><h3>Entrega</h3></div>
      <div class="card">
        <div>Pago al repartidor por paquete: <strong>${config.entrega_pago_repartidor_monto != null ? formatUSD(config.entrega_pago_repartidor_monto) : 'No configurado'}</strong></div>
        <div>Tarifa de entrega al cliente: <strong>${config.entrega_precio_cliente_activa ? 'Activa' : 'Desactivada'}</strong></div>
        ${config.entrega_precio_cliente_activa ? `<div>Monto: <strong>${formatUSD(config.entrega_precio_cliente_monto)}</strong></div>` : ''}
      </div>

      <button class="btn btn-primario" id="btn-nueva-config" style="width:100%;margin-top:8px;">+ Crear nueva versión</button>
    `;
    elVigente.querySelector('#btn-nueva-config').addEventListener('click', () => abrirModal(config));
  }

  async function cargarConfiguracion() {
    mostrarCargando(elVigente, 6);
    try {
      const { data, error } = await supabase
        .from('config_versiones')
        .select('*')
        .eq('es_actual', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        mostrarError(elVigente, 'No hay ninguna configuración activa. Contacta al administrador del sistema.', cargarConfiguracion);
        return;
      }
      pintarConfiguracion(data);
    } catch (e) {
      mostrarError(elVigente, traducirError(e), cargarConfiguracion);
    }
  }

  await cargarConfiguracion();
}
