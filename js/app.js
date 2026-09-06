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

// Estado global mínimo — solo lo realmente compartido por toda la app
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
const elNavInferior = document.getElementById('nav-inferior');
const elNavLateral = document.getElementById('nav-lateral');

async function iniciar() {
  const { data: { session } } = await supabase.auth.getSession();
  estado.sesion = session;
  session ? mostrarApp() : mostrarLogin();
}

function mostrarApp() {
  elNavInferior.style.display = '';
  elNavLateral.style.display = '';
  iniciarNavegacion(elContenido);
}

function mostrarLogin() {
  elNavInferior.style.display = 'none';
  elNavLateral.style.display = 'none';
  elContenido.innerHTML = `
    <div style="max-width:340px;margin:40px auto;">
      <h2>Raw Cargo</h2>
      <input type="email" id="login-email" class="input" placeholder="Correo">
      <input type="password" id="login-password" class="input" placeholder="Contraseña">
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

supabase.auth.onAuthStateChange((_evento, session) => {
  estado.sesion = session;
  if (!session) mostrarLogin();
});

// Aviso simple de conexión perdida (sin destruir la interfaz)
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
