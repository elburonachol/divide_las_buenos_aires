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

let map;
let geoJsonLayer;
let allDepartments = [];

let comunasCABA = [];
let comunasVisible = false;
let comunasLayer = null;

let departmentGroups = {};
let currentDivisionCount = 3;

let partidosData = null;
let regionesExistentes = null;

let comunasIncluidas = false;
let currentRegionType = null;

let polygonMode = false;
let polygonPoints = [];
let polygonLayer = null;
let polylineLayer = null;
let selectedDepartments = [];
let selectedDepartmentsSet = new Set();
let pointMarkers = [];

// Propuesta que se está viendo (en simplificada o al cargar desde sessionStorage)
window.currentViewedProposal = null;

// =============================================
// CONSTANTES GLOBALES
// =============================================

const divisionColors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'
];

const gbaCodes = [
    '06028', '06035', '06091', '06260', '06270', '06274', 
    '06371', '06408', '06410', '06412', '06427', '06434', 
    '06490', '06515', '06539', '06560', '06568', '06658', 
    '06749', '06756', '06760', '06805', '06840', '06861'
];

// =============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando aplicación...');
    
    // 1. Detectar modo simplificado ANTES de inicializar la UI
    const path = window.location.pathname;
    window.isSimplifiedMode = /\/propuesta\/[a-z0-9]+/.test(path);
    if (window.isSimplifiedMode) {
        console.log('🔒 Detectado modo simplificado (propuesta pública)');
    }
    
    // 2. Propuesta a cargar desde sessionStorage (flujo "Ir a la web completa")
    let pendingProposalFromSession = null;
    try {
        const stored = sessionStorage.getItem('divide_ba_proposal_to_load');
        if (stored) {
            pendingProposalFromSession = JSON.parse(stored);
            sessionStorage.removeItem('divide_ba_proposal_to_load');
            console.log('📦 Propuesta recuperada de sessionStorage');
        }
    } catch (e) {
        console.warn('Error leyendo propuesta de sessionStorage:', e);
    }
    
    // 3. Inicializar mapa
    initializeMap();
    
    Promise.all([
        loadGeoJSON(),
        loadPartidosData(),
        loadRegionesExistentes(),
        loadComunasCABA(),
        loadDatosComuna(),
        loadDatosProvincias()
    ]).then(() => {
        console.log('✅ Todos los datos cargados correctamente');
        
        const loader = document.getElementById('app-loader');
        if (loader) loader.style.display = 'none';
        
        // 4. Inicializar UI
        initializeUI();
        
        // 5. Aplicar propuesta desde sessionStorage (si existe)
        if (pendingProposalFromSession && typeof applyProposalToUI === 'function') {
            window.currentViewedProposal = pendingProposalFromSession;
            applyProposalToUI(pendingProposalFromSession, { isPublic: false });
        }
        
        // 6. Aplicar propuesta pendiente (auth flow legacy)
        if (window.__pendingProposal && typeof applyProposalToUI === 'function') {
            applyProposalToUI(window.__pendingProposal, window.__pendingProposalOptions || {});
            window.__pendingProposal = null;
            window.__pendingProposalOptions = null;
        }
        
        // 7. Verificar ruta de propuesta pública
        checkPublicProposalRoute();
        
        // 8. Decidir si mostrar el tutorial (esperar un poco para que la UI se estabilice)
        setTimeout(() => {
            if (typeof window.maybeShowTutorial === 'function') {
                window.maybeShowTutorial();
            }
        }, 500);
        
    }).catch(error => {
        console.error('❌ Error en la inicialización:', error);
        const loader = document.getElementById('app-loader');
        if (loader) loader.style.display = 'none';
        alert('Error al cargar los datos. Verifica la consola para más detalles.');
    });
});

function initializeUI() {
    console.log('🎛️ Inicializando interfaz de usuario...');
    
    if (!allDepartments || allDepartments.length === 0) {
        console.error('❌ No hay departamentos cargados');
        return;
    }
    
    console.log(`📊 Datos disponibles: ${allDepartments.length} departamentos, ${comunasCABA.length} comunas`);
    
    initializeDivisionBoxes(currentDivisionCount);
    
    setupResetButton();
    setupDivisionSelector(); 
    setupRegionSelector();
    setupPolygonButton();
    setupComunasButton();
    
    if (typeof initializeRegionalizaciones === 'function') {
        initializeRegionalizaciones();
    }
    
    initializeComparisonTable();
    updateRemainingCount();
    updateDivisionsTitle();

    if (typeof updateAuthUI === 'function') {
        updateAuthUI();
    }
    
    console.log('✅ Interfaz de usuario inicializada');
}

// =============================================
// FUNCIONES DE COMUNICACIÓN ENTRE MÓDULOS
// =============================================

function notifyStateChange() {
    if (typeof updateDepartmentGroups === 'function') updateDepartmentGroups();
    if (typeof updateMapColors === 'function') updateMapColors();
    if (typeof updateComparisonTable === 'function') updateComparisonTable();
    if (typeof updateRemainingCount === 'function') updateRemainingCount();
    
    if (typeof window.invalidateMapImageCache === 'function') {
        window.invalidateMapImageCache();
    }
}

function clearAllSelections() {
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    document.querySelectorAll('.department-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    if (typeof updateMapColors === 'function') updateMapColors();
}

// =============================================
// FUNCIONES DE ACCESO GLOBAL
// =============================================

function updateDivisionsTitle() {
    const titleElement = document.getElementById('divisions-title');
    if (titleElement) {
        titleElement.textContent = comunasIncluidas
            ? 'Divisiones de (las) Buenos Aires'
            : 'Divisiones de Buenos Aires';
    }
}

function getDepartmentByName(departmentName) {
    return allDepartments.find(dept => dept.properties.nam === departmentName);
}

function getDepartmentCode(departmentName) {
    const dept = getDepartmentByName(departmentName);
    return dept ? dept.properties.cde : null;
}

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
        window.currentViewedProposal = proposal;
        applyProposalToUI(proposal, { isPublic: true });
    } else {
        console.warn('⚠️ No se encontró propuesta pública con código:', shareCode);
    }
}
