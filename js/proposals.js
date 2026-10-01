/*
 * MÓDULO DE GESTIÓN DE PROPUESTAS
 * 
 * Responsabilidades:
 * - Serialización del estado actual de la propuesta
 * - Persistencia temporal en localStorage
 * - Guardado y carga en Supabase (borrador y pública)
 * - Modales de publicación y ocultamiento de propuestas
 *
 * DEPENDENCIAS:
 * - supabase-client.js (cliente Supabase global)
 * - auth.js (estado de sesión: currentUser, currentProposal)
 *
 * ORDEN DE CARGA: después de supabase-client.js y auth.js.
 */

// =============================================
// CLAVE DE LOCALSTORAGE
// =============================================

const LOCAL_STORAGE_KEY = 'divide_las_ba_propuesta_pendiente';

// =============================================
// SERIALIZACIÓN DE PROPUESTAS
// =============================================

/**
 * SERIALIZA EL ESTADO ACTUAL DE LA PROPUESTA
 * Extrae toda la información relevante de las variables globales.
 * @returns {Object} - Objeto con la propuesta serializada
 */
function serializeProposal() {
    const nombresDivisiones = [];
    const departamentosPorDivision = {};
    
    for (let i = 1; i <= currentDivisionCount; i++) {
        const group = departmentGroups[i];
        if (group) {
            nombresDivisiones.push(group.name || `División ${i}`);
            departamentosPorDivision[i] = group.departments || [];
        }
    }
    
    const departamentosEnListado = [];
    const listContainer = document.getElementById('all-departments-list');
    if (listContainer) {
        listContainer.querySelectorAll('.department-item').forEach(item => {
            const nombre = item.getAttribute('data-dept-name');
            if (nombre) departamentosEnListado.push(nombre);
        });
    }
    
    return {
        titulo: '',
        incluye_comunas_caba: comunasIncluidas,
        cantidad_divisiones: currentDivisionCount,
        nombres_divisiones: nombresDivisiones,
        departamentos_por_division: departamentosPorDivision,
        departamentos_en_listado: departamentosEnListado
    };
}

// =============================================
// PERSISTENCIA EN LOCALSTORAGE
// =============================================

/**
 * GUARDA LA PROPUESTA EN LOCALSTORAGE (usuarios no autenticados)
 */
function saveProposalToLocalStorage(proposal) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(proposal));
        console.log('✅ Propuesta guardada en localStorage');
    } catch (err) {
        console.error('❌ Error al guardar en localStorage:', err);
    }
}

/**
 * LEE LA PROPUESTA DESDE LOCALSTORAGE
 * @returns {Object|null} - Propuesta guardada o null
 */
function loadProposalFromLocalStorage() {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (data) {
            console.log('✅ Propuesta recuperada de localStorage');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('❌ Error al leer localStorage:', err);
    }
    return null;
}

/**
 * ELIMINA LA PROPUESTA DE LOCALSTORAGE
 */
function clearProposalFromLocalStorage() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('✅ Propuesta eliminada de localStorage');
}

// =============================================
// PERSISTENCIA EN SUPABASE
// =============================================

/**
 * GUARDA O ACTUALIZA LA PROPUESTA EN SUPABASE
 * @param {Object} proposalData - Datos de la propuesta
 * @param {boolean} esPublica - Si es pública o borrador
 * @returns {Promise<Object|null>} - Propuesta guardada o null
 */
