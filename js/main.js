/*
 * ARCHIVO PRINCIPAL - COORDINACIÓN GENERAL
 * 
 * Este archivo es el "cerebro" de la aplicación:
 * - Inicializa todos los módulos
 * - Mantiene el estado global
 * - Coordina la comunicación entre módulos
 * - Maneja variables compartidas
 */

// =============================================
// VARIABLES GLOBALES COMPARTIDAS
// =============================================

// Estado del mapa y datos geoespaciales
let map;                    // Instancia principal del mapa Leaflet
let geoJsonLayer;           // Capa GeoJSON con todos los departamentos
let allDepartments = [];    // Array con TODOS los departamentos (para reset)

// Datos de comunas de CABA
let comunasCABA = [];       // Array con todas las comunas
let comunasVisible = false; // ¿Las comunas están visibles?
let comunasLayer = null;    // Capa GeoJSON de comunas

// Estado de las divisiones y agrupamientos
let departmentGroups = {};  // {1: {color: '#ff0000', departments: [], name: 'División 1'}, ...}
let currentDivisionCount = 3; // Número actual de divisiones visibles

// Datos externos cargados
let partidosData = null;    // Datos de superficie/población desde datos_partidos.json
let regionesExistentes = null; // Regiones predefinidas desde regiones_administrativas.json

// Control del estado de comunas visibles (para cambiar títulos dinámicamente)
let comunasIncluidas = false;

// Estado de regiones existentes
let currentRegionType = null; // 'secciones_electorales' o 'regiones_sanitarias'

// Sistema de selección por polígono
let polygonMode = false;    // ¿Estamos en modo dibujo de polígono?
let polygonPoints = [];     // Puntos del polígono en construcción
let polygonLayer = null;    // Capa visual del polígono
let polylineLayer = null;   // Línea temporal del polígono
let selectedDepartments = []; // Departamentos seleccionados por polígono
let selectedDepartmentsSet = new Set(); // Para búsquedas rápidas
let pointMarkers = [];      // Marcadores de puntos del polígono

// Estado para fork de propuestas ajenas
window.isViewingOthersProposal = false;
window.isApplyingProposal = false;
window.hasShownForkPopup = false;

// =============================================
// CONSTANTES GLOBALES
// =============================================

// Paleta de colores para las divisiones (15 colores distinguibles y armónicos)
const divisionColors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'
];

// Códigos CDE de departamentos del Gran Buenos Aires (para destacado visual)
const gbaCodes = [
    '06028', '06035', '06091', '06260', '06270', '06274', 
    '06371', '06408', '06410', '06412', '06427', '06434', 
    '06490', '06515', '06539', '06560', '06568', '06658', 
    '06749', '06756', '06760', '06805', '06840', '06861'
];

// =============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =============================================

/**
 * PUNTO DE ENTRADA - Se ejecuta cuando la página termina de cargar
 * Orquesta la inicialización de todos los módulos en el orden correcto
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando aplicación...');
    
    // 1. Primero inicializamos el mapa (módulo map-core.js)
    initializeMap();
    

    Promise.all([
        loadGeoJSON(),          // Datos geográficos de departamentos
        loadPartidosData(),     // Datos de superficie y población de PBA
        loadRegionesExistentes(), // Regiones predefinidas
        loadComunasCABA(),      // Geometrías de comunas de CABA
        loadDatosComuna(),      // Datos de superficie y población de CABA
        loadDatosProvincias()   // Datos de otras provincias (todavía no existe el archivo)
    ]).then(() => {
        console.log('✅ Todos los datos cargados correctamente');
        
        // Ocultar loader antes de mostrar la interfaz
        const loader = document.getElementById('app-loader');
        if (loader) loader.style.display = 'none';
        
        // 3. Inicializamos la interfaz de usuario
        initializeUI();
        
        // 4. Aplicar propuesta pendiente (si el usuario se autenticó antes de cargar los datos)
        if (window.__pendingProposal && typeof applyProposalToUI === 'function') {
            applyProposalToUI(window.__pendingProposal, window.__pendingProposalOptions || {});
            window.__pendingProposal = null;
            window.__pendingProposalOptions = null;
        }
        
        // 4b. Aplicar estado de fork si viene de otra pestaña
        const forkState = localStorage.getItem('divide_las_ba_fork_state');
        if (forkState) {
            try {
                const fork = JSON.parse(forkState);
                localStorage.removeItem('divide_las_ba_fork_state');
                window.isViewingOthersProposal = false;
                window.hasShownForkPopup = true; // evitar que se dispare en la primera modificación
                applyProposalToUI(fork, { isFork: true });
            } catch (e) {
                console.error('Error aplicando fork:', e);
            }
        }
        
        // 5. Verificar si la URL corresponde a una propuesta pública
        checkPublicProposalRoute();
        
    }).catch(error => {
        console.error('❌ Error en la inicialización:', error);
        
        // Ocultar loader aunque haya error
        const loader = document.getElementById('app-loader');
        if (loader) loader.style.display = 'none';
        
        alert('Error al cargar los datos. Verifica la consola para más detalles.');
    });
});

/**
 * INICIALIZACIÓN DE LA INTERFAZ DE USUARIO
 * Configura todos los controles después de que los datos estén listos
 */
