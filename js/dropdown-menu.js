/*
 * MÓDULO DE DROPDOWN DE PROPUESTA
 * 
 * Responsabilidades:
 * - Apertura/cierre del dropdown
 * - Renderizado dinámico según estado de autenticación
 *
 * NOTA PARA FUTURAS MEJORAS:
 * No utilizar emojis en la interfaz visible al usuario.
 * Solo se permite su uso en mensajes de log (console.log).
 */

// =============================================
// GESTIÓN DEL DROPDOWN
// =============================================

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
        
        const saveDraftBtn = document.getElementById('dropdown-save-draft');
        const publishBtn = document.getElementById('dropdown-publish');
        const unpublishBtn = document.getElementById('dropdown-unpublish');
        const logoutBtn = document.getElementById('dropdown-logout');
        
        if (saveDraftBtn && typeof showSaveDraftModal === 'function') {
            saveDraftBtn.addEventListener('click', () => {
                closeDropdown();
                showSaveDraftModal();
            });
        }
        if (publishBtn && typeof showPublishModal === 'function') {
            publishBtn.addEventListener('click', () => {
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
                    window.location.reload();
                }
            });
        }
        
    } else {
        // Usuario no autenticado
        content.innerHTML = `
            <button class="dropdown-item" id="dropdown-load">
                <span class="dropdown-item-icon">🔑</span>
                <span>Cargar mi propuesta</span>
            </button>
            <button class="dropdown-item" id="dropdown-save-draft">
                <span class="dropdown-item-icon">💾</span>
                <span>Guardar borrador</span>
            </button>
        `;
        
        const loadBtn = document.getElementById('dropdown-load');
        const saveDraftBtn = document.getElementById('dropdown-save-draft');
        
        if (loadBtn && typeof showAccessDraftModal === 'function') {
            loadBtn.addEventListener('click', () => {
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

function initializeDropdown() {
    const trigger = document.getElementById('dropdown-trigger');
    if (trigger) {
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleDropdown();
        });
    }
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('proposal-dropdown');
        if (dropdown && !dropdown.contains(e.target)) closeDropdown();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeDropdown();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initializeDropdown();
    renderDropdownContent(null, null);
    console.log('✅ Dropdown de propuesta inicializado');
});

window.renderDropdownContent = renderDropdownContent;
window.closeDropdown = closeDropdown;
