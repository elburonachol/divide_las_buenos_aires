/*
 * MÓDULO DE VISTA SIMPLIFICADA
 * 
 * Responsabilidades:
 * - Detectar si la web se está mostrando en modo simplificado (ruta /propuesta/<code>)
 * - Aplicar/quitar clases y estilos para el modo simplificado
 * - Botón "Ir a la web completa" con tooltip
 * - Modal "¿Qué datos querés ver?" cuando el usuario autenticado tiene propuesta
 * - Navegación a la web completa con la propuesta elegida
 *
 * DEPENDENCIAS:
 * - auth.js (currentUser)
 * - proposals.js (loadUserProposal)
 *
 * ORDEN DE CARGA: después de proposals.js.
 */

// =============================================
// DETECCIÓN DE MODO
// =============================================

// El flag se calcula al cargar el archivo (antes de los DOMContentLoaded
// de otros módulos) para que todos lean el valor correcto desde el inicio.
// Es un booleano: true si estamos en /propuesta/<code>, false en el resto.
window.isSimplifiedMode = /\/propuesta\/[a-z0-9]+/.test(window.location.pathname);

// =============================================
// APLICACIÓN DEL MODO
// =============================================

/**
 * APLICA EL MODO SIMPLIFICADO A LA INTERFAZ
 * Agrega la clase al body; el CSS se encarga de ocultar los controles.
 */
function applySimplifiedMode() {
    if (window.isSimplifiedMode !== true) return;
    document.body.classList.add('simplified-mode');
    console.log('🔒 Modo simplificado activado');
}

// =============================================
// BOTÓN "IR A LA WEB COMPLETA"
// =============================================

function setupGoFullWebButton() {
    const btn = document.getElementById('go-full-web-btn');
    if (!btn) return;
    if (btn.dataset.listenerAttached === 'true') return;
    btn.dataset.listenerAttached = 'true';
    btn.addEventListener('click', goToFullWeb);
}

/**
 * NAVEGA A LA WEB COMPLETA CON LA PROPUESTA ADECUADA
 * - Autenticado con propuesta guardada: abre modal de elección.
 * - Resto: navega a / con la propuesta que estaba viendo.
 */
async function goToFullWeb() {
    const viewedProposal = window.currentViewedProposal || null;
    const user = typeof window.currentUser === 'function' ? window.currentUser() : null;
    
    if (user) {
        const ownProposal = await loadUserProposal();
        if (ownProposal) {
            showDataChoiceModal(ownProposal, viewedProposal);
            return;
        }
    }
    navigateToFullWebWithProposal(viewedProposal);
}

/**
 * MODAL DE ELECCIÓN DE DATOS
 */
function showDataChoiceModal(ownProposal, viewedProposal) {
    if (document.getElementById('data-choice-modal-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'data-choice-modal-overlay';
    overlay.className = 'data-choice-modal-overlay';
    
    overlay.innerHTML = `
        <div class="data-choice-modal">
            <button class="close-x" id="data-choice-close" aria-label="Cerrar">×</button>
            <h3>¿Qué datos querés ver en la web completa?</h3>
            <p>Elegí con qué información querés continuar.</p>
            <div class="data-choice-buttons">
                <button class="primary" id="data-choice-own">Los datos de mi propuesta guardada</button>
                <button class="secondary" id="data-choice-viewed">Los datos de la propuesta que estoy viendo</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    function close() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    
    document.getElementById('data-choice-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', escHandler);
        }
    });
    
    document.getElementById('data-choice-own').addEventListener('click', function() {
        close();
        navigateToFullWebWithProposal(ownProposal);
    });
    document.getElementById('data-choice-viewed').addEventListener('click', function() {
        close();
        navigateToFullWebWithProposal(viewedProposal);
    });
}

/**
 * NAVEGA A LA WEB COMPLETA CON LA PROPUESTA INDICADA
 * Guarda la propuesta en sessionStorage para que main.js la cargue al iniciar.
 */
function navigateToFullWebWithProposal(proposal) {
    try {
        if (proposal) {
            sessionStorage.setItem('divide_ba_proposal_to_load', JSON.stringify(proposal));
        } else {
            sessionStorage.removeItem('divide_ba_proposal_to_load');
        }
        // Marca que viene de la versión simplificada (para no mostrar tutorial)
        sessionStorage.setItem('divide_ba_came_from_simplified', 'true');
    } catch (err) {
        console.error('Error guardando propuesta en sessionStorage:', err);
    }
    window.location.href = window.location.origin + '/';
}

// =============================================
// INICIALIZACIÓN
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    if (window.isSimplifiedMode === true) {
        applySimplifiedMode();
        setupGoFullWebButton();
    }
});

window.goToFullWeb = goToFullWeb;

console.log('✅ Módulo de vista simplificada inicializado');
