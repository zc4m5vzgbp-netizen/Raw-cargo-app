import { supabase } from './supabase.js';
import { registrarRuta, iniciarNavegacion } from './utils/navigation.js';
import { traducirError } from './utils/errors.js';
import { mostrarExito } from './utils/ui.js';

import * as dashboard from './modules/dashboard.js';
import * as clientes from './modules/clientes.js';
import * as ordenes from './modules/ordenes.js';
import * as paquetes from './modules/paquetes.js';
import * as pagos from './modules/pagos.js';
import * as gastos from './modules/gastos.js';
import * as finanzas from './modules/finanzas.js';
import * as configuracion from './modules/configuracion.js';
import * as historial from './modules/historial.js';

export const estado = { sesion: null };

registrarRuta('dashboard', dashboard.render);
registrarRuta('clientes', clientes.render);
registrarRuta('ordenes', ordenes.render);
registrarRuta('paquetes', paquetes.render);
registrarRuta('pagos', pagos.render);
registrarRuta('gastos', gastos.render);
registrarRuta('finanzas', finanzas.render);
registrarRuta('configuracion', configuracion.render);
registrarRuta('historial', historial.render);

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

function mostrarApp() {
  elHeader.style.display = '';
  elNavInferior.style.display = '';
  elNavLateral.style.display = '';
  actualizarUsuarioHeader();
  iniciarNavegacion(elContenido);
}

function mostrarLogin() {
  elHeader.style.display = 'none';
  elNavInferior.style.display = 'none';
  elNavLateral.style.display = 'none';
  elContenido.innerHTML = `
    <div style="max-width:340px;margin:60px auto 0;">
      <div style="text-align:center;margin-bottom:24px;">
        <div class="logo-placeholder" style="width:48px;height:48px;font-size:18px;margin:0 auto 8px;">RC</div>
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
