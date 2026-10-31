/*
 * MÓDULO DE TUTORIAL
 * 
 * Responsabilidades:
 * - Popup inicial "¿Iniciar tutorial?" con barra de progreso de 20s
 * - Tutorial paso a paso (6 pantallas) con spotlight
 * - Diferenciar entre tutorial de web completa y simplificada
 * - Persistencia de "ya vio el tutorial" en localStorage
 *
 * NOTAS DE DISEÑO:
 * - El popup inicial aparece arriba a la izquierda (ver tutorial.css).
 * - Los pasos pueden apuntar a UN selector (`selector`) o a VARIOS
 *   (`selectors: [...]`). Con varios, se calcula el rectángulo envolvente
 *   (union rect) para el spotlight y se hace scroll al primero.
 * - Si el rectángulo destacado es más alto que el viewport, el scroll se
 *   alinea con el TOP del elemento (no al centro), para que el usuario vea
 *   el comienzo de la zona destacada.
 * - El tooltip intenta posicionarse abajo → arriba → derecha → izquierda,
 *   evitando SIEMPRE superponerse con el rectángulo destacado. La única
 *   excepción es el paso 4 (tabla comparativa), que puede ser más alta que
 *   el viewport y ocupa todo el ancho: allí el tooltip se superpone
 *   (`forceOverlay: true`).
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
        // En la web completa se resaltan tanto las cajas de división
        // como el listado de departamentos (que aparece a la derecha).
        selectors: ['.divisions-column', '.list-column'],
        texto: 'Acá podés ver los colores de las potenciales divisiones, que se corresponden con el mapa; departamentos que pertenecen a cada potencial división; y los nombres de las potenciales divisiones, que son editables para el autor de la propuesta'
    },
    {
        selector: '.comparison-section',
        // La tabla comparativa suele ocupar todo el ancho y ser más alta
        // que el viewport: el tooltip se superpone (no hay otra opción).
        forceOverlay: true,
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
        // En la vista simplificada el listado de departamentos está oculto,
        // así que solo se destaca la columna de divisiones.
        selector: '.divisions-column',
        texto: 'Acá podés ver las divisiones propuestas por otro usuario, con los colores respectivos en el mapa. En la web completa, acá también vas a encontrar el listado de departamentos, que no se incluye en ninguna división específica.'
    },
    {
        selector: '.comparison-section',
        forceOverlay: true,
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
// HELPERS GEOMÉTRICOS
// =============================================

/**
 * DEVUELVE LA LISTA DE ELEMENTOS OBJETIVO DE UN PASO.
 * Un paso puede definir `selector` (uno solo) o `selectors` (varios).
 * @param {Object} paso
 * @returns {HTMLElement[]}
 */
function getStepTargets(paso) {
    if (Array.isArray(paso.selectors)) {
        return paso.selectors
            .map(sel => document.querySelector(sel))
            .filter(Boolean);
    }
    if (paso.selector) {
        const el = document.querySelector(paso.selector);
        return el ? [el] : [];
    }
    return [];
}

/**
 * DEVUELVE EL RECTÁNGULO ENVOLVENTE (UNION RECT) DE VARIOS ELEMENTOS.
 * Si recibe uno solo, devuelve su rect directamente.
 * @param {HTMLElement[]} elements
 * @returns {{top,left,right,bottom,width,height}|null}
 */
function getUnionRect(elements) {
    if (!elements || elements.length === 0) return null;
    if (elements.length === 1) {
        const r = elements[0].getBoundingClientRect();
        return {
            top: r.top, left: r.left, right: r.right, bottom: r.bottom,
            width: r.width, height: r.height
        };
    }
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    elements.forEach(el => {
        const r = el.getBoundingClientRect();
        top = Math.min(top, r.top);
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
    });
    return { top, left, right, bottom, width: right - left, height: bottom - top };
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

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
    
    const isSimplified = window.isSimplifiedMode === true;
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
    
    const targets = getStepTargets(paso);
    if (targets.length === 0) {
        if (index < tutorialState.pasos.length - 1) return showStep(index + 1);
        return endTutorial();
    }
    
    // Alineación de scroll:
    // - Si el rectángulo envolvente es más alto que el viewport,
    //   alinear con el TOP del primer target (para que el usuario
    //   vea el comienzo de la zona destacada).
    // - Si no, centrar el target en el viewport.
    const unionRect = getUnionRect(targets);
    const viewportH = window.innerHeight;
    const block = (unionRect.height > viewportH * 0.7) ? 'start' : 'center';
    targets[0].scrollIntoView({ behavior: 'smooth', block });
    
    setTimeout(() => positionCurrentStep(), 450);
}

function positionCurrentStep() {
    const paso = tutorialState.pasos[tutorialState.pasoActual];
    if (!paso) return;
    
    const targets = getStepTargets(paso);
    if (targets.length === 0) return;
    
    const rect = getUnionRect(targets);
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

/**
 * POSICIONA EL TOOLTIP EVITANDO SUPERPOSICIÓN CON EL RECTÁNGULO DESTACADO.
 * Orden de preferencia: abajo → arriba → derecha → izquierda → centrado.
 * Excepción: si el paso tiene `forceOverlay: true`, se centra en el viewport
 * (necesario para la tabla comparativa del paso 4, que ocupa todo el ancho
 * y suele ser más alta que el viewport).
 * 
 * Si el tooltip no entra en ninguna de las posiciones "no solapadas"
 * (por ejemplo, en pantallas muy chicas), se centra como último recurso.
 */
function positionTooltip(rect) {
    const tooltip = tutorialState.tooltipEl;
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 14;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const step = tutorialState.pasos[tutorialState.pasoActual];
    
    // Caso especial: overlay permitido (paso 4).
    if (step.forceOverlay) {
        const top = Math.max(10, (viewportH - tooltipRect.height) / 2);
        const left = Math.max(10, (viewportW - tooltipRect.width) / 2);
        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        return;
    }
    
    // Intentar ABAJO del rectángulo destacado
    if (rect.bottom + margin + tooltipRect.height < viewportH - 10) {
        const top = rect.bottom + margin;
        const left = clamp(
            rect.left + (rect.width / 2) - (tooltipRect.width / 2),
            10, viewportW - tooltipRect.width - 10
        );
        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        return;
    }
    // Intentar ARRIBA
    if (rect.top - margin - tooltipRect.height > 10) {
        const top = rect.top - margin - tooltipRect.height;
        const left = clamp(
            rect.left + (rect.width / 2) - (tooltipRect.width / 2),
            10, viewportW - tooltipRect.width - 10
        );
        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        return;
    }
    // Intentar a la DERECHA (centrado vertical respecto al target)
    if (rect.right + margin + tooltipRect.width < viewportW - 10) {
        const left = rect.right + margin;
        const top = clamp(
            rect.top + (rect.height / 2) - (tooltipRect.height / 2),
            10, viewportH - tooltipRect.height - 10
        );
        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        return;
    }
    // Intentar a la IZQUIERDA
    if (rect.left - margin - tooltipRect.width > 10) {
        const left = rect.left - margin - tooltipRect.width;
        const top = clamp(
            rect.top + (rect.height / 2) - (tooltipRect.height / 2),
            10, viewportH - tooltipRect.height - 10
        );
        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        return;
    }
    // Último recurso: centrado en el viewport (puede superponerse)
    const top = Math.max(10, (viewportH - tooltipRect.height) / 2);
    const left = Math.max(10, (viewportW - tooltipRect.width) / 2);
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
