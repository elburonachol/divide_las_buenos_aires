/*
 * MÓDULO DE DROPDOWN DE PROPUESTA
 * 
 * Responsabilidades:
 * - Apertura/cierre del dropdown
 * - Renderizado dinámico según estado de autenticación
 * - Manejo del checkbox de términos y condiciones
 */

// =============================================
// GESTIÓN DEL DROPDOWN
// =============================================

/**
 * ABRE O CIERRA EL DROPDOWN
 */
function toggleDropdown() {
    const dropdown = document.getElementById('proposal-dropdown');
    const trigger = document.getElementById('dropdown-trigger');
    
    if (!dropdown || !trigger) return;
    
    const isOpen = dropdown.classList.contains('open');
    
    if (isOpen) {
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
    } else {
        dropdown.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
    }
}

/**
 * CIERRA EL DROPDOWN
 */
function closeDropdown() {
    const dropdown = document.getElementById('proposal-dropdown');
    const trigger = document.getElementById('dropdown-trigger');
    
    if (dropdown) dropdown.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

/**
 * RENDERIZA EL CONTENIDO DEL DROPDOWN SEGÚN EL ESTADO DE AUTENTICACIÓN
 * @param {Object|null} user - Usuario autenticado o null
 * @param {Object|null} proposal - Propuesta del usuario o null
 */
function renderDropdownContent(user, proposal) {
    const content = document.getElementById('dropdown-content');
    if (!content) return;
    
    if (user) {
        // Usuario autenticado
        const proposalTitle = proposal ? proposal.titulo : 'Sin título';
        const isPublic = proposal && proposal.es_publica;
        
        content.innerHTML = `
            <div class="dropdown-user-info">
                <div class="dropdown-user-email">${user.email}</div>
                <div class="dropdown-proposal-title">${proposalTitle}</div>
            </div>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" id="dropdown-save-draft">
                <span class="dropdown-item-icon">💾</span>
                <span>Guardar borrador</span>
            </button>
            <button class="dropdown-item" id="dropdown-publish">
                <span class="dropdown-item-icon">🌐</span>
                <span>Guardar y compartir propuesta</span>
            </button>
            <label class="dropdown-terms-checkbox">
                <input type="checkbox" id="dropdown-terms-check">
                <span>Acepto los <a href="#" id="dropdown-terms-link">términos y condiciones</a> del sitio</span>
            </label>
            ${isPublic ? `
                <button class="dropdown-item danger" id="dropdown-unpublish">
                    <span class="dropdown-item-icon">🔒</span>
                    <span>Ocultar propuesta pública</span>
                </button>
            ` : ''}
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" id="dropdown-logout">
                <span class="dropdown-item-icon">🚪</span>
                <span>Cerrar sesión</span>
            </button>
        `;
        
        // Configurar botones
        const saveDraftBtn = document.getElementById('dropdown-save-draft');
        const publishBtn = document.getElementById('dropdown-publish');
        const unpublishBtn = document.getElementById('dropdown-unpublish');
        const logoutBtn = document.getElementById('dropdown-logout');
        const termsLink = document.getElementById('dropdown-terms-link');
        
        if (saveDraftBtn && typeof showSaveDraftModal === 'function') {
            saveDraftBtn.addEventListener('click', () => {
                closeDropdown();
                showSaveDraftModal();
            });
        }
        
        if (publishBtn && typeof showPublishModal === 'function') {
            publishBtn.addEventListener('click', () => {
                const termsCheck = document.getElementById('dropdown-terms-check');
                if (!termsCheck || !termsCheck.checked) {
                    alert('Debés aceptar los términos y condiciones para publicar tu propuesta.');
                    return;
                }
                closeDropdown();
                showPublishModal();
            });
        }
        
        if (unpublishBtn && typeof showUnpublishModal === 'function') {
            unpublishBtn.addEventListener('click', () => {
                closeDropdown();
                showUnpublishModal();
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                closeDropdown();
                if (window.supabaseClient) {
                    await window.supabaseClient.auth.signOut();
                    // Recargar la página para limpiar el estado
                    window.location.reload();
                }
            });
        }
        
        if (termsLink) {
            termsLink.addEventListener('click', (e) => {
                e.preventDefault();
                closeDropdown();
                if (typeof openFullModal === 'function') {
                    openFullModal('terms-modal');
                }
            });
        }
        
    } else {
        // Usuario no autenticado
        content.innerHTML = `
            <button class="dropdown-item" id="dropdown-access">
                <span class="dropdown-item-icon">🔑</span>
                <span>Acceder a mi propuesta</span>
            </button>
            <button class="dropdown-item" id="dropdown-save-draft">
                <span class="dropdown-item-icon">💾</span>
                <span>Guardar borrador</span>
            </button>
        `;
        
        const accessBtn = document.getElementById('dropdown-access');
        const saveDraftBtn = document.getElementById('dropdown-save-draft');
        
        if (accessBtn && typeof showAccessDraftModal === 'function') {
            accessBtn.addEventListener('click', () => {
                closeDropdown();
                showAccessDraftModal();
            });
        }
        
        if (saveDraftBtn && typeof showSaveDraftModal === 'function') {
            saveDraftBtn.addEventListener('click', () => {
                closeDropdown();
                showSaveDraftModal();
            });
        }
    }
}

/**
 * INICIALIZA EL SISTEMA DE DROPDOWN
 */
function initializeDropdown() {
    const trigger = document.getElementById('dropdown-trigger');
    
    if (trigger) {
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleDropdown();
        });
    }
    
    // Cerrar al hacer click fuera
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('proposal-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            closeDropdown();
        }
    });
    
    // Cerrar con Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeDropdown();
    });
}

// =============================================
// INICIALIZACIÓN
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeDropdown();
    // Renderizar contenido inicial (sin usuario)
    renderDropdownContent(null, null);
    console.log('✅ Dropdown de propuesta inicializado');
});

// Exposición global
window.renderDropdownContent = renderDropdownContent;
window.closeDropdown = closeDropdown;
