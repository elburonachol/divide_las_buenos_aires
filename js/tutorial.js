/*
 * MÓDULO DE TUTORIAL
 * 
 * Responsabilidades:
 * - Popup inicial "¿Iniciar tutorial?" con barra de progreso de 20s
 * - Tutorial paso a paso (6 pantallas) con spotlight
 * - Diferenciar entre tutorial de web completa y simplificada
 * - Persistencia de "ya vio el tutorial" en localStorage
 */

// =============================================
// CONSTANTES
// =============================================

const TUTORIAL_STORAGE_FULL = 'divide_ba_tutorial_full_seen';
const TUTORIAL_STORAGE_SIMPLIFIED = 'divide_ba_tutorial_simplified_seen';

const TUTORIAL_PASOS_FULL = [
    {
        selector: '.controls',
        texto: 'Acá podés establecer los valores básicos de tu propuesta: cuántas divisiones va a tener en total, basarte en regionalizaciones administrativas o propuestas de división preexistentes, si incluir o no a las comunas de CABA, etc.; y, si querés arrancar desde cero, reestablecer los valores iniciales en la web'
    },
    {
        selector: '#map-container',
        texto: 'Acá podés explorar cómo se verían (las) Buenos Aires según la división propuesta y, haciendo click en departamentos puntuales, podés ver la información subyacente de los mismos'
    },
    {
        selector: '.divisions-column',
        texto: 'Acá podés ver los colores de las potenciales divisiones, que se corresponden con el mapa; departamentos que pertenecen a cada potencial división; y los nombres de las potenciales divisiones, que son editables para el autor de la propuesta'
    },
    {
        selector: '.comparison-section',
        texto: 'Acá podés ver una comparación en tabla de algunas variables destacadas para esas potenciales divisiones y, también, respecto a otras provincias argentinas existentes. Hay algunas variables que se pueden presentar de más de una forma'
    },
    {
        selector: '.tabs-nav',
        texto: 'Acá podés saber más sobre cuál es la fuente y cómo se procesan las variables y las geometrías mostradas, además de saber más sobre el proyecto y cómo contactarnos'
    },
    {
        selector: '#proposal-dropdown',
        texto: 'Si querés armar tu propia propuesta, acá vas a poder gestionar todo sobre tu cuenta: guardar borradores de propuestas, hacerlas públicas, compartirlas, etc.'
    }
];

const TUTORIAL_PASOS_SIMPLIFIED = [
    {
        selector: '.controls',
        texto: 'Acá podés agregar los límites de las regionalizaciones administrativas existentes. En la web completa, acá también vas a encontrar otras funciones importantes para poder armar una propuesta propia de la división de (las) Buenos Aires'
    },
    {
        selector: '#map-container',
        texto: 'Acá podés explorar cómo se verían (las) Buenos Aires según la división propuesta y, haciendo click en departamentos puntuales, podés ver la información subyacente de los mismos'
    },
    {
        selector: '.divisions-column',
        texto: 'Acá podés ver las divisiones propuestas por otro usuario, con los colores respectivos en el mapa. En la web completa, acá también vas a encontrar el listado de departamentos, que no se incluye en ninguna división específica.'
    },
    {
        selector: '.comparison-section',
        texto: 'Acá podés ver una comparación en tabla de algunas variables destacadas para esas potenciales divisiones y, también, respecto a otras provincias argentinas existentes. Hay algunas variables que se pueden presentar de más de una forma'
    },
    {
        selector: '.tabs-nav',
        texto: 'Acá podés saber más sobre cuál es la fuente y cómo se procesan las variables y las geometrías mostradas, además de saber más sobre el proyecto y cómo contactarnos'
    },
    {
        selector: '#go-full-web-wrapper',
        texto: 'Acá podés acceder a la web completa, para crear y compartir tu propuesta, o crear otras. Y, una vez que estés allí, acá vas a poder gestionar todo sobre tu cuenta: guardar borradores de propuestas, hacerlas públicas, compartirlas, etc.'
    }
];

// =============================================
// ESTADO
// =============================================

