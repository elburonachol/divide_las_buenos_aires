/*
 * MÓDULO DE AUTENTICACIÓN POR CÓDIGO OTP (EMAIL)
 * 
 * Responsabilidades:
 * - Manejo del flujo de autenticación con código de un solo uso
 * - Envío de código al email del usuario
 * - Verificación del código y creación de sesión
 * - Gestión del modal de ingreso de email y código
 * - Creación/actualización del perfil del usuario en la tabla profiles
 */

// =============================================
// CONFIGURACIÓN DEL CLIENTE SUPABASE
// =============================================

// Asegurarse de que la configuración esté disponible
if (typeof SUPABASE_CONFIG === 'undefined') {
    console.error('❌ SUPABASE_CONFIG no definido. Verificar build.js');
}

// Crear instancia de Supabase (usando CDN o importación)
// Asumimos que ya cargaste la librería de Supabase desde CDN
// Si no, agregar en index.html: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

const supabaseUrl = window.SUPABASE_CONFIG.url;
const supabaseAnonKey = window.SUPABASE_CONFIG.anonKey;
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// =============================================
// ESTADO DEL MÓDULO
// =============================================

let currentEmail = ''; // Guarda el email mientras se espera el código
let isWaitingForCode = false; // Indica si ya se envió el código

// =============================================
// FUNCIONES DE AUTENTICACIÓN
// =============================================

/**
 * ENVÍA UN CÓDIGO DE VERIFICACIÓN AL EMAIL DEL USUARIO
 * @param {string} email - Correo electrónico del usuario
 * @returns {Promise<boolean>} - True si se envió correctamente
 */
async function sendVerificationCode(email) {
    try {
        // Usar signInWithOtp para enviar el código OTP por email
        const { data, error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                // No usamos redirectTo porque el usuario ingresa el código manualmente
                // El tipo de OTP por defecto es 'email' (código de 6 dígitos)
            }
        });

        if (error) {
            console.error('❌ Error al enviar código:', error);
            alert('Error al enviar el código. Verifica tu email.');
            return false;
        }

        console.log('✅ Código enviado a:', email);
        currentEmail = email;
        isWaitingForCode = true;
        return true;
    } catch (err) {
        console.error('❌ Excepción en sendVerificationCode:', err);
        return false;
    }
}

/**
 * VERIFICA EL CÓDIGO INGRESADO POR EL USUARIO
 * @param {string} email - Email del usuario (para confirmar)
 * @param {string} token - Código de 6 dígitos
 * @returns {Promise<{success: boolean, user: Object|null}>}
 */
async function verifyCode(email, token) {
    try {
        const { data, error } = await supabase.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email' // Tipo de verificación OTP
        });

        if (error) {
            console.error('❌ Error al verificar código:', error);
            alert('Código inválido o expirado. Intenta nuevamente.');
            return { success: false, user: null };
        }

        console.log('✅ Usuario autenticado:', data.user);
        isWaitingForCode = false;
        currentEmail = '';

        // Crear o actualizar perfil en la tabla public.profiles
        await createOrUpdateProfile(data.user);

        return { success: true, user: data.user };
    } catch (err) {
        console.error('❌ Excepción en verifyCode:', err);
        return { success: false, user: null };
    }
}

/**
 * CREA O ACTUALIZA EL PERFIL DEL USUARIO EN LA TABLA profiles
 * @param {Object} user - Objeto usuario de Supabase
 */
