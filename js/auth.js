/*
 * MÓDULO DE AUTENTICACIÓN POR MAGIC LINK
 * 
 * Responsabilidades:
 * - Envío de magic links con redirección a propuesta específica
 * - Creación y actualización del perfil del usuario
 * - Detección del estado de autenticación (login/logout)
 * - Aplicación de una propuesta guardada a la interfaz
 * - Modales de autenticación: guardar borrador y cargar propuesta
 * - Plantilla HTML de referencia del email de magic link
 *
 * DEPENDENCIAS:
 * - supabase-client.js (cliente Supabase global)
 * - proposals.js (serialización, guardado y carga de propuestas)
 *
 * ORDEN DE CARGA: después de supabase-client.js y antes de proposals.js.
 */

// =============================================
// ESTADO DEL MÓDULO
// =============================================

let currentUser = null;
let currentProposal = null;
let currentEmail = '';

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
        const baseUrl = window.location.origin + window.location.pathname;
        const redirectUrl = redirectPath 
            ? `${baseUrl}?redirect=${encodeURIComponent(redirectPath)}`
            : baseUrl;
        
        const { data, error } = await supabaseClient.auth.signInWithOtp({
            email: email,
            options: { emailRedirectTo: redirectUrl }
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

// =============================================
// DETECCIÓN DE SESIÓN Y REDIRECCIÓN
// =============================================

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('🔐 Auth state change:', event);
    
    if (event === 'SIGNED_IN' && session && session.user) {
        currentUser = session.user;
        await createOrUpdateProfile(session.user);
        
        // Recuperar propuesta pendiente en localStorage (definida en proposals.js)
        const pendingProposal = loadProposalFromLocalStorage();
        if (pendingProposal) {
            await saveProposalToSupabase(pendingProposal, false);
            clearProposalFromLocalStorage();
            console.log('✅ Propuesta pendiente guardada en Supabase');
        }
        
        // Cargar la propuesta del usuario
        currentProposal = await loadUserProposal();
        if (currentProposal) {
            applyProposalToUI(currentProposal);
        }
        
        updateAuthUI();

        // Redirección post-login (por si venía un ?redirect=...)
        const urlParams = new URLSearchParams(window.location.search);
        const redirectPath = urlParams.get('redirect');
        if (redirectPath) {
            const cleanUrl = window.location.origin + window.location.pathname;
            history.replaceState(null, '', cleanUrl);
            setTimeout(() => {
                window.location.href = cleanUrl + redirectPath;
            }, 500);
            return;
        }
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentProposal = null;
        updateAuthUI();
    }
});

// =============================================
// APLICACIÓN DE PROPUESTA A LA INTERFAZ
// =============================================

/**
 * APLICA UNA PROPUESTA GUARDADA A LA INTERFAZ DE USUARIO
 * Toma los datos de la propuesta y actualiza el estado global y la UI.
 * @param {Object} proposal - Objeto de la propuesta desde Supabase.
 */
function applyProposalToUI(proposal) {
    if (!proposal) return;

    // Si los datos base aún no están cargados, encolar la propuesta
    if (!allDepartments || allDepartments.length === 0) {
        console.log('⏳ Datos aún no cargados. Encolando propuesta para aplicar después.');
        window.__pendingProposal = proposal;
        return;
    }

    console.log('📋 Aplicando propuesta:', proposal.titulo);

    // 1. Actualizar el título de la propuesta en la UI
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        const titleSpan = userInfo.querySelector('.user-proposal-title');
        if (titleSpan) titleSpan.textContent = proposal.titulo;
    }

    // 2. Actualizar el estado global
    currentDivisionCount = proposal.cantidad_divisiones || 3;
    comunasIncluidas = proposal.incluye_comunas_caba || false;
    
    // 3. Reconstruir las cajas de división
    initializeDivisionBoxes(currentDivisionCount);

    // 4. Asignar nombres a cada división
    if (proposal.nombres_divisiones && Array.isArray(proposal.nombres_divisiones)) {
        proposal.nombres_divisiones.forEach((nombre, index) => {
            const groupId = index + 1;
            if (departmentGroups[groupId]) {
                departmentGroups[groupId].name = nombre;
                const editableName = document.querySelector(`[data-group-id="${groupId}"] .editable-division-name`);
                if (editableName) editableName.textContent = nombre;
            }
        });
    }

    // 5. Asignar departamentos a sus divisiones
    if (proposal.departamentos_por_division) {
        Object.keys(proposal.departamentos_por_division).forEach(groupId => {
            const deptNames = proposal.departamentos_por_division[groupId];
            if (departmentGroups[groupId] && Array.isArray(deptNames)) {
                const divisionList = document.getElementById(`division-${groupId}`);
                if (divisionList) {
                    divisionList.innerHTML = '';
                    deptNames.forEach(deptName => {
                        const dept = allDepartments.find(d => d.properties.nam === deptName);
                        if (dept) {
                            const isGBA = gbaCodes.includes(dept.properties.cde);
                            const item = document.createElement('div');
                            item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
                            item.textContent = deptName;
                            item.setAttribute('data-dept-name', deptName);
                            item.setAttribute('data-dept-code', dept.properties.cde);
                            divisionList.appendChild(item);
                        }
                    });
                    sortDivisionList(groupId);
                }
            }
        });
    }

    // 6. Reconstruir el listado principal
    const listContainer = document.getElementById('all-departments-list');
    if (listContainer) {
        listContainer.innerHTML = '';
        const assignedDepts = new Set();
        Object.values(proposal.departamentos_por_division || {}).forEach(depts => {
            depts.forEach(name => assignedDepts.add(name));
        });

        allDepartments.forEach(feature => {
            const name = feature.properties.nam;
            if (!assignedDepts.has(name)) {
                const isGBA = gbaCodes.includes(feature.properties.cde);
                const item = document.createElement('div');
                item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
                item.textContent = name;
                item.setAttribute('data-dept-name', name);
                item.setAttribute('data-dept-code', feature.properties.cde);
                listContainer.appendChild(item);
            }
        });
        sortMainList();
    }

    // 7. Sincronizar controles
    const divisionInput = document.getElementById('division-count');
    if (divisionInput) divisionInput.value = currentDivisionCount;

    const comunasCheckbox = document.getElementById('toggle-comunas');
    if (comunasCheckbox) comunasCheckbox.checked = comunasIncluidas;
    
    // 8. Notificar a todos los módulos
    notifyStateChange();
    updateDivisionsTitle();
    
    console.log('✅ Propuesta aplicada a la interfaz.');
}

