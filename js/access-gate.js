/*
 * MÓDULO DE CONTROL DE ACCESO (ACCESS GATE)
 * 
 * Responsabilidades:
 * - Aplicar las reglas de acceso según ACCESS_MODE (definido en access-config.js).
 * - Mostrar una pantalla de login/bloqueo si el usuario no cumple los requisitos.
 * - Verificar la autorización del usuario consultando la función RPC de Supabase.
 * - Escuchar cambios en el estado de autenticación para actualizar la vista.
 */

(function() {
    'use strict';

    // =============================================
    // ESTADO
    // =============================================
    let currentUser = null;
    let isAuthorized = false;
    let gateContainer = null;

    // =============================================
    // LÓGICA DE ACCESO
    // =============================================

    /**
     * Determina si el usuario actual puede acceder a la vista actual
     * según el modo de acceso configurado.
     * @returns {boolean}
     */
    async function canUserAccess() {
        const mode = window.ACCESS_CONFIG.mode;
        const isSimplified = window.isSimplifiedMode === true;

        // Modo público: todos pueden acceder a todo.
        if (mode === 'public') {
            return true;
        }

        // Modo 'hybrid': la web simplificada es pública.
        // Solo se restringe la web completa.
        if (mode === 'hybrid' && isSimplified) {
            return true;
        }

        // Para los modos 'restricted_all' y 'hybrid' (en web completa),
        // el usuario debe estar autenticado y autorizado.
        if (!currentUser) {
            return false;
        }

        // Verificar autorización llamando a la función RPC de Supabase.
        // El resultado se cachea para no repetir la llamada en cada cambio de vista.
        try {
            const { data, error } = await window.supabaseClient.rpc('is_authorized_user');
            if (error) {
                console.error('Error al verificar autorización:', error);
                return false;
            }
            isAuthorized = data === true;
            return isAuthorized;
        } catch (err) {
            console.error('Excepción al verificar autorización:', err);
            return false;
        }
    }

    /**
     * Muestra la pantalla de bloqueo con el formulario de magic link.
     * @param {string} message - Mensaje a mostrar al usuario.
     */
    function showGate(message = 'Para acceder a esta web, necesitás iniciar sesión con un correo autorizado.') {
        if (gateContainer) {
            gateContainer.style.display = 'flex';
            return;
        }

        gateContainer = document.createElement('div');
        gateContainer.id = 'access-gate';
        gateContainer.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: #f5f7fa;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 20000;
            font-family: Arial, sans-serif;
            padding: 20px;
            box-sizing: border-box;
        `;

        gateContainer.innerHTML = `
            <div style="
                background: white;
                padding: 40px;
                border-radius: 12px;
                max-width: 420px;
                width: 100%;
                box-shadow: 0 8px 30px rgba(0,0,0,0.15);
                text-align: center;
            ">
                <h2 style="margin-top: 0; color: #2c3e50; font-size: 1.3rem;">Acceso restringido</h2>
                <p style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 25px;">${message}</p>

                <div id="gate-form-step">
                    <label for="gate-email" style="display: block; font-weight: 600; margin-bottom: 6px; text-align: left; color: #333;">Correo electrónico</label>
                    <input type="email" id="gate-email" placeholder="tu@email.com" style="
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        box-sizing: border-box;
                        margin-bottom: 15px;
                        font-size: 15px;
                    ">
                    <button id="gate-send-link" style="
                        background: #3388ff;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 15px;
                        font-weight: 600;
                        width: 100%;
                    ">Enviar enlace de acceso</button>
                    <div id="gate-error" style="display: none; color: #d32f2f; font-size: 13px; margin-top: 12px;"></div>
                </div>

                <div id="gate-sent-step" style="display: none;">
                    <span style="font-size: 40px;">📧</span>
                    <h3 style="margin: 10px 0; color: #333;">Revisá tu correo</h3>
                    <p style="color: #666; font-size: 14px;">Te enviamos un enlace a <strong id="gate-sent-email"></strong>. Hacé clic en él para acceder.</p>
                </div>
            </div>
        `;

        document.body.appendChild(gateContainer);

        // Lógica del formulario
        const emailInput = document.getElementById('gate-email');
        const sendBtn = document.getElementById('gate-send-link');
        const errorDiv = document.getElementById('gate-error');
        const formStep = document.getElementById('gate-form-step');
        const sentStep = document.getElementById('gate-sent-step');
        const sentEmailSpan = document.getElementById('gate-sent-email');

        sendBtn.addEventListener('click', async function() {
            const email = emailInput.value.trim();
            if (!email || !email.includes('@')) {
                errorDiv.textContent = 'Ingresá un correo electrónico válido.';
                errorDiv.style.display = 'block';
                return;
            }

            sendBtn.disabled = true;
            sendBtn.textContent = 'Enviando...';
            errorDiv.style.display = 'none';

            // Usamos la función sendMagicLink existente en auth.js si está disponible,
            // o la llamada directa a Supabase como fallback.
            let success = false;
            if (typeof window.sendMagicLink === 'function') {
                success = await window.sendMagicLink(email, '');
            } else if (window.supabaseClient) {
                const { error } = await window.supabaseClient.auth.signInWithOtp({
                    email: email,
                    options: { emailRedirectTo: window.location.origin + window.location.pathname }
                });
                success = !error;
            }

            sendBtn.disabled = false;
            sendBtn.textContent = 'Enviar enlace de acceso';

            if (success) {
                formStep.style.display = 'none';
                sentStep.style.display = 'block';
                sentEmailSpan.textContent = email;
            } else {
                errorDiv.textContent = 'Error al enviar el enlace. Verificá tu correo e intentá nuevamente.';
                errorDiv.style.display = 'block';
            }
        });

        emailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendBtn.click();
        });
    }

    /**
     * Oculta la pantalla de bloqueo y muestra la aplicación.
     */
    function hideGate() {
        if (gateContainer) {
            gateContainer.style.display = 'none';
        }
    }

    /**
     * Evalúa el acceso y aplica la vista correspondiente (bloqueo o contenido).
     */
    async function evaluateAccess() {
        const hasAccess = await canUserAccess();
        if (hasAccess) {
            hideGate();
        } else {
            const message = currentUser
                ? 'Tu correo electrónico no está autorizado para acceder a esta web. Si creés que es un error, contactá al administrador.'
                : 'Para acceder a esta web, necesitás iniciar sesión con un correo autorizado.';
            showGate(message);
        }
    }

    // =============================================
    // INTEGRACIÓN CON EL CICLO DE VIDA DE LA APP
    // =============================================

    /**
     * Escucha los cambios en el estado de autenticación de Supabase.
     * Cuando el usuario inicia o cierra sesión, se vuelve a evaluar el acceso.
     */
    function setupAuthListener() {
        if (!window.supabaseClient) {
            console.warn('Access Gate: supabaseClient no disponible aún. Reintentando...');
            setTimeout(setupAuthListener, 200);
            return;
        }
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log(`🔐 Access Gate - Cambio de sesión: ${event}`);
            currentUser = session?.user || null;
            // Pequeño delay para asegurar que otros módulos (auth.js) hayan procesado la sesión
            setTimeout(evaluateAccess, 100);
        });
    }

    // Iniciar el gate en cuanto el DOM esté listo.
    document.addEventListener('DOMContentLoaded', function() {
        // Si no hay configuración de acceso, asumimos modo público para no romper nada.
        if (!window.ACCESS_CONFIG) {
            console.warn('ACCESS_CONFIG no definido. Se asume modo público.');
            window.ACCESS_CONFIG = { mode: 'public' };
        }

        // Si el modo es 'public', no hacemos nada y dejamos que la app cargue normalmente.
        if (window.ACCESS_CONFIG.mode === 'public') {
            console.log('🔓 Access Gate: modo público, sin restricciones.');
            return;
        }

        // Escuchar cambios de autenticación para re-evaluar el acceso.
        setupAuthListener();

        // Evaluar el acceso inicial.
        evaluateAccess();
    });
})();
