/*
 * MÓDULO DE GESTIÓN DE PESTAÑAS
 * 
 * Responsabilidades:
 * - Cambio entre pestañas principales y sub-pestañas
 * - Routing por URL para FAQ, T&C, Privacidad y Contacto
 * - Título clickeable que vuelve al tab principal
 *
 * NOTA PARA FUTURAS MEJORAS:
 * No utilizar emojis en la interfaz visible al usuario.
 * Solo se permite su uso en mensajes de log (console.log).
 */

// =============================================
// GESTIÓN DE PESTAÑAS PRINCIPALES
// =============================================

function activateTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`tab-${tabName}`);
    
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-selected', 'true');
    }
    if (activeContent) activeContent.classList.add('active');
    
    if (tabName === 'propuestas' && typeof map !== 'undefined' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

// =============================================
// GESTIÓN DE SUB-PESTAÑAS (dentro de "Sobre los datos")
// =============================================

function activateSubTab(subTabName) {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`.sub-tab-btn[data-subtab="${subTabName}"]`);
    const activeContent = document.getElementById(`subtab-${subTabName}`);
    
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-selected', 'true');
    }
    if (activeContent) activeContent.classList.add('active');
}

function initializeSubTabs() {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            activateSubTab(this.getAttribute('data-subtab'));
        });
    });
}

// =============================================
// GESTIÓN DE MODALES FULL-SCREEN
// =============================================

function openFullModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeFullModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// =============================================
// ROUTING POR URL (FAQ, T&C, PRIVACIDAD, CONTACTO)
// =============================================

/**
 * Aplica la vista según la URL actual.
 * Se llama al cargar y en cada cambio de history.
 */
function applyRouteFromURL() {
    const path = window.location.pathname.replace(/\/$/, ''); // sin barra final
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    // 1) Modales por URL
    if (path === '/faq') {
        openFullModal('faq-modal');
        return;
    }
    if (path === '/terminos') {
        openFullModal('terms-modal');
        return;
    }
    if (path === '/privacidad') {
        openFullModal('privacy-modal');
        return;
    }
    // 2) Contacto por URL
    if (path === '/contacto') {
        activateTab('contacto');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    // 3) Tab por query param (?tab=datos, etc.)
    if (tabParam && ['propuestas', 'datos', 'proyecto', 'contacto'].includes(tabParam)) {
        activateTab(tabParam);
        return;
    }
    // 4) Ruta por defecto: propuestas
    activateTab('propuestas');
}

/**
 * Navega a una URL usando history API para no recargar la página.
 * @param {string} url - URL destino (ej: '/faq')
 * @param {Function} afterFn - Función a ejecutar después de cambiar la URL
 */
function navigateTo(url, afterFn) {
    history.pushState({}, '', url);
    if (typeof afterFn === 'function') afterFn();
}

/**
 * Vuelve a la URL raíz.
 */
function navigateHome() {
    history.pushState({}, '', '/');
    closeFullModal('faq-modal');
    closeFullModal('terms-modal');
    closeFullModal('privacy-modal');
    activateTab('propuestas');
}

// =============================================
// INICIALIZACIÓN DE TABS Y MODALES
// =============================================

function initializeTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            activateTab(tabName);
            // Actualizar URL
            const url = (tabName === 'propuestas') ? '/' : `/?tab=${tabName}`;
            history.pushState({}, '', url);
        });
    });
    
    // Título clickeable
    const title = document.getElementById('app-title');
    if (title) {
        title.addEventListener('click', function() {
            history.pushState({}, '', '/');
            activateTab('propuestas');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    // Sub-tabs
    initializeSubTabs();
    
    // Aplicar ruta inicial
    applyRouteFromURL();
}

function initializeFooterModals() {
    // Links del footer
    const faqLink = document.getElementById('faq-link');
    const termsLink = document.getElementById('terms-link');
    const privacyLink = document.getElementById('privacy-link');
    
    if (faqLink) {
        faqLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo('/faq', () => openFullModal('faq-modal'));
        });
    }
    if (termsLink) {
        termsLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo('/terminos', () => openFullModal('terms-modal'));
        });
    }
    if (privacyLink) {
        privacyLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo('/privacidad', () => openFullModal('privacy-modal'));
        });
    }
    
    // Botones de cierre
    const faqClose = document.getElementById('faq-modal-close');
    const termsClose = document.getElementById('terms-modal-close');
    const privacyClose = document.getElementById('privacy-modal-close');
    
    if (faqClose) faqClose.addEventListener('click', () => navigateHome());
    if (termsClose) termsClose.addEventListener('click', () => navigateHome());
    if (privacyClose) privacyClose.addEventListener('click', () => navigateHome());
    
    // Cerrar al hacer click fuera
    ['faq-modal', 'terms-modal', 'privacy-modal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) navigateHome();
            });
        }
    });
    
    // Cerrar con Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeFullModal('faq-modal');
            closeFullModal('terms-modal');
            closeFullModal('privacy-modal');
            if (window.location.pathname !== '/') {
                history.pushState({}, '', '/');
            }
        }
    });
    
    // Navegación con botones del navegador
    window.addEventListener('popstate', function() {
        // Cerrar todos los modales y aplicar la ruta
        closeFullModal('faq-modal');
        closeFullModal('terms-modal');
        closeFullModal('privacy-modal');
        applyRouteFromURL();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeFooterModals();
    console.log('✅ Sistema de pestañas y modales inicializado');
});

window.activateTab = activateTab;
window.activateSubTab = activateSubTab;
window.openFullModal = openFullModal;
window.closeFullModal = closeFullModal;
