/*
 * MÓDULO DE FORMULARIO DE CONTACTO
 * 
 * Responsabilidades:
 * - Formulario en dos etapas: validar email (magic link) → completar mensaje
 * - Autenticación obligatoria antes de enviar mensajes
 * - Prellenado de datos desde el perfil del usuario autenticado
 * - Actualización del nombre en profiles y envío a contact_messages
 *
 * DEPENDENCIAS:
 * - supabase-client.js, auth.js (currentUser, sendMagicLink)
 */

// =============================================
// ESTADO DEL MÓDULO
// =============================================

let contactFormInitialized = false;

// =============================================
// INICIALIZACIÓN
// =============================================

function initializeContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    
    const messageField = document.getElementById('contact-message');
    const counter = document.getElementById('contact-counter');
    const errorDiv = document.getElementById('contact-error');
    const successDiv = document.getElementById('contact-success');
    
    // Contador de caracteres
    if (messageField && counter) {
        messageField.addEventListener('input', function() {
            counter.textContent = this.value.length;
        });
    }
    
    // El form se delega por submit
    form.addEventListener('submit', handleContactSubmit);
    
    // Re-render según estado de autenticación
    renderContactForm();
    
    // Exponer para que auth.js pueda llamar después de un login
    window.renderContactForm = renderContactForm;
    
    contactFormInitialized = true;
}

// =============================================
// RENDERIZADO DEL FORMULARIO (SEGÚN AUTH)
// =============================================

/**
 * RENDERIZA EL FORMULARIO DE CONTACTO EN DOS ESTADOS:
 * - No autenticado: solo email + botón "Validar mail"
 * - Autenticado: email readonly + nombre + asunto + mensaje + "Enviar mensaje"
 */
function renderContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    
    const user = (typeof window.currentUser === 'function') ? window.currentUser() : null;
    
    if (user) {
        // Estado B: usuario autenticado
        form.innerHTML = `
            <div class="contact-field">
                <label for="contact-email">Correo electrónico (validado)</label>
                <input type="email" id="contact-email" value="${user.email}" readonly
                       class="contact-input-readonly">
                <small class="contact-hint">Tu correo está validado y no puede modificarse.</small>
            </div>
            
            <div class="contact-field">
                <label for="contact-name">Nombre <span class="required">*</span></label>
                <input type="text" id="contact-name" name="name" required maxlength="25"
                       placeholder="Ej: Ignacio B." autocomplete="name">
                <small class="contact-hint">Máximo 25 caracteres. Se guarda en tu perfil.</small>
            </div>
            
            <div class="contact-field">
                <label for="contact-subject">Asunto <span class="required">*</span></label>
                <input type="text" id="contact-subject" name="subject" required maxlength="150">
            </div>
            
            <div class="contact-field">
                <label for="contact-message">Mensaje <span class="required">*</span></label>
                <textarea id="contact-message" name="message" rows="6" required maxlength="2000"></textarea>
                <small class="contact-counter"><span id="contact-counter">0</span> / 2000 caracteres</small>
            </div>
            
            <div id="contact-error" class="contact-error" style="display:none;"></div>
            <div id="contact-success" class="contact-success" style="display:none;">
                ¡Gracias por tu mensaje! Lo vamos a revisar y te responderemos a la brevedad.
            </div>
            
            <button type="submit" id="contact-submit" class="contact-submit">Enviar mensaje</button>
        `;
        attachAuthFormHandlers();
        prefillFromProfile();
    } else {
        // Estado A: no autenticado
        form.innerHTML = `
            <div class="contact-field">
                <label for="contact-email">Correo electrónico <span class="required">*</span></label>
                <input type="email" id="contact-email" name="email" required maxlength="120"
                       placeholder="tu@email.com" autocomplete="email">
                <small class="contact-hint">
                    Es necesario validar tu mail para poder enviar un mensaje de contacto.
                </small>
            </div>
            
            <div id="contact-error" class="contact-error" style="display:none;"></div>
            
            <button type="submit" id="contact-submit" class="contact-submit">Validar mail</button>
        `;
        attachUnauthFormHandlers();
    }
}

