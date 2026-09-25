/*
 * MÓDULO DE GESTIÓN DE PESTAÑAS
 * 
 * Responsabilidades:
 * - Cambio entre pestañas (Propuestas, Datos, Proyecto)
 * - Título clickeable que vuelve al tab principal
 * - Apertura/cierre de modales de FAQ y T&C
 */

// =============================================
// CAMBIO DE PESTAÑAS
// =============================================

/**
 * ACTIVA UNA PESTAÑA ESPECÍFICA
 * @param {string} tabName - Nombre del tab ('propuestas', 'datos', 'proyecto')
 */
function activateTab(tabName) {
    // Desactivar todos los tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activar el tab seleccionado
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`tab-${tabName}`);
    
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-selected', 'true');
    }
    if (activeContent) {
        activeContent.classList.add('active');
    }
    
    // Actualizar URL (opcional, pero útil para compartir)
    const url = new URL(window.location);
    if (tabName === 'propuestas') {
        url.searchParams.delete('tab');
    } else {
        url.searchParams.set('tab', tabName);
    }
    history.replaceState(null, '', url);
    
    // Si Leaflet está cargado, forzar un redibujado al volver a la tab de propuestas
    // (Leaflet no calcula bien su tamaño si el contenedor estaba oculto)
    if (tabName === 'propuestas' && typeof map !== 'undefined' && map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}

/**
 * INICIALIZA EL SISTEMA DE PESTAÑAS
 */
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            activateTab(tabName);
        });
    });
    
    // Título clickeable: vuelve a "propuestas"
    const title = document.getElementById('app-title');
    if (title) {
        title.addEventListener('click', function() {
            activateTab('propuestas');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    // Leer tab inicial de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab');
    if (initialTab && ['propuestas', 'datos', 'proyecto'].includes(initialTab)) {
        activateTab(initialTab);
    }
}

// =============================================
// MODALES DE FAQ Y T&C
// =============================================

/**
 * ABRE UN MODAL FULL-SCREEN
 * @param {string} modalId - ID del modal a abrir
 */
function openFullModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * CIERRA UN MODAL FULL-SCREEN
 * @param {string} modalId - ID del modal a cerrar
 */
function closeFullModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * INICIALIZA LOS MODALES DE FAQ Y T&C
 */
function initializeFooterModals() {
    // Links del footer
    const faqLink = document.getElementById('faq-link');
    const termsLink = document.getElementById('terms-link');
    
    if (faqLink) {
        faqLink.addEventListener('click', function(e) {
            e.preventDefault();
            openFullModal('faq-modal');
        });
    }
    if (termsLink) {
        termsLink.addEventListener('click', function(e) {
            e.preventDefault();
            openFullModal('terms-modal');
        });
    }
    
    // Botones de cierre
    const faqClose = document.getElementById('faq-modal-close');
    const termsClose = document.getElementById('terms-modal-close');
    
    if (faqClose) faqClose.addEventListener('click', () => closeFullModal('faq-modal'));
    if (termsClose) termsClose.addEventListener('click', () => closeFullModal('terms-modal'));
    
    // Cerrar al hacer click fuera del contenido
    ['faq-modal', 'terms-modal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) closeFullModal(modalId);
            });
        }
    });
    
    // Cerrar con Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeFullModal('faq-modal');
            closeFullModal('terms-modal');
        }
    });
}

// =============================================
// INICIALIZACIÓN
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeFooterModals();
    console.log('✅ Sistema de pestañas y modales inicializado');
});

// Exposición global
window.activateTab = activateTab;
window.openFullModal = openFullModal;
window.closeFullModal = closeFullModal;
