const rutas = {};

export function registrarRuta(nombre, renderFn) {
  rutas[nombre] = renderFn;
}

export function iniciarNavegacion(contenedor) {
  window.addEventListener('hashchange', () => renderizarRutaActual(contenedor));
  renderizarRutaActual(contenedor);
}

function obtenerRutaActual() {
  return (window.location.hash || '#dashboard').replace('#', '');
}

async function renderizarRutaActual(contenedor) {
  const nombre = obtenerRutaActual();
  const render = rutas[nombre] || rutas['dashboard'];
  marcarActivo(nombre);
  await render(contenedor);
}

function marcarActivo(nombre) {
  document.querySelectorAll('#nav-inferior a, #nav-lateral a').forEach((a) => {
    a.classList.toggle('activo', a.getAttribute('href') === '#' + nombre);
  });
}