async function createOrUpdateProfile(user) {
    if (!user) return;

    // Datos básicos del perfil
    const profileData = {
        id: user.id,
        email: user.email,
        // Si quieres pedir nombre en otro paso, puedes agregarlo después
        // Por ahora solo guardamos email y fecha de creación si no existe
        updated_at: new Date().toISOString()
    };

    // Verificar si el perfil ya existe
    const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no encontrado
        console.error('❌ Error al verificar perfil:', fetchError);
        return;
    }

    if (existingProfile) {
        // Actualizar perfil existente (solo updated_at)
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ updated_at: profileData.updated_at })
            .eq('id', user.id);

        if (updateError) {
            console.error('❌ Error al actualizar perfil:', updateError);
        } else {
            console.log('✅ Perfil actualizado para:', user.email);
        }
    } else {
        // Crear nuevo perfil
        const { error: insertError } = await supabase
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
// GESTIÓN DEL MODAL DE AUTENTICACIÓN
// =============================================

/**
 * MUESTRA EL MODAL PARA INGRESAR EMAIL Y CÓDIGO
 * Se activa al hacer clic en "Guardar mapa"
 */
function showAuthModal() {
    // Si ya hay un modal abierto, no crear otro
    if (document.getElementById('auth-modal')) {
        document.getElementById('auth-modal').style.display = 'flex';
        return;
    }

    // Crear el modal dinámicamente
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

    // Contenido del modal
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
            <h3 style="margin-top: 0; color: #333;">Guardar mapa</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                Ingresa tu correo electrónico para recibir un código de verificación.
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
                <button id="auth-send-code" style="
                    background: #3388ff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    width: 100%;
                ">Enviar código</button>
            </div>

            <div id="auth-step-code" style="display: none;">
                <label for="auth-code" style="display: block; font-weight: bold; margin-bottom: 5px;">Código de verificación</label>
                <input type="text" id="auth-code" placeholder="Ej: 123456" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-sizing: border-box;
                    margin-bottom: 15px;
                    font-size: 16px;
                    text-align: center;
                    letter-spacing: 8px;
                    font-weight: bold;
                " maxlength="6">
                <button id="auth-verify-code" style="
                    background: #2ca02c;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    width: 100%;
                ">Verificar código</button>
                <p style="font-size: 12px; color: #999; margin-top: 10px;">
                    ¿No recibiste el código? <a href="#" id="auth-resend-link">Reenviar</a>
                </p>
            </div>

            <div id="auth-success" style="display: none; text-align: center;">
                <span style="font-size: 40px;">✅</span>
                <h4 style="margin: 10px 0 5px;">¡Mapa guardado!</h4>
                <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                    Tu mapa ha sido guardado exitosamente.
                </p>
                <button id="auth-success-close" style="
                    background: #3388ff;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cerrar</button>
            </div>

            <div id="auth-error" style="display: none; color: #d32f2f; font-size: 14px; margin-top: 10px;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    // Referencias a elementos
    const emailInput = document.getElementById('auth-email');
    const codeInput = document.getElementById('auth-code');
    const sendBtn = document.getElementById('auth-send-code');
    const verifyBtn = document.getElementById('auth-verify-code');
    const closeBtn = document.getElementById('auth-modal-close');
    const successCloseBtn = document.getElementById('auth-success-close');
    const resendLink = document.getElementById('auth-resend-link');
    const stepEmail = document.getElementById('auth-step-email');
    const stepCode = document.getElementById('auth-step-code');
    const successDiv = document.getElementById('auth-success');
    const errorDiv = document.getElementById('auth-error');

    // Mostrar errores
    function showError(msg) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = msg;
        setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }

    // Enviar código
    sendBtn.addEventListener('click', async function() {
        const email = emailInput.value.trim();
        if (!email || !email.includes('@')) {
            showError('Por favor, ingresa un correo electrónico válido.');
            return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = 'Enviando...';
        const success = await sendVerificationCode(email);
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar código';

        if (success) {
            stepEmail.style.display = 'none';
            stepCode.style.display = 'block';
            // Enfocar el campo de código
            setTimeout(() => codeInput.focus(), 300);
        }
    });

    // Verificar código
    verifyBtn.addEventListener('click', async function() {
        const email = emailInput.value.trim();
        const token = codeInput.value.trim();

        if (!token || token.length < 6) {
            showError('Ingresa el código de 6 dígitos que recibiste por email.');
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verificando...';
        const result = await verifyCode(email, token);
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verificar código';

        if (result.success) {
            stepCode.style.display = 'none';
            successDiv.style.display = 'block';
            // Aquí puedes guardar el estado del mapa en la base de datos
            // Por ahora solo mostramos éxito
            console.log('✅ Usuario autenticado y mapa guardado (simulado)');
        }
    });

    // Reenviar código
    resendLink.addEventListener('click', async function(e) {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) {
            showError('No hay email para reenviar. Vuelve al paso anterior.');
            return;
        }
        const success = await sendVerificationCode(email);
        if (success) {
            alert('Código reenviado a ' + email);
        }
    });

    // Cerrar modal
    function closeModal() {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
        isWaitingForCode = false;
        currentEmail = '';
    }

    closeBtn.addEventListener('click', closeModal);
    successCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    // Presionar Enter en campos
    emailInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendBtn.click();
    });
    codeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') verifyBtn.click();
    });
}

// =============================================
// EXPOSICIÓN PÚBLICA PARA OTROS MÓDULOS
// =============================================

// Hacer disponible la función showAuthModal globalmente
window.showAuthModal = showAuthModal;

// También exponer el cliente Supabase por si se necesita en otros lugares
window.supabaseClient = supabase;

console.log('✅ Módulo de autenticación OTP cargado');
