/*
 * MÓDULO DE FORMULARIO DE CONTACTO
 * 
 * Responsabilidades:
 * - Validación del formulario de contacto
 * - Envío de mensajes a la base de datos (Supabase)
 * - Feedback visual de éxito/error
 *
 * NOTA PARA FUTURAS MEJORAS:
 * No utilizar emojis en la interfaz visible al usuario.
 * Solo se permite su uso en mensajes de log (console.log).
 */

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
    const submitBtn = document.getElementById('contact-submit');
    
    // Contador de caracteres
    if (messageField && counter) {
        messageField.addEventListener('input', function() {
            counter.textContent = this.value.length;
        });
    }
    
    function showError(msg) {
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
    }
    
    function hideMessages() {
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
    }
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideMessages();
        
        const nombre = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const asunto = document.getElementById('contact-subject').value.trim();
        const mensaje = document.getElementById('contact-message').value.trim();
        
        // Validaciones
        if (nombre.length < 2) return showError('Ingresá tu nombre (mínimo 2 caracteres).');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Ingresá un correo electrónico válido.');
        if (asunto.length < 3) return showError('El asunto debe tener al menos 3 caracteres.');
        if (mensaje.length < 10) return showError('El mensaje debe tener al menos 10 caracteres.');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        
        try {
            if (!window.supabaseClient) {
                throw new Error('Cliente Supabase no disponible');
            }
            
            const { error } = await window.supabaseClient
                .from('contact_messages')
                .insert([{
                    nombre: nombre,
                    email: email,
                    asunto: asunto,
                    mensaje: mensaje,
                    created_at: new Date().toISOString()
                }]);
            
            if (error) throw error;
            
            console.log('✅ Mensaje de contacto enviado');
            form.reset();
            if (counter) counter.textContent = '0';
            successDiv.style.display = 'block';
            
        } catch (err) {
            console.error('❌ Error al enviar mensaje:', err);
            showError('Hubo un error al enviar tu mensaje. Por favor intentá nuevamente en unos minutos.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar mensaje';
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initializeContactForm();
    console.log('✅ Formulario de contacto inicializado');
});
