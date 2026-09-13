/*
 * MÓDULO DE AUTENTICACIÓN POR MAGIC LINK Y GESTIÓN DE PROPUESTAS
 * 
 * Responsabilidades:
 * - Envío de magic link con redirección a propuesta específica
 * - Manejo de localStorage para propuestas de usuarios no autenticados
 * - Guardado de propuestas en Supabase (borrador y pública)
 * - Publicación de propuestas y generación de URL para compartir
 * - Gestión de modales de autenticación y publicación
 */

// =============================================
// CONFIGURACIÓN DEL CLIENTE SUPABASE
// =============================================

if (typeof window.SUPABASE_CONFIG === 'undefined') {
    console.error('❌ SUPABASE_CONFIG no definido. Verificar build.js');
}

const supabaseUrl = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || '';
const supabaseAnonKey = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.anonKey) || '';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// =============================================
// ESTADO DEL MÓDULO
// =============================================

let currentUser = null;
let currentEmail = '';
let currentProposal = null;
const LOCAL_STORAGE_KEY = 'divide_las_ba_propuesta_pendiente';

// =============================================
// FUNCIONES DE PROPUESTA (SERIALIZACIÓN)
// =============================================

/**
 * SERIALIZA EL ESTADO ACTUAL DE LA PROPUESTA
 * Extrae toda la información relevante de las variables globales
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
    
    // Departamentos que quedaron en el listado principal
    const departamentosEnListado = [];
    const listContainer = document.getElementById('all-departments-list');
    if (listContainer) {
        listContainer.querySelectorAll('.department-item').forEach(item => {
            const nombre = item.getAttribute('data-dept-name');
            if (nombre) departamentosEnListado.push(nombre);
        });
    }
    
    return {
        titulo: '', // Se completa en el modal
        incluye_comunas_caba: comunasIncluidas,
        cantidad_divisiones: currentDivisionCount,
        nombres_divisiones: nombresDivisiones,
        departamentos_por_division: departamentosPorDivision,
        departamentos_en_listado: departamentosEnListado
    };
}

/**
 * GUARDA LA PROPUESTA EN LOCALSTORAGE
 * Se usa cuando el usuario no está autenticado
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
// FUNCIONES DE AUTENTICACIÓN
// =============================================

/**
 * ENVÍA UN MAGIC LINK CON REDIRECCIÓN A UNA RUTA ESPECÍFICA
 * @param {string} email - Correo electrónico del usuario
 * @param {string} redirectPath - Ruta a la que redirigir después de autenticar
 * @returns {Promise<boolean>} - True si se envió correctamente
 */
async function sendMagicLink(email, redirectPath = '') {
    try {
        // Construir URL de redirección con parámetro
        const baseUrl = window.location.origin + window.location.pathname;
        const redirectUrl = redirectPath 
            ? `${baseUrl}?redirect=${encodeURIComponent(redirectPath)}`
            : baseUrl;
        
        const { data, error } = await supabaseClient.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: redirectUrl
            }
        });

        if (error) {
            console.error('❌ Error al enviar enlace:', error);
            return false;
        }

        console.log('✅ Enlace mágico enviado a:', email);
        currentEmail = email;
        return true;
    } catch (err) {
        console.error('❌ Excepción en sendMagicLink:', err);
        return false;
    }
}

/**
 * CREA O ACTUALIZA EL PERFIL DEL USUARIO
 * @param {Object} user - Objeto usuario de Supabase
 */
