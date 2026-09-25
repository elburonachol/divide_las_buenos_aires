/*
 * MÓDULO DE TABLA COMPARATIVA
 * 
 * Responsabilidades:
 * - Inicialización y actualización de la tabla comparativa
 */

// =============================================
// TABLA COMPARATIVA
// =============================================


/**
 * INICIALIZA LA ESTRUCTURA DE LA TABLA COMPARATIVA
 */
function initializeComparisonTable() {
    updateComparisonTable();
}

/**
 * CALCULA EL COLOR DE CONTRASTE PARA TEXTO SEGÚN FONDO
 * @param {string} hexColor - Color de fondo en formato hexadecimal
 * @returns {string} - '#000000' (negro) o '#FFFFFF' (blanco)
 */
function getContrastColor(hexColor) {
    // Convertir hex a RGB
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    // Calcular luminosidad (fórmula de percepción humana)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Retornar negro para fondos claros, blanco para fondos oscuros
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * ACTUALIZA LA TABLA COMPARATIVA CON LOS DATOS ACTUALES
 * Muestra cantidad de partidos, superficie, población y densidad por división
 */
function updateComparisonTable() {
    const table = document.getElementById('comparison-table');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    
    // Limpiar tabla existente
    thead.innerHTML = '<th>Variable</th>';
    tbody.innerHTML = '';
    
    // Crear encabezados de columnas con nombres de divisiones
    for (let i = 1; i <= currentDivisionCount; i++) {
        const th = document.createElement('th');
        th.textContent = departmentGroups[i] ? departmentGroups[i].name : `División ${i}`;
        th.style.backgroundColor = departmentGroups[i] ? departmentGroups[i].color : '#f8f9fa';
        th.style.color = getContrastColor(departmentGroups[i] ? departmentGroups[i].color : '#f8f9fa');
        thead.appendChild(th);
    }
    
    // -------------------------------------------------------------
    // FILA 1: Cantidad de partidos
    // -------------------------------------------------------------
    const filaCantidad = document.createElement('tr');
    const celdaVariableCantidad = document.createElement('td');
    celdaVariableCantidad.innerHTML = '<a href="#datos-procesamiento" class="variable-link" data-tab="datos">Cantidad de partidos</a>';
    filaCantidad.appendChild(celdaVariableCantidad);
    
    for (let i = 1; i <= currentDivisionCount; i++) {
        const countCell = document.createElement('td');
        const count = departmentGroups[i] ? departmentGroups[i].departments.length : 0;
        countCell.textContent = count;
        filaCantidad.appendChild(countCell);
    }
    tbody.appendChild(filaCantidad);
    
    // -------------------------------------------------------------
    // FILAS DE DATOS (solo si hay datos cargados)
    // -------------------------------------------------------------
    if (partidosData && partidosData.datos) {
        // ----- Superficie total -----
        const filaSuperficie = document.createElement('tr');
        const celdaVariableSuperficie = document.createElement('td');
        celdaVariableSuperficie.innerHTML = '<a href="#datos-superficie" class="variable-link" data-tab="datos">Superficie total (km²)</a>';
        filaSuperficie.appendChild(celdaVariableSuperficie);
        
        for (let i = 1; i <= currentDivisionCount; i++) {
            const superficieCell = document.createElement('td');
            const superficie = calcularTotalDivision(i, 'superficie');
            superficieCell.textContent = formatearNumero(superficie); // sin decimales
            filaSuperficie.appendChild(superficieCell);
        }
        tbody.appendChild(filaSuperficie);
        
        // ----- Población total -----
        const filaPoblacion = document.createElement('tr');
        const celdaVariablePoblacion = document.createElement('td');
        celdaVariablePoblacion.innerHTML = '<a href="#datos-poblacion" class="variable-link" data-tab="datos">Población total</a>';
        filaPoblacion.appendChild(celdaVariablePoblacion);
        
        for (let i = 1; i <= currentDivisionCount; i++) {
            const poblacionCell = document.createElement('td');
            const poblacion = calcularTotalDivision(i, 'poblacion_total');
            poblacionCell.textContent = formatearNumero(poblacion); // sin decimales
            filaPoblacion.appendChild(poblacionCell);
        }
        tbody.appendChild(filaPoblacion);
        
        // ----- Densidad poblacional -----
        const filaDensidad = document.createElement('tr');
        const celdaVariableDensidad = document.createElement('td');
        celdaVariableDensidad.innerHTML = '<a href="#datos-densidad" class="variable-link" data-tab="datos">Densidad (hab/km²)</a>';
        filaDensidad.appendChild(celdaVariableDensidad);
        
        for (let i = 1; i <= currentDivisionCount; i++) {
            const densidadCell = document.createElement('td');
            const densidad = calcularDensidadDivision(i);
            densidadCell.textContent = formatearNumero(densidad, 2); // 2 decimales con coma
            filaDensidad.appendChild(densidadCell);
        }
        tbody.appendChild(filaDensidad);
        
    } else {
        // Mensaje mientras se cargan los datos
        const filaMensaje = document.createElement('tr');
        const celdaMensaje = document.createElement('td');
        celdaMensaje.colSpan = currentDivisionCount + 1;
        celdaMensaje.textContent = 'Cargando datos de superficie y población...';
        celdaMensaje.style.textAlign = 'center';
        celdaMensaje.style.fontStyle = 'italic';
        celdaMensaje.style.color = '#666';
        filaMensaje.appendChild(celdaMensaje);
        tbody.appendChild(filaMensaje);
    }
}

/**
 * CONFIGURA LOS LINKS DE LAS VARIABLES PARA QUE ABRAN LA PESTAÑA "SOBRE LOS DATOS"
 */
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('variable-link')) {
        e.preventDefault();
        if (typeof activateTab === 'function') {
            activateTab('datos');
            // Scroll al ancla correspondiente
            const targetId = e.target.getAttribute('href').substring(1);
            setTimeout(() => {
                const target = document.getElementById(targetId);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        }
    }
});
