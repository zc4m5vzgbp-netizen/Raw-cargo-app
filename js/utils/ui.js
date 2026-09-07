export function confirmar({ mensaje, detalle = '', textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', primarioEs = 'confirmar' }) {
  return new Promise((resolve) => {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `
      <div class="modal">
        <p>${mensaje}</p>
        ${detalle ? `<p class="texto-secundario">${detalle}</p>` : ''}
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn ${primarioEs === 'cancelar' ? 'btn-primario' : 'btn-secundario'} btn-sm" id="confirmar-no" style="flex:1;">${textoCancelar}</button>
          <button class="btn ${primarioEs === 'cancelar' ? 'btn-secundario' : 'btn-primario'} btn-sm" id="confirmar-si" style="flex:1;">${textoConfirmar}</button>
        </div>
      </div>
    `;
    document.body.appendChild(fondo);
    fondo.querySelector('#confirmar-no').addEventListener('click', () => { fondo.remove(); resolve(false); });
    fondo.querySelector('#confirmar-si').addEventListener('click', () => { fondo.remove(); resolve(true); });
  });
}

export function huboCambios(valoresIniciales, valoresActuales) {
  return JSON.stringify(valoresIniciales) !== JSON.stringify(valoresActuales);
}