function initializeUI() {
    console.log('🎛️ Inicializando interfaz de usuario...');
    
    // Verificar que los datos críticos estén cargados
    if (!allDepartments || allDepartments.length === 0) {
        console.error('❌ No hay departamentos cargados');
        return;
    }
    
    console.log(`📊 Datos disponibles: ${allDepartments.length} departamentos, ${comunasCABA.length} comunas`);
    
    // Sistema de divisiones y drag & drop
    initializeDivisionBoxes(currentDivisionCount);
    
    // Controles principales (ahora en ui-controls-core.js)
    setupResetButton();
    setupDivisionSelector(); 
    setupRegionSelector();
    setupPolygonButton();
    setupComunasButton();
    
    // Sistema de visualización de regionalizaciones
    if (typeof initializeRegionalizaciones === 'function') {
        initializeRegionalizaciones();
    }
    
    // Sistema de visualización de datos
    initializeComparisonTable();
    updateRemainingCount();
    updateDivisionsTitle();

    // Actualizar UI de autenticación
    if (typeof updateAuthUI === 'function') {
    updateAuthUI();
    }

    // Inicializar tabs (por si no se inicializaron antes)
    if (typeof activateTab === 'function') {
        // La inicialización ya ocurre en tabs-manager.js al DOMContentLoaded
    }
    
    console.log('✅ Interfaz de usuario inicializada');
}

// =============================================
// FUNCIONES DE COMUNICACIÓN ENTRE MÓDULOS
// =============================================

/**
 * Notifica a todos los módulos que deben actualizar sus visualizaciones.
 * Además, si estamos viendo una propuesta ajena y el usuario la modifica,
 * dispara el popup de fork.
 */
function notifyStateChange() {
    if (typeof updateDepartmentGroups === 'function') {
        updateDepartmentGroups();
    }
    if (typeof updateMapColors === 'function') {
        updateMapColors();
    }
    if (typeof updateComparisonTable === 'function') {
        updateComparisonTable();
    }
    if (typeof updateRemainingCount === 'function') {
        updateRemainingCount();
    }
    
    // Detectar fork: si estamos viendo propuesta ajena y el usuario la modifica
    if (window.isViewingOthersProposal && !window.isApplyingProposal && !window.hasShownForkPopup) {
        window.hasShownForkPopup = true;
        if (typeof showForkModal === 'function') {
            showForkModal();
        }
    }
    
    // Invalidar el mapa pre-generado: cualquier cambio en la propuesta
    // implica que la imagen cacheada quedó obsoleta.
    if (typeof window.invalidateMapImageCache === 'function') {
        window.invalidateMapImageCache();
    }
}

/**
 * Limpia toda la selección actual de departamentos
 * Útil después de mover grupos o cambiar modos
 */
function clearAllSelections() {
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    // Limpia selección visual en la interfaz
    document.querySelectorAll('.department-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    if (typeof updateMapColors === 'function') {
        updateMapColors();
    }
}

