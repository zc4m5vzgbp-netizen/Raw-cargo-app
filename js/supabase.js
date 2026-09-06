// Responsable ÚNICAMENTE de inicializar Supabase y exportar el cliente.
// NUNCA debe contener aquí: service_role, secret keys, contraseñas ni ninguna credencial privada.
// La librería se carga como <script> normal en index.html; aquí solo la usamos vía window.supabase.

const SUPABASE_URL = "https://oumjwuuoqeqafwkaeqtl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZEyRCvJrmjcIS5wliTLjjA_LgDEqRJC";

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