/**
 * PREFILLEA EL CAMPO DE NOMBRE DESDE EL PERFIL DEL USUARIO
 */
async function prefillFromProfile() {
    const user = (typeof window.currentUser === 'function') ? window.currentUser() : null;
    if (!user) return;
    const nameInput = document.getElementById('contact-name');
    if (!nameInput) return;
    
    const { data, error } = await window.supabaseClient
        .from('profiles')
        .select('nombre')
        .eq('id', user.id)
        .maybeSingle();
    
    if (!error && data && data.nombre) {
        nameInput.value = data.nombre;
    }
}

// =============================================
// HANDLERS
// =============================================

/**
 * HANDLER DEL FORMULARIO EN ESTADO NO AUTENTICADO
 * Pide email y dispara el modal de magic link.
 */
function attachUnauthFormHandlers() {
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('contact-email').value.trim();
        if (!email || !email.includes('@')) {
            showContactError('Ingresá un correo electrónico válido.');
            return;
        }
        // Abrimos el modal con el email ya precargado
        openContactMagicLinkModal(email);
    });
}

/**
 * HANDLER DEL FORMULARIO EN ESTADO AUTENTICADO
 * Valida y envía el mensaje.
 */
function attachAuthFormHandlers() {
    // El submit ya fue capturado en initializeContactForm
    const messageField = document.getElementById('contact-message');
    const counter = document.getElementById('contact-counter');
    if (messageField && counter) {
        messageField.addEventListener('input', function() {
            counter.textContent = this.value.length;
        });
    }
}

function showContactError(msg) {
    const errorDiv = document.getElementById('contact-error');
    const successDiv = document.getElementById('contact-success');
    if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
    if (successDiv) successDiv.style.display = 'none';
}

function hideContactMessages() {
    const errorDiv = document.getElementById('contact-error');
    const successDiv = document.getElementById('contact-success');
    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
}

/**
 * HANDLER PRINCIPAL DEL FORMULARIO
 * Se dispara en ambos estados; delega según autenticación.
 */
