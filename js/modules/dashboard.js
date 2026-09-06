export async function render(contenedor) {
  contenedor.innerHTML = `
    <h1>Dashboard</h1>
    <p class="texto-secundario">Resumen general</p>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Ventas del mes</div>
        <div class="skeleton" style="width:70%;height:28px;"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Paquetes en tránsito</div>
        <div class="skeleton" style="width:50%;height:28px;"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pendiente por cobrar</div>
        <div class="skeleton" style="width:60%;height:28px;"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cotizaciones pendientes</div>
        <div class="skeleton" style="width:40%;height:28px;"></div>
      </div>
    </div>

    <div class="section-header"><h3>Actividad reciente</h3></div>
    <div class="card">
      <div class="skeleton" style="width:90%;"></div>
      <div class="skeleton" style="width:75%;"></div>
      <div class="skeleton" style="width:85%;margin-bottom:0;"></div>
    </div>

    <div class="section-header"><h3>Acciones rápidas</h3></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <a href="#clientes" class="btn btn-secundario btn-sm">+ Cliente</a>
      <a href="#ordenes" class="btn btn-secundario btn-sm">+ Orden</a>
      <a href="#paquetes" class="btn btn-secundario btn-sm">+ Paquete</a>
    </div>
  `;
}
