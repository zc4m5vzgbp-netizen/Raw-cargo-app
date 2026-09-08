import { supabase } from './supabase.js';
import { registrarRuta, iniciarNavegacion } from './utils/navigation.js';
import { traducirError } from './utils/errors.js';
import { mostrarExito, mostrarError } from './utils/ui.js';

export const estado = { sesion: null };

// Carga diferida: cada módulo se descarga únicamente la primera vez que se
// visita su ruta, en vez de importarse todos por adelantado al arrancar.
const cargadores = {
  dashboard: () => import('./modules/dashboard.js'),
  clientes: () => import('./modules/clientes.js'),
  ordenes: () => import('./modules/ordenes.js'),
  paquetes: () => import('./modules/paquetes.js'),
  pagos: () => import('./modules/pagos.js'),
  gastos: () => import('./modules/gastos.js'),
  finanzas: () => import('./modules/finanzas.js'),
  configuracion: () => import('./modules/configuracion.js'),
  historial: () => import('./modules/historial.js'),
};

const modulosCache = {};
let tokenNavegacion = 0;

function crearRutaDiferida(nombre) {
  return async function renderDiferido(contenedor, parametros) {
    const miToken = ++tokenNavegacion;
    try {
      if (!modulosCache[nombre]) {
        modulosCache[nombre] = await cargadores[nombre]();
      }
      // Si mientras cargaba el usuario ya navegó a otra ruta, no renderizar
      // esto encima de lo que corresponda mostrar ahora.
      if (miToken !== tokenNavegacion) return;
      const modulo = modulosCache[nombre];
      await modulo.render(contenedor, parametros);
    } catch (e) {
      if (miToken !== tokenNavegacion) return;
      mostrarError(contenedor, traducirError(e), () => renderDiferido(contenedor, parametros));
    }
  };
}

for (const nombre of Object.keys(cargadores)) {
  registrarRuta(nombre, crearRutaDiferida(nombre));
}

const elContenido = document.getElementById('contenido');
const elHeader = document.getElementById('header');
const elNavInferior = document.getElementById('nav-inferior');
const elNavLateral = document.getElementById('nav-lateral');
const elMasSheet = document.getElementById('mas-sheet-fondo');
const elBtnMas = document.getElementById('btn-mas');
const elBtnCerrarMas = document.getElementById('btn-cerrar-mas');
const elBtnUsuario = document.getElementById('btn-usuario');
const elMenuUsuario = document.getElementById('menu-usuario');
const elAvatarIniciales = document.getElementById('avatar-iniciales');
const elEmailUsuario = document.getElementById('email-usuario');
const elBtnCerrarSesion = document.getElementById('btn-cerrar-sesion');
async function iniciar() {
  const { data: { session } } = await supabase.auth.getSession();
  estado.sesion = session;
  session ? mostrarApp() : mostrarLogin();
}

// Evita que iniciarNavegacion() (y su listener de hashchange interno)
// se registre más de una vez si el usuario cierra sesión y vuelve a entrar.
let navegacionIniciada = false;

function mostrarApp() {
  elHeader.style.display = '';
  elNavInferior.style.display = '';
  elNavLateral.style.display = '';
  actualizarUsuarioHeader();
  if (!navegacionIniciada) {
    navegacionIniciada = true;
    iniciarNavegacion(elContenido);
  } else {
    // Ya existe un listener de hashchange activo desde el primer login.
    // En vez de registrar uno nuevo (lo que duplicaría cada render futuro),
    // reutilizamos ese mismo listener disparando el evento manualmente para
    // que vuelva a renderizar la ruta actual.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}
function mostrarLogin() {
  elHeader.style.display = 'none';
  elNavInferior.style.display = 'none';
  elNavLateral.style.display = 'none';
  elContenido.innerHTML = `
    <div style="max-width:340px;margin:60px auto 0;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="img/logo-avion.png" alt="Raw Cargo" style="height:44px;width:auto;display:block;margin:0 auto 8px;">
        <h2 style="margin:0;">Raw Cargo</h2>
      </div>
      <div class="form-grupo">
        <label class="form-label">Correo</label>
        <input type="email" id="login-email" class="input" placeholder="tucorreo@ejemplo.com">
      </div>
      <div class="form-grupo">
        <label class="form-label">Contraseña</label>
        <input type="password" id="login-password" class="input" placeholder="••••••••">
      </div>
      <button class="btn btn-primario" id="login-btn" style="width:100%">Iniciar sesión</button>
      <div id="login-error"></div>
    </div>
  `;
  elContenido.querySelector('#login-btn').addEventListener('click', async () => {
    const email = elContenido.querySelector('#login-email').value;
    const password = elContenido.querySelector('#login-password').value;
    const elError = elContenido.querySelector('#login-error');
    elError.innerHTML = '';
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      estado.sesion = data.session;
      mostrarExito('Sesión iniciada');
      mostrarApp();
    } catch (e) {
      elError.innerHTML = `<div class="banner banner-error">${traducirError(e)}</div>`;
    }
  });
}
function actualizarUsuarioHeader() {
  const email = estado.sesion?.user?.email || '';
  elAvatarIniciales.textContent = email.slice(0, 2).toUpperCase();
  elEmailUsuario.textContent = email;
}
elBtnUsuario?.addEventListener('click', () => { elMenuUsuario.hidden = !elMenuUsuario.hidden; });
document.addEventListener('click', (e) => {
  if (elMenuUsuario && !elMenuUsuario.hidden && !e.target.closest('#usuario-dropdown')) {
    elMenuUsuario.hidden = true;
  }
});
elBtnCerrarSesion?.addEventListener('click', async () => { await supabase.auth.signOut(); });
elBtnMas?.addEventListener('click', () => { elMasSheet.hidden = false; });
elBtnCerrarMas?.addEventListener('click', () => { elMasSheet.hidden = true; });
elMasSheet?.addEventListener('click', (e) => { if (e.target === elMasSheet) elMasSheet.hidden = true; });
window.addEventListener('hashchange', () => { if (elMasSheet) elMasSheet.hidden = true; });
supabase.auth.onAuthStateChange((_evento, session) => {
  estado.sesion = session;
  if (!session) mostrarLogin();
});
window.addEventListener('offline', () => mostrarBannerConexion('Sin conexión a internet.'));
window.addEventListener('online', () => document.getElementById('banner-conexion')?.remove());
function mostrarBannerConexion(mensaje) {
  if (document.getElementById('banner-conexion')) return;
  const div = document.createElement('div');
  div.id = 'banner-conexion';
  div.className = 'banner banner-error';
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2000;text-align:center;border-radius:0;';
  div.textContent = mensaje;
  document.body.prepend(div);
}
iniciar();