let tutorialState = {
    pasos: [],
    pasoActual: 0,
    spotlightEl: null,
    tooltipEl: null,
    resizeHandler: null
};

// =============================================
// PUNTO DE ENTRADA
// =============================================

/**
 * DECIDE SI MOSTRAR EL TUTORIAL Y, EN CASO AFIRMATIVO, LO ARRANCA.
 * Debe llamarse después de que la UI esté inicializada.
 */
function maybeShowTutorial() {
    const user = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (user) return;
    
    const isSimplified = typeof window.isSimplifiedMode === 'function' && window.isSimplifiedMode();
    const cameFromSimplified = sessionStorage.getItem('divide_ba_came_from_simplified') === 'true';
    
    if (isSimplified) {
        if (localStorage.getItem(TUTORIAL_STORAGE_SIMPLIFIED) === 'true') return;
        setTimeout(() => showTutorialPrompt('simplified'), 800);
    } else {
        if (cameFromSimplified) {
            sessionStorage.removeItem('divide_ba_came_from_simplified');
            return;
        }
        if (localStorage.getItem(TUTORIAL_STORAGE_FULL) === 'true') return;
        setTimeout(() => showTutorialPrompt('full'), 800);
    }
}

// =============================================
// POPUP INICIAL
// =============================================

function showTutorialPrompt(mode) {
    if (document.getElementById('tutorial-prompt')) return;
    
    const prompt = document.createElement('div');
    prompt.id = 'tutorial-prompt';
    prompt.className = 'tutorial-prompt';
    
    prompt.innerHTML = `
        <button class="tutorial-prompt-close" id="tutorial-prompt-close" aria-label="Cerrar">×</button>
        <h4>¿Iniciar tutorial de la web?</h4>
        <div class="tutorial-prompt-buttons">
            <button class="tut-secondary" id="tutorial-prompt-no">No, ya la conozco</button>
            <button class="tut-primary" id="tutorial-prompt-yes">Sí</button>
        </div>
        <div class="tutorial-progress-bar"></div>
    `;
    
    document.body.appendChild(prompt);
    
    let finished = false;
    
    function dismiss(seen) {
        if (finished) return;
        finished = true;
        if (prompt.parentNode) prompt.parentNode.removeChild(prompt);
        if (seen) markTutorialSeen(mode);
    }
    
    document.getElementById('tutorial-prompt-close').addEventListener('click', () => dismiss(true));
    document.getElementById('tutorial-prompt-no').addEventListener('click', () => dismiss(true));
    document.getElementById('tutorial-prompt-yes').addEventListener('click', () => {
        dismiss(true);
        startTutorial(mode);
    });
    
    const progressBar = prompt.querySelector('.tutorial-progress-bar');
    progressBar.addEventListener('animationend', function() {
        if (finished) return;
        dismiss(true);
        startTutorial(mode);
    });
}

function markTutorialSeen(mode) {
    const key = mode === 'simplified' ? TUTORIAL_STORAGE_SIMPLIFIED : TUTORIAL_STORAGE_FULL;
    try { localStorage.setItem(key, 'true'); }
    catch (err) { console.warn('No se pudo guardar el estado del tutorial:', err); }
}

// =============================================
// TUTORIAL PASO A PASO
// =============================================

function startTutorial(mode) {
    tutorialState.pasos = mode === 'simplified' ? TUTORIAL_PASOS_SIMPLIFIED : TUTORIAL_PASOS_FULL;
    tutorialState.pasoActual = 0;
    
    const spotlight = document.createElement('div');
    spotlight.id = 'tutorial-spotlight';
    spotlight.className = 'tutorial-spotlight';
    spotlight.style.display = 'none';
    document.body.appendChild(spotlight);
    tutorialState.spotlightEl = spotlight;
    
    const tooltip = document.createElement('div');
    tooltip.id = 'tutorial-tooltip';
    tooltip.className = 'tutorial-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
    tutorialState.tooltipEl = tooltip;
    
    tutorialState.resizeHandler = function() { positionCurrentStep(); };
    window.addEventListener('resize', tutorialState.resizeHandler);
    window.addEventListener('scroll', tutorialState.resizeHandler, true);
    
    showStep(0);
}