async function saveProposalToSupabase(proposalData, esPublica = false) {
    const user = window.currentUser();
    if (!user) {
        console.error('❌ No hay usuario autenticado');
        return null;
    }

    const dataToSave = {
        user_id: user.id,
        titulo: proposalData.titulo || 'Mi propuesta',
        es_publica: esPublica,
        incluye_comunas_caba: proposalData.incluye_comunas_caba || false,
        cantidad_divisiones: proposalData.cantidad_divisiones || 3,
        nombres_divisiones: proposalData.nombres_divisiones || [],
        departamentos_por_division: proposalData.departamentos_por_division || {},
        departamentos_en_listado: proposalData.departamentos_en_listado || [],
        updated_at: new Date().toISOString()
    };

    const { data: existing } = await supabaseClient
        .from('proposals')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

    let result;
    if (existing) {
        result = await supabaseClient
            .from('proposals')
            .update(dataToSave)
            .eq('id', existing.id)
            .select()
            .single();
    } else {
        result = await supabaseClient
            .from('proposals')
            .insert([dataToSave])
            .select()
            .single();
    }

    if (result.error) {
        console.error('❌ Error al guardar propuesta:', result.error);
        return null;
    }

    console.log('✅ Propuesta guardada en Supabase');
    return result.data;
}

/**
 * CARGA LA PROPUESTA DEL USUARIO AUTENTICADO
 * @returns {Promise<Object|null>} - Propuesta del usuario o null
 */
async function loadUserProposal() {
    const user = window.currentUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
        .from('proposals')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('❌ Error al cargar propuesta:', error);
        return null;
    }

    return data;
}

/**
 * CARGA UNA PROPUESTA PÚBLICA POR user_share_code
 * @param {string} shareCode - Código de usuario
 * @returns {Promise<Object|null>} - Propuesta pública o null
 */
async function loadPublicProposal(shareCode) {
    const { data, error } = await supabaseClient
        .rpc('get_proposal_by_share_code', { share_code: shareCode });

    if (error) {
        console.error('❌ Error al cargar propuesta pública:', error);
        return null;
    }

    return data && data.length > 0 ? data[0] : null;
}

// =============================================
// MODALES DE PUBLICACIÓN
// =============================================

/**
 * MUESTRA EL MODAL DE PUBLICAR PROPUESTA
 * Pide título definitivo, valida términos y condiciones,
 * y publica la propuesta en Supabase.
 */
