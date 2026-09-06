const rutas = {};
const RUTAS_SECUNDARIAS = ['pagos', 'finanzas', 'gastos', 'configuracion', 'historial'];

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
  document.querySelectorAll('#nav-lateral a, #nav-inferior a, #mas-sheet-fondo a').forEach((a) => {
    a.classList.toggle('activo', a.getAttribute('href') === '#' + nombre);
  });
  const btnMas = document.getElementById('btn-mas');
  if (btnMas) btnMas.classList.toggle('activo', RUTAS_SECUNDARIAS.includes(nombre));
}
