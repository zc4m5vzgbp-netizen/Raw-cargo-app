// Traduce errores técnicos (PostgreSQL/Supabase) a mensajes claros.
// Regla del proyecto: el frontend NUNCA muestra un error crudo de la base de datos.

const REGLAS = [
  { buscar: 'ya está entregado', mensaje: 'Este paquete ya fue entregado y no puede modificarse — su historial financiero es definitivo.' },
  { buscar: 'ya está cancelado', mensaje: 'Este paquete ya fue cancelado y no puede modificarse.' },
  { buscar: 'ya está completada', mensaje: 'Esta orden ya fue completada y no puede modificarse.' },
  { buscar: 'ya está cancelada', mensaje: 'Esta orden ya fue cancelada y no puede modificarse.' },
  { buscar: 'falta configurar el pago al repartidor', mensaje: 'No puedes marcar este paquete como entregado: falta configurar la tarifa del repartidor en Configuración.' },
  { buscar: 'supera la cantidad total del producto', mensaje: 'Estás intentando asignar más unidades de las que tiene este producto disponibles.' },
  { buscar: 'precio_lb no puede ser negativo', mensaje: 'Uno de los precios por libra en los tramos de envío es negativo. Corrígelo antes de guardar.' },
  { buscar: 'Hueco o solapamiento entre tramos', mensaje: 'Los tramos de envío tienen un hueco o se superponen entre sí. Revisa que cada tramo continúe exactamente donde termina el anterior.' },
  { buscar: 'Solo el último tramo puede quedar abierto', mensaje: 'Solo el último tramo de envío puede dejarse sin un valor en "Hasta". Revisa los demás tramos.' },
  { buscar: 'El primer tramo debe empezar en 1', mensaje: 'El primer tramo de envío debe comenzar en 1 libra.' },
  { buscar: 'no puede ser menor que', mensaje: 'En uno de los tramos, "Hasta" no puede ser menor que "Desde".' },
  { buscar: 'debe ser mayor que 0', mensaje: 'El valor "Desde" de un tramo debe ser mayor que cero.' },
  { buscar: 'deben ser numéricos', mensaje: 'Todos los valores de los tramos deben ser números válidos.' },
  { buscar: 'Cada tramo debe tener', mensaje: 'Cada tramo necesita sus tres valores completos: desde, hasta y precio por libra.' },
  { buscar: 'no puede estar vacío', mensaje: 'Debe existir al menos un tramo de envío configurado.' },
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
