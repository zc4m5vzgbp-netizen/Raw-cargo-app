export function mostrarCargando(contenedor, lineas = 3) {
  contenedor.innerHTML = Array.from({ length: lineas }).map(() => '<div class="skeleton"></div>').join('');
}

export function mostrarError(contenedor, mensaje, alReintentar) {
  contenedor.innerHTML = `
    <div class="banner banner-error">${mensaje}</div>
    ${alReintentar ? '<button class="btn btn-secundario" id="btn-reintentar">Reintentar</button>' : ''}
  `;
  if (alReintentar) {
    contenedor.querySelector('#btn-reintentar').addEventListener('click', alReintentar);
  }
}

export function mostrarVacio(contenedor, mensaje) {
  contenedor.innerHTML = `<div class="vacio">${mensaje}</div>`;
}

export function mostrarExito(mensaje) {
  const div = document.createElement('div');
  div.className = 'banner banner-exito';
  div.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;z-index:1000;';
  div.textContent = mensaje;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

export function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// Muestra un modal de confirmación (reutiliza .modal-fondo/.modal/.btn existentes)
// y devuelve una Promise<boolean> que resuelve true si el usuario confirma.
// primarioEs: 'confirmar' (por defecto) resalta el botón de acción;
// primarioEs: 'cancelar' resalta el botón seguro (usado en "salir sin guardar").
export function confirmar({ mensaje, detalle = '', textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', primarioEs = 'confirmar' }) {
  return new Promise((resolve) => {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `
      <div class="modal">
        <p>${mensaje}</p>
        ${detalle ? `<p class="texto-secundario">${detalle}</p>` : ''}
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn ${primarioEs === 'cancelar' ? 'btn-primario' : 'btn-secundario'} btn-sm" id="confirmar-no" style="flex:1;">${textoCancelar}</button>
          <button class="btn ${primarioEs === 'cancelar' ? 'btn-secundario' : 'btn-primario'} btn-sm" id="confirmar-si" style="flex:1;">${textoConfirmar}</button>
        </div>
      </div>
    `;
    document.body.appendChild(fondo);
    fondo.querySelector('#confirmar-no').addEventListener('click', () => { fondo.remove(); resolve(false); });
    fondo.querySelector('#confirmar-si').addEventListener('click', () => { fondo.remove(); resolve(true); });
  });
}

// Compara dos objetos planos de valores de formulario (serializados) para
// saber si hubo cambios reales respecto a los valores originales.
export function huboCambios(valoresIniciales, valoresActuales) {
  return JSON.stringify(valoresIniciales) !== JSON.stringify(valoresActuales);
}