function showStep(index) {
    const paso = tutorialState.pasos[index];
    if (!paso) return;
    
    tutorialState.pasoActual = index;
    
    const target = document.querySelector(paso.selector);
    if (!target) {
        if (index < tutorialState.pasos.length - 1) return showStep(index + 1);
        return endTutorial();
    }
    
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => positionCurrentStep(), 450);
}

function positionCurrentStep() {
    const paso = tutorialState.pasos[tutorialState.pasoActual];
    if (!paso) return;
    
    const target = document.querySelector(paso.selector);
    if (!target) return;
    
    const rect = target.getBoundingClientRect();
    const padding = 6;
    
    const spotlight = tutorialState.spotlightEl;
    spotlight.style.display = 'block';
    spotlight.style.top = (rect.top - padding) + 'px';
    spotlight.style.left = (rect.left - padding) + 'px';
    spotlight.style.width = (rect.width + padding * 2) + 'px';
    spotlight.style.height = (rect.height + padding * 2) + 'px';
    
    renderTooltip(paso, rect);
}

function renderTooltip(paso, rect) {
    const tooltip = tutorialState.tooltipEl;
    const total = tutorialState.pasos.length;
    const actual = tutorialState.pasoActual + 1;
    const esPrimerPaso = tutorialState.pasoActual === 0;
    const esUltimoPaso = tutorialState.pasoActual === total - 1;
    
    tooltip.style.display = 'block';
    tooltip.innerHTML = `
        <button class="tut-close" id="tut-close" aria-label="Cerrar tutorial">×</button>
        <p class="tut-text">${paso.texto}</p>
        <div class="tut-actions">
            <span class="tut-counter">${actual} / ${total}</span>
            <div class="tut-actions-right">
                ${!esPrimerPaso ? '<button class="tut-btn tut-btn-secondary" id="tut-prev">Anterior</button>' : ''}
                <button class="tut-btn tut-btn-primary" id="tut-next">
                    ${esUltimoPaso ? 'Finalizar' : 'Siguiente'}
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('tut-close').addEventListener('click', endTutorial);
    
    const prevBtn = document.getElementById('tut-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (tutorialState.pasoActual > 0) showStep(tutorialState.pasoActual - 1);
        });
    }
    
    document.getElementById('tut-next').addEventListener('click', () => {
        if (esUltimoPaso) endTutorial();
        else showStep(tutorialState.pasoActual + 1);
    });
    
    positionTooltip(rect);
}

function positionTooltip(rect) {
    const tooltip = tutorialState.tooltipEl;
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 14;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    
    let top, left;
    
    if (rect.bottom + margin + tooltipRect.height < viewportH - 10) {
        top = rect.bottom + margin;
    } else if (rect.top - margin - tooltipRect.height > 10) {
        top = rect.top - margin - tooltipRect.height;
    } else {
        top = Math.max(10, (viewportH - tooltipRect.height) / 2);
    }
    
    left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    if (left < 10) left = 10;
    if (left + tooltipRect.width > viewportW - 10) left = viewportW - 10 - tooltipRect.width;
    
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
}

function endTutorial() {
    const spotlight = tutorialState.spotlightEl;
    const tooltip = tutorialState.tooltipEl;
    if (spotlight && spotlight.parentNode) spotlight.parentNode.removeChild(spotlight);
    if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    
    if (tutorialState.resizeHandler) {
        window.removeEventListener('resize', tutorialState.resizeHandler);
        window.removeEventListener('scroll', tutorialState.resizeHandler, true);
    }
    
    tutorialState = {
        pasos: [], pasoActual: 0,
        spotlightEl: null, tooltipEl: null, resizeHandler: null
    };
}

// =============================================
// EXPOSICIÓN GLOBAL
// =============================================

window.maybeShowTutorial = maybeShowTutorial;

console.log('✅ Módulo de tutorial inicializado');
