export function formatUSD(valor) {
  return Number(valor ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatFechaHora(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-VE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatLibras(valor) {
  return `${Number(valor ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} lb`;
}

export function formatPorcentaje(decimal) {
  return `${(Number(decimal ?? 0) * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

export function formatEstado(estado) {
  const mapa = {
    pendiente_pago: 'Pendiente de pago', pagado: 'Pagado', en_proceso: 'En proceso',
    completada: 'Completada', cancelada: 'Cancelada',
    esperando_mercancia: 'Esperando mercancía', recibido_houston: 'Recibido en Houston',
    preparando_envio: 'Preparando envío', enviado: 'Enviado', en_transito: 'En tránsito',
    recibido_venezuela: 'Recibido en Venezuela', listo_entregar: 'Listo para entregar',
    entregado: 'Entregado', cancelado: 'Cancelado',
    activa: 'Activa', convertida: 'Convertida', expirada: 'Expirada',
  };
  return mapa[estado] || estado;
}
