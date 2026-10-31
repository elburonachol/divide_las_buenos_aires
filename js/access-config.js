/*
 * CONFIGURACIÓN DE MODO DE ACCESO
 * 
 * Define el nivel de restricción de la web. Cambia el valor de ACCESS_MODE
 * para alternar entre los distintos modos.
 * 
 * MODOS DISPONIBLES:
 * - 'public': Acceso libre para todos (comportamiento actual).
 * - 'restricted_all': Solo usuarios autenticados y autorizados (lista blanca)
 *   pueden acceder a la web completa y simplificada.
 * - 'hybrid': Solo usuarios autenticados y autorizados pueden acceder
 *   a la web completa. La web simplificada es pública.
 */

const ACCESS_MODE = 'restricted_all'; // <-- CAMBIA ESTE VALOR PARA ALTERNAR ENTRE MODOS

// Exponer la configuración globalmente
window.ACCESS_CONFIG = {
    mode: ACCESS_MODE
};

console.log(`🔐 Modo de acceso configurado: ${ACCESS_MODE}`);