/**
 * ACTUALIZA LA INTERFAZ SEGÚN EL ESTADO DE AUTENTICACIÓN
 * Delega el renderizado al dropdown de la esquina superior derecha.
 */
function updateAuthUI() {
    if (typeof renderDropdownContent === 'function') {
        renderDropdownContent(currentUser, currentProposal);
    }
}

// =============================================
// PLANTILLA DEL EMAIL DE MAGIC LINK
// =============================================

/**
 * DEVUELVE EL HTML DE LA PANTALLA "TE ENVIAMOS UN CORREO"
 * Recrea visualmente el email de Supabase para dar instrucciones claras.
 * @param {string} email - Correo del usuario
 * @param {string} accion - Frase que describe la acción ("acceder a tu propuesta", etc.)
 * @returns {string} - HTML de la pantalla (sin contenedor propio: el modal
 *                     que lo invoque debe envolverlo en un fondo blanco).
 */
function getMagicLinkSentHTML(email, accion) {
    return `
        <div style="max-width: 560px; margin: 0 auto;">
            <p style="color: #333; font-size: 14px; line-height: 1.6; margin-bottom: 18px;">
                Te enviamos un correo a <strong>${email}</strong> desde la casilla 
                <strong>noreply@mail.app.supabase.io</strong>. Para ${accion}, 
                hacé click en el texto "Sign In" del correo y te redirigirá a nuestro sitio.
            </p>
            
            <div style="
                border: 1px solid #ddd;
                border-radius: 6px;
                overflow: hidden;
                background: #fff;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            ">
                <div style="padding: 26px 30px; font-family: Helvetica, Arial, sans-serif; color: #333;">
                    <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: bold; color: #000;">Your sign-in link</h2>
                    <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.5; color: #333;">
                        Follow the link below to sign in. This link expires shortly and can only be used once.
                    </p>
                    <div style="display: inline-block; border: 2px solid #d63384; border-radius: 4px; padding: 6px 14px; background: #fff;">
                        <span style="font-size: 15px; color: #d63384; font-weight: 600;">Sign in</span>
                    </div>
                    <p style="margin: 40px 0 6px 0; text-align: center; font-size: 13px; color: #666;">
                        You're receiving this email because you signed up for an application powered by 
                        <span style="color: #3ecf8e; font-weight: 600;">Supabase</span>
                        <span style="color: #f7b500;">⚡</span>
                    </p>
                    <p style="margin: 0; text-align: center; font-size: 12px; color: #888;">
                        Opt out of these emails
                    </p>
                </div>
            </div>
            
            <p style="color: #666; font-size: 12px; line-height: 1.6; margin-top: 18px;">
                <strong>Importante:</strong> aunque hagas click en "Sign In", no vas a poder autenticarte correctamente en los siguientes casos:
            </p>
            <ul style="color: #666; font-size: 12px; line-height: 1.6; margin: 6px 0 0 18px; padding: 0;">
                <li>Si el enlace <strong>ya fue usado anteriormente</strong> (los enlaces son de un solo uso).</li>
                <li>Si <strong>expiró</strong> (los enlaces tienen una validez limitada de tiempo).</li>
                <li>Si abriste el correo en un <strong>navegador distinto</strong> al que estás usando ahora para volver al sitio.</li>
                <li>Si el correo que ingresaste <strong>no coincide</strong> con el de la casilla desde la que abriste el enlace.</li>
                <li>Si tu proveedor de correo <strong>bloqueó o modificó</strong> el enlace (algunos filtros de spam lo hacen).</li>
            </ul>
            <p style="color: #666; font-size: 12px; line-height: 1.6; margin-top: 10px;">
                Si tenés problemas, cerrá esta ventana y volvé a solicitar un nuevo enlace.
            </p>
        </div>
    `;
}

