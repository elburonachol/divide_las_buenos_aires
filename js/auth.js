/*
 * MÓDULO DE AUTENTICACIÓN POR MAGIC LINK (EMAIL)
 * 
 * Responsabilidades:
 * - Manejo del flujo de autenticación con enlace mágico por email
 * - Envío del enlace al email del usuario
 * - Detección de sesión al regresar desde el enlace
 * - Creación/actualización del perfil del usuario en la tabla profiles
 * - Gestión del modal de ingreso de email y confirmación
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

let currentEmail = '';

// =============================================
// FUNCIONES DE AUTENTICACIÓN
// =============================================

/**
 * ENVÍA UN ENLACE MÁGICO AL EMAIL DEL USUARIO
 * @param {string} email - Correo electrónico del usuario
 * @returns {Promise<boolean>} - True si se envió correctamente
 */
async function sendMagicLink(email) {
    try {
        const redirectUrl = window.location.origin + window.location.pathname;
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
 * CREA O ACTUALIZA EL PERFIL DEL USUARIO EN LA TABLA profiles
 * @param {Object} user - Objeto usuario de Supabase
 */
async function createOrUpdateProfile(user) {
    if (!user) return;

    const profileData = {
        id: user.id,
        email: user.email,
        updated_at: new Date().toISOString()
    };

    const { data: existingProfile, error: fetchError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Error al verificar perfil:', fetchError);
        return;
    }

    if (existingProfile) {
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ updated_at: profileData.updated_at })
            .eq('id', user.id);

        if (updateError) {
            console.error('❌ Error al actualizar perfil:', updateError);
        } else {
            console.log('✅ Perfil actualizado para:', user.email);
        }
    } else {
        const { error: insertError } = await supabaseClient
            .from('profiles')
            .insert([{
                id: user.id,
                email: user.email,
                created_at: new Date().toISOString(),
                updated_at: profileData.updated_at,
                mapas_guardados: 0
            }]);

        if (insertError) {
            console.error('❌ Error al crear perfil:', insertError);
        } else {
            console.log('✅ Perfil creado para nuevo usuario:', user.email);
        }
    }
}

// =============================================
// DETECCIÓN DE SESIÓN AL REGRESAR DEL MAGIC LINK
// =============================================

/**
 * ESCUCHA CAMBIOS EN EL ESTADO DE AUTENTICACIÓN
 * Cuando el usuario regresa desde el enlace mágico, se detecta la sesión
 * y se muestra el mensaje de éxito con la URL para compartir
 */
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('🔐 Auth state change:', event);
    
    if (event === 'SIGNED_IN' && session && session.user) {
        // El usuario acaba de iniciar sesión (vía magic link)
        await createOrUpdateProfile(session.user);
        
        // Generar URL para compartir la propuesta (placeholder)
        const shareUrl = generateShareUrl();
        
        // Mostrar modal de éxito
        showSuccessModal(session.user.email, shareUrl);
        
        // Limpiar el hash de la URL para evitar reprocesamiento
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }
});

/**
 * GENERA UNA URL PARA COMPARTIR LA PROPUESTA
 * TODO: Implementar la lógica real de guardado y generación de URL
 * @returns {string} - URL para compartir
 */
function generateShareUrl() {
    // Placeholder - en el futuro se generará un ID único y se guardará en la BD
    return window.location.origin + window.location.pathname;
}

// =============================================
// GESTIÓN DEL MODAL DE AUTENTICACIÓN
// =============================================

/**
 * MUESTRA EL MODAL PARA INGRESAR EL EMAIL
 */