// =============================================
// FUNCIONES DE ACCESO GLOBAL (para otros módulos)
// =============================================

/**
 * Actualiza el título de la columna de divisiones según si comunas están incluidas
 */
function updateDivisionsTitle() {
    const titleElement = document.getElementById('divisions-title');
    if (titleElement) {
        if (comunasIncluidas) {
            titleElement.textContent = 'Divisiones de (las) Buenos Aires';
        } else {
            titleElement.textContent = 'Divisiones de Buenos Aires';
        }
    }
}

/**
 * Obtiene un departamento por su nombre
 * @param {string} departmentName - Nombre del departamento
 * @returns {Object|null} - Departamento encontrado o null
 */
function getDepartmentByName(departmentName) {
    return allDepartments.find(dept => dept.properties.nam === departmentName);
}

/**
 * Obtiene el código CDE de un departamento por su nombre  
 * @param {string} departmentName - Nombre del departamento
 * @returns {string|null} - Código CDE o null
 */
function getDepartmentCode(departmentName) {
    const dept = getDepartmentByName(departmentName);
    return dept ? dept.properties.cde : null;
}

/**
 * Verifica si un departamento pertenece al GBA
 * @param {string} departmentName - Nombre del departamento
 * @returns {boolean} - True si es del GBA
 */
function isGBADepartment(departmentName) {
    const code = getDepartmentCode(departmentName);
    return code ? gbaCodes.includes(code) : false;
}


/**
 * DETECTA SI LA URL CORRESPONDE A UNA PROPUESTA PÚBLICA
 * y carga los datos correspondientes.
 */
async function checkPublicProposalRoute() {
    const path = window.location.pathname;
    const match = path.match(/\/propuesta\/([a-z0-9]+)/);
    
    if (!match) return;
    
    const shareCode = match[1];
    console.log('📋 Detectada ruta de propuesta pública:', shareCode);
    
    if (typeof loadPublicProposal !== 'function' || typeof applyProposalToUI !== 'function') {
        console.warn('⚠️ Módulos de propuesta no disponibles todavía');
        return;
    }
    
    const proposal = await loadPublicProposal(shareCode);
    if (proposal) {
        window.isViewingOthersProposal = true;
        window.hasShownForkPopup = false;
        applyProposalToUI(proposal, { isPublic: true });
    } else {
        console.warn('⚠️ No se encontró propuesta pública con código:', shareCode);
    }
}

// =============================================
// FORK DE PROPUESTA AJENA
// =============================================

/**
 * MUESTRA EL POPUP QUE EXPLICA QUE AHORA SE ESTÁ ARMANDO
 * UNA PROPUESTA PROPIA A PARTIR DE UNA AJENA.
 */
function showForkModal() {
    const modal = document.getElementById('fork-modal');
    if (!modal) return;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    const acceptBtn = document.getElementById('fork-accept-btn');
    if (acceptBtn) {
        // Limpiar listeners previos para no duplicar
        const newBtn = acceptBtn.cloneNode(true);
        acceptBtn.parentNode.replaceChild(newBtn, acceptBtn);
        newBtn.addEventListener('click', handleForkAccept);
    }
}

/**
 * MANEJA LA ACEPTACIÓN DEL FORK
 * Guarda el estado actual en localStorage, abre una nueva pestaña
 * y recarga la actual para volver a la vista original.
 */
function handleForkAccept() {
    const modal = document.getElementById('fork-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Serializar el estado actual (sin título ni autor)
    const forkedState = serializeProposal();
    forkedState.titulo = ''; // el título pertenece al usuario original
    forkedState.nombre_autor = null;
    forkedState.mostrar_nombre_publicamente = false;
    
    // Guardar en localStorage para que la nueva pestaña lo lea
    try {
        localStorage.setItem('divide_las_ba_fork_state', JSON.stringify(forkedState));
    } catch (err) {
        console.error('Error al guardar fork en localStorage:', err);
    }
    
    // Abrir nueva pestaña
    window.open(window.location.origin + '/', '_blank');
    
    // Resetear la pestaña actual
    window.location.reload();
}

window.showForkModal = showForkModal;