// =============================================
// HELPERS DE MODAL (contenedor blanco común)
// =============================================

/**
 * DEVUELVE EL HTML DEL CONTENEDOR BLANCO PARA MODALES DE AUTH
 * Centraliza el estilo para evitar repeticiones y garantizar contraste.
 * @param {string} contenidoHTML - HTML interno del modal
 * @param {string} idBotonCerrar - ID del botón de cerrar
 * @returns {string} - HTML del contenedor blanco completo
 */
function wrapAuthModalContent(contenidoHTML, idBotonCerrar) {
    return `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 8px;
            max-width: 560px;
            width: 90%;
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            position: relative;
            font-family: Arial, sans-serif;
        ">
            <button id="${idBotonCerrar}" style="
                position: absolute;
                top: 10px; right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
            ">×</button>
            ${contenidoHTML}
        </div>
    `;
}

// =============================================
// MODALES DE AUTENTICACIÓN
// =============================================

/**
 * MUESTRA EL MODAL DE GUARDAR BORRADOR
 * - Si el usuario está autenticado: guarda el borrador directamente.
 * - Si no: pide título y email, guarda en localStorage y envía magic link.
 */
function showSaveDraftModal() {
    // Si ya está autenticado, guardar directamente
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
    
    // Modal ya abierto: solo mostrarlo
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

    function renderForm() {
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
        attachFormHandlers();
    }

    function renderSent(email) {
        const contenido = getMagicLinkSentHTML(email, 'acceder y guardar tu propuesta');
        modal.innerHTML = wrapAuthModalContent(contenido, 'save-draft-close-sent');
        document.getElementById('save-draft-close-sent').addEventListener('click', closeModal);
    }

    function attachFormHandlers() {
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

            const proposal = serializeProposal();
            proposal.titulo = titulo;
            saveProposalToLocalStorage(proposal);

            sendBtn.disabled = true;
            sendBtn.textContent = 'Enviando...';
            const success = await sendMagicLink(email, '/propuesta/pendiente');
            sendBtn.disabled = false;
            sendBtn.textContent = 'Enviar enlace de acceso';

            if (success) {
                renderSent(email);
            } else {
                showError('Error al enviar el enlace. Verificá tu correo e intentá nuevamente.');
            }
        });

        closeBtn.addEventListener('click', closeModal);
        titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') emailInput.focus(); });
        emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendBtn.click(); });
    }

    function closeModal() {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    }

    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    document.body.appendChild(modal);
    renderForm();
}

/**
 * MUESTRA EL MODAL DE CARGAR PROPUESTA
 * Pide email y envía magic link para acceder a la propuesta del usuario.
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

    function renderForm() {
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
                <h3 style="margin-top: 0; color: #333;">Cargar mi propuesta</h3>
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
        attachFormHandlers();
    }

    function renderSent(email) {
        const contenido = getMagicLinkSentHTML(email, 'acceder a tu propuesta');
        modal.innerHTML = wrapAuthModalContent(contenido, 'access-close-sent');
        document.getElementById('access-close-sent').addEventListener('click', closeModal);
    }

    function attachFormHandlers() {
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
                renderSent(email);
            } else {
                showError('Error al enviar el enlace. Verificá tu correo e intentá nuevamente.');
            }
        });

        closeBtn.addEventListener('click', closeModal);
        emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendBtn.click(); });
    }

    function closeModal() {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    }

    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    document.body.appendChild(modal);
    renderForm();
}

// =============================================
// EXPOSICIÓN PÚBLICA
// =============================================

window.showSaveDraftModal = showSaveDraftModal;
window.showAccessDraftModal = showAccessDraftModal;
window.updateAuthUI = updateAuthUI;
window.currentUser = () => currentUser;
window.currentProposal = () => currentProposal;
window.setCurrentProposal = (p) => { currentProposal = p; };

document.addEventListener('DOMContentLoaded', function() {
    if (typeof updateAuthUI === 'function') {
        setTimeout(() => updateAuthUI(), 100);
    }
});