function showAuthModal() {
    if (document.getElementById('auth-modal')) {
        document.getElementById('auth-modal').style.display = 'flex';
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
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
            <button id="auth-modal-close" style="
                position: absolute;
                top: 10px; right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
            ">×</button>
            <h3 style="margin-top: 0; color: #333;">Guardar y compartir propuesta</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                Ingresa tu correo electrónico y te enviaremos un enlace para acceder y guardar tu propuesta.
            </p>
            
            <div id="auth-step-email">
                <label for="auth-email" style="display: block; font-weight: bold; margin-bottom: 5px;">Correo electrónico</label>
                <input type="email" id="auth-email" placeholder="tu@email.com" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-sizing: border-box;
                    margin-bottom: 15px;
                    font-size: 16px;
                ">
                <button id="auth-send-link" style="
                    background: #3388ff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    width: 100%;
                ">Enviar enlace de acceso</button>
            </div>

            <div id="auth-step-sent" style="display: none; text-align: center;">
                <span style="font-size: 40px;">📧</span>
                <h4 style="margin: 10px 0 5px;">Revisa tu correo</h4>
                <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                    Te enviamos un enlace a <strong id="auth-sent-email"></strong>.
                    Hacé clic en el enlace para acceder y guardar tu propuesta.
                </p>
                <p style="font-size: 12px; color: #999;">
                    ¿No lo recibiste? Revisá tu carpeta de spam.
                </p>
            </div>

            <div id="auth-error" style="display: none; color: #d32f2f; font-size: 14px; margin-top: 10px;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    const emailInput = document.getElementById('auth-email');
    const sendBtn = document.getElementById('auth-send-link');
    const closeBtn = document.getElementById('auth-modal-close');
    const stepEmail = document.getElementById('auth-step-email');
    const stepSent = document.getElementById('auth-step-sent');
    const sentEmailSpan = document.getElementById('auth-sent-email');
    const errorDiv = document.getElementById('auth-error');

    function showError(msg) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = msg;
        setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }

    sendBtn.addEventListener('click', async function() {
        const email = emailInput.value.trim();
        if (!email || !email.includes('@')) {
            showError('Por favor, ingresa un correo electrónico válido.');
            return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = 'Enviando...';
        const success = await sendMagicLink(email);
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar enlace de acceso';

        if (success) {
            sentEmailSpan.textContent = email;
            stepEmail.style.display = 'none';
            stepSent.style.display = 'block';
        } else {
            showError('Error al enviar el enlace. Verifica tu correo e intenta nuevamente.');
        }
    });

    function closeModal() {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
        currentEmail = '';
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
 * MUESTRA EL MODAL DE ÉXITO DESPUÉS DE AUTENTICARSE
 * @param {string} email - Email del usuario autenticado
 * @param {string} shareUrl - URL para compartir la propuesta
 */
function showSuccessModal(email, shareUrl) {
    const existingModal = document.getElementById('auth-modal');
    if (existingModal && existingModal.parentNode) {
        existingModal.parentNode.removeChild(existingModal);
    }
    
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
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
            text-align: center;
        ">
            <button id="auth-modal-close" style="
                position: absolute;
                top: 10px; right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
            ">×</button>
            <span style="font-size: 50px;">✅</span>
            <h3 style="margin: 10px 0 5px; color: #333;">¡Propuesta guardada!</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                Tu propuesta ha sido guardada exitosamente.
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                Compartí este enlace:
            </p>
            <div style="
                background: #f5f5f5;
                padding: 10px;
                border-radius: 4px;
                margin-bottom: 15px;
                word-break: break-all;
                font-size: 13px;
                color: #333;
            " id="auth-share-url">${shareUrl}</div>
            <button id="auth-copy-url" style="
                background: #3388ff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-right: 8px;
            ">Copiar enlace</button>
            <button id="auth-success-close" style="
                background: #999;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">Cerrar</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = document.getElementById('auth-modal-close');
    const successCloseBtn = document.getElementById('auth-success-close');
    const copyBtn = document.getElementById('auth-copy-url');
    
    function closeModal() {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    }
    
    closeBtn.addEventListener('click', closeModal);
    successCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });
    
    copyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(shareUrl).then(() => {
            copyBtn.textContent = '¡Copiado!';
            setTimeout(() => { copyBtn.textContent = 'Copiar enlace'; }, 2000);
        }).catch(err => {
            console.error('Error al copiar:', err);
        });
    });
}

// =============================================
// EXPOSICIÓN PÚBLICA PARA OTROS MÓDULOS
// =============================================

window.showAuthModal = showAuthModal;
window.supabaseClient = supabaseClient;

console.log('✅ Módulo de autenticación por magic link cargado');
