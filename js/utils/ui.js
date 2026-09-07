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