function showPublishModal() {
    const user = window.currentUser();
    if (!user) {
        alert('Debés iniciar sesión para publicar tu propuesta.');
        return;
    }

    const proposal = serializeProposal();
    const currentProp = window.currentProposal();
    const defaultTitle = currentProp ? currentProp.titulo : 'Mi propuesta';

    const modal = document.createElement('div');
    modal.id = 'publish-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: Arial, sans-serif;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 8px;
            max-width: 450px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            position: relative;
        ">
            <button id="publish-close" style="
                position: absolute;
                top: 10px; right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
            ">×</button>
            <h3 style="margin-top: 0; color: #333;">Guardar y compartir propuesta</h3>
            <p style="color: #666; font-size: 13px; margin-bottom: 20px;">
                Solo es posible almacenar una propuesta por usuario. Si ya tenías una, se va a sobrescribir.
            </p>
            
            <label for="publish-title" style="display: block; font-weight: bold; margin-bottom: 5px;">Título definitivo</label>
            <input type="text" id="publish-title" value="${defaultTitle}" style="
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
                margin-bottom: 15px;
                font-size: 15px;
            " maxlength="40" minlength="3">
            <p style="font-size: 11px; color: #999; margin-bottom: 15px;">
                Mínimo 3 caracteres, máximo 40.
            </p>
            
            <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #666; margin-bottom: 15px; cursor: pointer;">
                <input type="checkbox" id="publish-terms-check" style="margin-top: 2px;">
                <span>Acepto los <a href="/terminos" id="publish-terms-link" style="color: #3388ff; text-decoration: underline;">términos y condiciones</a> del sitio</span>
            </label>
            
            <button id="publish-confirm" style="
                background: #27ae60;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 15px;
                width: 100%;
            ">Publicar y obtener enlace</button>
            
            <div id="publish-result" style="display: none; margin-top: 20px; text-align: center;">
                <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                    Tu propuesta está publicada. Compartí este enlace:
                </p>
                <div style="
                    background: #f5f5f5;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                    word-break: break-all;
                    font-size: 13px;
                    color: #333;
                " id="publish-share-url"></div>
                <button id="publish-copy-btn" style="
                    background: #3388ff;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                ">Copiar enlace</button>
            </div>
            
            <div id="publish-error" style="display: none; color: #d32f2f; font-size: 13px; margin-top: 10px;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    const titleInput = document.getElementById('publish-title');
    const confirmBtn = document.getElementById('publish-confirm');
    const closeBtn = document.getElementById('publish-close');
    const resultDiv = document.getElementById('publish-result');
    const shareUrlDiv = document.getElementById('publish-share-url');
    const copyBtn = document.getElementById('publish-copy-btn');
    const errorDiv = document.getElementById('publish-error');
    const termsLink = document.getElementById('publish-terms-link');

    function showError(msg) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = msg;
        setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }

    if (termsLink) {
        termsLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (modal.parentNode) modal.parentNode.removeChild(modal);
            openFullModal('terms-modal');
        });
    }

    confirmBtn.addEventListener('click', async function() {
        const titulo = titleInput.value.trim();
        const termsCheck = document.getElementById('publish-terms-check');
        if (!termsCheck || !termsCheck.checked) {
            showError('Debés aceptar los términos y condiciones para publicar tu propuesta.');
            return;
        }
        if (titulo.length < 3 || titulo.length > 40) {
            showError('El título debe tener entre 3 y 40 caracteres.');
            return;
        }

        proposal.titulo = titulo;
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Publicando...';
        
        const result = await saveProposalToSupabase(proposal, true);
        
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Publicar y obtener enlace';

        if (result) {
            // Notificar a auth.js sobre el cambio
            if (typeof window.setCurrentProposal === 'function') {
                window.setCurrentProposal(result);
            }
            const shareCode = result.user_share_code;
            const shareUrl = `${window.location.origin}/propuesta/${shareCode}`;
            
            shareUrlDiv.textContent = shareUrl;
            resultDiv.style.display = 'block';
            confirmBtn.style.display = 'none';
            
            if (typeof window.updateAuthUI === 'function') {
                window.updateAuthUI();
            }
        } else {
            showError('Error al publicar la propuesta. Intentá nuevamente.');
        }
    });

    copyBtn.addEventListener('click', function() {
        const url = shareUrlDiv.textContent;
        navigator.clipboard.writeText(url).then(() => {
            copyBtn.textContent = '¡Enlace copiado!';
            setTimeout(() => { copyBtn.textContent = 'Copiar enlace'; }, 2000);
        }).catch(err => {
            console.error('Error al copiar:', err);
        });
    });

    function closeModal() {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });
}

/**
 * MUESTRA EL MODAL DE OCULTAR PROPUESTA PÚBLICA
 * Pasa la propuesta a borrador (es_publica = false) previa confirmación.
 */
function showUnpublishModal() {
    const user = window.currentUser();
    const proposal = window.currentProposal();
    if (!user || !proposal) return;
    
    if (confirm('¿Estás seguro de que querés ocultar tu propuesta pública? Dejará de ser accesible para otros usuarios.')) {
        saveProposalToSupabase(proposal, false).then(result => {
            if (result) {
                if (typeof window.setCurrentProposal === 'function') {
                    window.setCurrentProposal(result);
                }
                alert('Propuesta ocultada exitosamente.');
                if (typeof window.updateAuthUI === 'function') {
                    window.updateAuthUI();
                }
            }
        });
    }
}

// =============================================
// EXPOSICIÓN PÚBLICA
// =============================================

window.serializeProposal = serializeProposal;
window.saveProposalToLocalStorage = saveProposalToLocalStorage;
window.loadProposalFromLocalStorage = loadProposalFromLocalStorage;
window.clearProposalFromLocalStorage = clearProposalFromLocalStorage;
window.saveProposalToSupabase = saveProposalToSupabase;
window.loadUserProposal = loadUserProposal;
window.loadPublicProposal = loadPublicProposal;
window.showPublishModal = showPublishModal;
window.showUnpublishModal = showUnpublishModal;

console.log('✅ Módulo de propuestas inicializado');