async function createOrUpdateProfile(user) {
    if (!user) return;

    const { data: existingProfile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (existingProfile) {
        await supabaseClient
            .from('profiles')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', user.id);
    } else {
        await supabaseClient
            .from('profiles')
            .insert([{
                id: user.id,
                email: user.email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                mapas_guardados: 0
            }]);
    }
}

/**
 * GUARDA O ACTUALIZA LA PROPUESTA EN SUPABASE
 * @param {Object} proposalData - Datos de la propuesta
 * @param {boolean} esPublica - Si es pública o borrador
 * @returns {Promise<Object|null>} - Propuesta guardada o null
 */
async function saveProposalToSupabase(proposalData, esPublica = false) {
    if (!currentUser) {
        console.error('❌ No hay usuario autenticado');
        return null;
    }

    const dataToSave = {
        user_id: currentUser.id,
        titulo: proposalData.titulo || 'Mi propuesta',
        es_publica: esPublica,
        incluye_comunas_caba: proposalData.incluye_comunas_caba || false,
        cantidad_divisiones: proposalData.cantidad_divisiones || 3,
        nombres_divisiones: proposalData.nombres_divisiones || [],
        departamentos_por_division: proposalData.departamentos_por_division || {},
        departamentos_en_listado: proposalData.departamentos_en_listado || [],
        updated_at: new Date().toISOString()
    };

    // Buscar si ya existe una propuesta del usuario
    const { data: existing } = await supabaseClient
        .from('proposals')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    let result;
    if (existing) {
        // Actualizar
        result = await supabaseClient
            .from('proposals')
            .update(dataToSave)
            .eq('id', existing.id)
            .select()
            .single();
    } else {
        // Insertar
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
    if (!currentUser) return null;

    const { data, error } = await supabaseClient
        .from('proposals')
        .select('*')
        .eq('user_id', currentUser.id)
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
// DETECCIÓN DE SESIÓN Y REDIRECCIÓN
// =============================================

/**
 * ESCUCHA CAMBIOS EN EL ESTADO DE AUTENTICACIÓN
 */
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('🔐 Auth state change:', event);
    
    if (event === 'SIGNED_IN' && session && session.user) {
        currentUser = session.user;
        await createOrUpdateProfile(session.user);
        
        // Verificar si hay una propuesta pendiente en localStorage
        const pendingProposal = loadProposalFromLocalStorage();
        if (pendingProposal) {
            // Guardar la propuesta pendiente en Supabase
            await saveProposalToSupabase(pendingProposal, false);
            clearProposalFromLocalStorage();
            console.log('✅ Propuesta pendiente guardada en Supabase');
        }
        
        // Verificar si hay un parámetro de redirección
        const urlParams = new URLSearchParams(window.location.search);
        const redirectPath = urlParams.get('redirect');
        
        if (redirectPath) {
            // Limpiar el parámetro de la URL y redirigir
            const cleanUrl = window.location.origin + window.location.pathname;
            history.replaceState(null, '', cleanUrl);
            window.location.href = cleanUrl + redirectPath;
            return;
        }
        
        // Cargar la propuesta del usuario
        currentProposal = await loadUserProposal();
        if (currentProposal) {
            applyProposalToUI(currentProposal);
        }
        
        // Actualizar la interfaz
        updateAuthUI();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentProposal = null;
        updateAuthUI();
    }
});

/**
 * APLICA UNA PROPUESTA A LA INTERFAZ DE USUARIO
 * @param {Object} proposal - Propuesta a aplicar
 */
function applyProposalToUI(proposal) {
    if (!proposal) return;
    
    // TODO: Implementar la aplicación completa de la propuesta
    // Por ahora solo mostramos un log
    console.log('📋 Aplicando propuesta:', proposal.titulo);
    
    // Actualizar título si existe
    // Actualizar número de divisiones
    // Actualizar nombres de divisiones
    // Actualizar departamentos por división
    // etc.
}

/**
 * ACTUALIZA LA INTERFAZ SEGÚN EL ESTADO DE AUTENTICACIÓN
 */
function updateAuthUI() {
    const accessBtn = document.getElementById('access-draft-btn');
    const userInfo = document.getElementById('user-info');
    const saveBtn = document.getElementById('save-map-btn');
    const publishBtn = document.getElementById('publish-btn');
    const unpublishBtn = document.getElementById('unpublish-btn');
    
    if (currentUser) {
        // Usuario autenticado
        if (accessBtn) accessBtn.style.display = 'none';
        if (userInfo) {
            userInfo.style.display = 'block';
            userInfo.innerHTML = `
                <span class="user-email">${currentUser.email}</span>
                ${currentProposal ? `<span class="user-proposal-title">${currentProposal.titulo}</span>` : ''}
            `;
        }
        if (saveBtn) saveBtn.style.display = 'block';
        if (publishBtn) publishBtn.style.display = 'block';
        if (unpublishBtn) {
            unpublishBtn.style.display = currentProposal && currentProposal.es_publica ? 'block' : 'none';
        }
    } else {
        // Usuario no autenticado
        if (accessBtn) accessBtn.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (publishBtn) publishBtn.style.display = 'none';
        if (unpublishBtn) unpublishBtn.style.display = 'none';
    }
}

// =============================================
// MODALES
// =============================================

/**
 * MUESTRA EL MODAL DE GUARDAR BORRADOR
 */
function showSaveDraftModal() {
    // Si el usuario está autenticado, guardar directamente
    if (currentUser) {
        const proposal = serializeProposal();
        saveProposalToSupabase(proposal, false).then(result => {
            if (result) {
                alert('Borrador guardado exitosamente.');
                currentProposal = result;
                updateAuthUI();
            }
        });
        return;
    }
    
    // Usuario no autenticado: mostrar modal
    if (document.getElementById('save-draft-modal')) {
        document.getElementById('save-draft-modal').style.display = 'flex';
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'save-draft-modal';
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
            max-width: 420px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            position: relative;
        ">
            <button id="save-draft-close" style="
                position: absolute;
                top: 10px; right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
            ">×</button>
            <h3 style="margin-top: 0; color: #333;">Guardar borrador</h3>
            <p style="color: #666; font-size: 13px; margin-bottom: 20px;">
                Solo es posible almacenar una propuesta por usuario. Si ya tenías una, se va a sobrescribir.
            </p>
            
            <label for="draft-title" style="display: block; font-weight: bold; margin-bottom: 5px;">Título borrador</label>
            <input type="text" id="draft-title" placeholder="Ej: Mi propuesta de división" style="
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
                margin-bottom: 5px;
                font-size: 15px;
            " maxlength="40" minlength="3">
            <p style="font-size: 11px; color: #999; margin-bottom: 15px;">
                Mínimo 3 caracteres. Podés editarlo más tarde.
            </p>
            
            <label for="draft-email" style="display: block; font-weight: bold; margin-bottom: 5px;">Correo electrónico</label>
            <input type="email" id="draft-email" placeholder="tu@email.com" style="
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
                margin-bottom: 15px;
                font-size: 15px;
            ">
            
            <button id="draft-send-link" style="
                background: #3388ff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 15px;
                width: 100%;
            ">Enviar enlace de acceso</button>
            
            <div id="draft-error" style="display: none; color: #d32f2f; font-size: 13px; margin-top: 10px;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    const titleInput = document.getElementById('draft-title');
    const emailInput = document.getElementById('draft-email');
    const sendBtn = document.getElementById('draft-send-link');
    const closeBtn = document.getElementById('save-draft-close');
    const errorDiv = document.getElementById('draft-error');

    function showError(msg) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = msg;
        setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }

    sendBtn.addEventListener('click', async function() {
        const titulo = titleInput.value.trim();
        const email = emailInput.value.trim();
        
        if (titulo.length < 3 || titulo.length > 40) {
            showError('El título debe tener entre 3 y 40 caracteres.');
            return;
        }
        if (!email || !email.includes('@')) {
            showError('Ingresá un correo electrónico válido.');
            return;
        }

        // Serializar propuesta y guardar en localStorage
        const proposal = serializeProposal();
        proposal.titulo = titulo;
        saveProposalToLocalStorage(proposal);

        sendBtn.disabled = true;
        sendBtn.textContent = 'Enviando...';
        const success = await sendMagicLink(email, '/propuesta/pendiente');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar enlace de acceso';

        if (success) {
            // Mostrar mensaje de éxito
            modal.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <span style="font-size: 40px;">📧</span>
                    <h3 style="margin: 10px 0;">Revisá tu correo</h3>
                    <p style="color: #666; font-size: 14px;">
                        Te enviamos un enlace a <strong>${email}</strong>.
                        Hacé clic en el enlace para acceder y guardar tu propuesta.
                    </p>
                </div>
            `;
        } else {
            showError('Error al enviar el enlace. Verificá tu correo e intentá nuevamente.');
        }
    });

    function closeModal() {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    titleInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') emailInput.focus();
    });
    emailInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendBtn.click();
    });
}

/**
 * MUESTRA EL MODAL DE PUBLICAR PROPUESTA
 */
function showPublishModal() {
    if (!currentUser) {
        alert('Debés iniciar sesión para publicar tu propuesta.');
        return;
    }

    const proposal = serializeProposal();
    const defaultTitle = currentProposal ? currentProposal.titulo : 'Mi propuesta';

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
                ">📋 Copiar enlace</button>
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

    function showError(msg) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = msg;
        setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }

    confirmBtn.addEventListener('click', async function() {
        const titulo = titleInput.value.trim();
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
            currentProposal = result;
            const shareCode = result.user_share_code;
            const shareUrl = `${window.location.origin}/propuesta/${shareCode}`;
            
            shareUrlDiv.textContent = shareUrl;
            resultDiv.style.display = 'block';
            confirmBtn.style.display = 'none';
            
            updateAuthUI();
        } else {
            showError('Error al publicar la propuesta. Intentá nuevamente.');
        }
    });

    copyBtn.addEventListener('click', function() {
        const url = shareUrlDiv.textContent;
        navigator.clipboard.writeText(url).then(() => {
            copyBtn.textContent = '✅ ¡Enlace copiado!';
            setTimeout(() => { copyBtn.textContent = '📋 Copiar enlace'; }, 2000);
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
 * MUESTRA EL MODAL DE ACCEDER A PROPUESTA BORRADOR
 * (Para usuarios no autenticados que ya tienen un borrador)
 */
function showAccessDraftModal() {
    if (document.getElementById('access-draft-modal')) {
        document.getElementById('access-draft-modal').style.display = 'flex';
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'access-draft-modal';
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
            max-width: 400px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            position: relative;
        ">
            <button id="access-close" style="
                position: absolute;
                top: 10px; right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
            ">×</button>
            <h3 style="margin-top: 0; color: #333;">Acceder a mi propuesta borrador</h3>
            <p style="color: #666; font-size: 13px; margin-bottom: 20px;">
                Ingresá tu correo electrónico para recibir un enlace de acceso.
            </p>
            
            <label for="access-email" style="display: block; font-weight: bold; margin-bottom: 5px;">Correo electrónico</label>
            <input type="email" id="access-email" placeholder="tu@email.com" style="
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
                margin-bottom: 15px;
                font-size: 15px;
            ">
            
            <button id="access-send-link" style="
                background: #3388ff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 15px;
                width: 100%;
            ">Enviar enlace de acceso</button>
            
            <div id="access-error" style="display: none; color: #d32f2f; font-size: 13px; margin-top: 10px;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    const emailInput = document.getElementById('access-email');
    const sendBtn = document.getElementById('access-send-link');
    const closeBtn = document.getElementById('access-close');
    const errorDiv = document.getElementById('access-error');

    function showError(msg) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = msg;
        setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }

    sendBtn.addEventListener('click', async function() {
        const email = emailInput.value.trim();
        if (!email || !email.includes('@')) {
            showError('Ingresá un correo electrónico válido.');
            return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = 'Enviando...';
        const success = await sendMagicLink(email, '');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar enlace de acceso';

        if (success) {
            modal.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <span style="font-size: 40px;">📧</span>
                    <h3 style="margin: 10px 0;">Revisá tu correo</h3>
                    <p style="color: #666; font-size: 14px;">
                        Te enviamos un enlace a <strong>${email}</strong>.
                        Hacé clic en el enlace para acceder a tu propuesta.
                    </p>
                </div>
            `;
        } else {
            showError('Error al enviar el enlace. Verificá tu correo e intentá nuevamente.');
        }
    });

    function closeModal() {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    emailInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendBtn.click();
    });
}

/**
 * MUESTRA EL MODAL DE OCULTAR PROPUESTA PÚBLICA
 */
function showUnpublishModal() {
    if (!currentUser || !currentProposal) return;
    
    if (confirm('¿Estás seguro de que querés ocultar tu propuesta pública? Dejará de ser accesible para otros usuarios.')) {
        saveProposalToSupabase(currentProposal, false).then(result => {
            if (result) {
                currentProposal = result;
                alert('Propuesta ocultada exitosamente.');
                updateAuthUI();
            }
        });
    }
}

// =============================================
// EXPOSICIÓN PÚBLICA
// =============================================

window.showSaveDraftModal = showSaveDraftModal;
window.showPublishModal = showPublishModal;
window.showAccessDraftModal = showAccessDraftModal;
window.showUnpublishModal = showUnpublishModal;
window.updateAuthUI = updateAuthUI;
window.supabaseClient = supabaseClient;
window.currentUser = () => currentUser;
window.currentProposal = () => currentProposal;

console.log('✅ Módulo de autenticación y propuestas cargado');
