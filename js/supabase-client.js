/*
 * CLIENTE DE SUPABASE
 * 
 * Responsabilidades:
 * - Inicialización del cliente Supabase usando las credenciales
 *   inyectadas en tiempo de build (window.SUPABASE_CONFIG).
 * - Exposición global del cliente para el resto de los módulos.
 *
 * ORDEN DE CARGA: este archivo debe cargarse ANTES que auth.js y proposals.js.
 */

// =============================================
// VERIFICACIÓN DE CONFIGURACIÓN
// =============================================

if (typeof window.SUPABASE_CONFIG === 'undefined') {
    console.error('❌ SUPABASE_CONFIG no definido. Verificar build.js');
}

// =============================================
// INICIALIZACIÓN DEL CLIENTE
// =============================================

const supabaseUrl = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || '';
const supabaseAnonKey = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.anonKey) || '';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Exposición global para el resto de los módulos
window.supabaseClient = supabaseClient;

console.log('✅ Cliente Supabase inicializado');
