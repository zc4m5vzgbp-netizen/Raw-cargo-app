// Traduce errores técnicos (PostgreSQL/Supabase) a mensajes claros.
// Regla del proyecto: el frontend NUNCA muestra un error crudo de la base de datos.

const REGLAS = [
  { buscar: 'ya está entregado', mensaje: 'Este paquete ya fue entregado y no puede modificarse — su historial financiero es definitivo.' },
  { buscar: 'ya está cancelado', mensaje: 'Este paquete ya fue cancelado y no puede modificarse.' },
  { buscar: 'ya está completada', mensaje: 'Esta orden ya fue completada y no puede modificarse.' },
  { buscar: 'ya está cancelada', mensaje: 'Esta orden ya fue cancelada y no puede modificarse.' },
  { buscar: 'falta configurar el pago al repartidor', mensaje: 'No puedes marcar este paquete como entregado: falta configurar la tarifa del repartidor en Configuración.' },
  { buscar: 'supera la cantidad total del producto', mensaje: 'Estás intentando asignar más unidades de las que tiene este producto disponibles.' },
  { buscar: 'precio_lb no puede ser negativo', mensaje: 'Uno de los precios por libra en la configuración de tarifas es negativo. Corrígelo antes de guardar.' },
  { buscar: 'Hueco o solapamiento entre tramos', mensaje: 'Los tramos de tarifa de envío tienen un hueco o se superponen. Revisa la configuración.' },
  { buscar: 'No hay ninguna configuración marcada como actual', mensaje: 'No hay ninguna configuración de tarifas activa. Contacta al administrador del sistema.' },
  { buscar: 'violates not-null constraint', mensaje: 'Falta completar un campo obligatorio.' },
  { buscar: 'Invalid login credentials', mensaje: 'Correo o contraseña incorrectos.' },
  { buscar: 'Failed to fetch', mensaje: 'No se pudo conectar. Revisa tu conexión a internet e intenta de nuevo.' },
];

export function traducirError(error) {
  const texto = (error && (error.message || String(error))) || '';
  const regla = REGLAS.find((r) => texto.includes(r.buscar));
  return regla ? regla.mensaje : 'Ocurrió un problema inesperado. Intenta nuevamente en un momento.';
}