async function handleContactSubmit(e) {
    e.preventDefault();
    
    const user = (typeof window.currentUser === 'function') ? window.currentUser() : null;
    
    if (!user) {
        // Estado A → manejar como validación de email
        const email = document.getElementById('contact-email').value.trim();
        if (!email || !email.includes('@')) {
            showContactError('Ingresá un correo electrónico válido.');
            return;
        }
        openContactMagicLinkModal(email);
        return;
    }
    
    // Estado B → enviar mensaje
    hideContactMessages();
    
    const nombre = document.getElementById('contact-name').value.trim();
    const asunto = document.getElementById('contact-subject').value.trim();
    const mensaje = document.getElementById('contact-message').value.trim();
    const submitBtn = document.getElementById('contact-submit');
    
    if (nombre.length < 2) return showContactError('Ingresá tu nombre (mínimo 2 caracteres).');
    if (nombre.length > 25) return showContactError('El nombre no puede superar los 25 caracteres.');
    if (asunto.length < 3) return showContactError('El asunto debe tener al menos 3 caracteres.');
    if (mensaje.length < 10) return showContactError('El mensaje debe tener al menos 10 caracteres.');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    
    try {
        // 1) Actualizar nombre en profiles
        const { error: profileError } = await window.supabaseClient
            .from('profiles')
            .update({ nombre: nombre, updated_at: new Date().toISOString() })
            .eq('id', user.id);
        
        if (profileError) throw profileError;
        
        // 2) Insertar mensaje
        const { error: msgError } = await window.supabaseClient
            .from('contact_messages')
            .insert([{
                user_id: user.id,
                asunto: asunto,
                mensaje: mensaje,
                created_at: new Date().toISOString()
            }]);
        
        if (msgError) throw msgError;
        
        console.log('✅ Mensaje de contacto enviado');
        
        // Limpiar solo los campos editables
        document.getElementById('contact-subject').value = '';
        document.getElementById('contact-message').value = '';
        const counter = document.getElementById('contact-counter');
        if (counter) counter.textContent = '0';
        
        const successDiv = document.getElementById('contact-success');
        if (successDiv) successDiv.style.display = 'block';
        
    } catch (err) {
        console.error('❌ Error al enviar mensaje:', err);
        showContactError('Hubo un error al enviar tu mensaje. Por favor intentá nuevamente en unos minutos.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar mensaje';
    }
}

// =============================================
// MODAL DE MAGIC LINK PARA CONTACTO
// =============================================

/**
 * ABRE UN MODAL QUE EXPLICA EL MAGIC LINK Y PIDE EL EMAIL
 * @param {string} email - Email precargado del formulario
 */
function openContactMagicLinkModal(email) {
    if (document.getElementById('contact-magic-modal')) {
        document.getElementById('contact-magic-modal').style.display = 'flex';
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'contact-magic-modal';
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
                <button id="contact-magic-close" style="
                    position: absolute; top: 10px; right: 15px;
                    background: none; border: none;
                    font-size: 24px; cursor: pointer; color: #999;
                ">×</button>
                <h3 style="margin-top: 0; color: #333;">Validar mi correo</h3>
                <p style="color: #666; font-size: 13px; margin-bottom: 20px;">
                    Para enviar un mensaje de contacto, primero tenés que validar tu correo electrónico.
                    Te vamos a enviar un <strong>enlace mágico</strong>: al hacer clic en él, vas a volver
                    automáticamente a esta página con la sesión iniciada.
                </p>
                
                <label for="contact-magic-email" style="display: block; font-weight: bold; margin-bottom: 5px;">
                    Correo electrónico
                </label>
                <input type="email" id="contact-magic-email" value="${email}" style="
                    width: 100%; padding: 10px;
                    border: 1px solid #ddd; border-radius: 4px;
                    box-sizing: border-box; margin-bottom: 15px; font-size: 15px;
                ">
                
                <button id="contact-magic-send" style="
                    background: #3388ff; color: white; border: none;
                    padding: 10px 20px; border-radius: 4px; cursor: pointer;
                    font-size: 15px; width: 100%;
                ">Enviar enlace de acceso</button>
                
                <div id="contact-magic-error" style="display: none; color: #d32f2f; font-size: 13px; margin-top: 10px;"></div>
            </div>
        `;
        attachFormHandlers();
    }
    
        function renderSent(sentEmail) {
        // Reutilizamos el template estándar del magic link de auth.js
        // (idéntico al que aparece en "Cargar mi propuesta"), cambiando
        // el texto de la acción a "verificar tu correo electrónico".
        const contenido = getMagicLinkSentHTML(
            sentEmail,
            'verificar tu correo electrónico y poder enviar un mensaje de contacto'
        );
        modal.innerHTML = wrapAuthModalContent(contenido, 'contact-magic-close');
        document.getElementById('contact-magic-close').addEventListener('click', closeModal);
    }
    
    function attachFormHandlers() {
        const emailInput = document.getElementById('contact-magic-email');
        const sendBtn = document.getElementById('contact-magic-send');
        const closeBtn = document.getElementById('contact-magic-close');
        const errorDiv = document.getElementById('contact-magic-error');
        
        function showError(msg) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = msg;
            setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
        }
        
        sendBtn.addEventListener('click', async function() {
            const mail = emailInput.value.trim();
            if (!mail || !mail.includes('@')) {
                showError('Ingresá un correo electrónico válido.');
                return;
            }
            
            sendBtn.disabled = true;
            sendBtn.textContent = 'Enviando...';
            
            // sendMagicLink con redirect a la pestaña de contacto
            const success = await sendMagicLink(mail, '/?tab=contacto');
            
            sendBtn.disabled = false;
            sendBtn.textContent = 'Enviar enlace de acceso';
            
            if (success) {
                renderSent(mail);
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
// ARRANQUE
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeContactForm();
    console.log('✅ Formulario de contacto inicializado');
});
