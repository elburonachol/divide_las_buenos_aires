/*
 * MÓDULO DE TABLA COMPARATIVA
 * 
 * Responsabilidades:
 * - Inicialización y actualización de la tabla comparativa
 * - Ordenamiento de divisiones por variable (ascendente / descendente)
 * - Alternancia PBG total / PBG per cápita
 * - Alternancia método de diputados: cantidad actual / Decreto-ley 22847
 * - Inclusión opcional de otras provincias argentinas
 */

// =============================================
// ESTADO DE LA TABLA
// =============================================

let tablaSortColumn = null;        // Columna activa de ordenamiento (o null)
let tablaSortDirection = 'asc';    // 'asc' o 'desc'
let pbgPerCapita = false;          // ¿Mostrar PBG per cápita en lugar de total?
let diputadosMethod = 'actual';    // 'actual' o 'decreto'
let includeOtherProvinces = false; // ¿Incluir filas de otras provincias?

// =============================================
// INICIALIZACIÓN
// =============================================

/**
 * INICIALIZA LA ESTRUCTURA DE LA TABLA COMPARATIVA
 * Inserta el toggle "Incluir otras provincias" y configura los eventos.
 */
function initializeComparisonTable() {
    setupProvincesToggle();
    setupComparisonTableEvents();
    updateComparisonTable();
}

/**
 * INSERTA EL TOGGLE "Incluir otras provincias" ARRIBA DE LA TABLA
 */
function setupProvincesToggle() {
    if (document.getElementById('toggle-include-provinces')) return;
    
    const section = document.querySelector('.comparison-section');
    if (!section) return;
    
    const controls = document.createElement('div');
    controls.className = 'comparison-controls';
    controls.style.marginBottom = '12px';
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'toggle-include-provinces';
    btn.textContent = 'Incluir otras provincias';
    btn.style.cssText = `
        padding: 6px 14px;
        border-radius: 16px;
        border: 1px solid #aaa;
        background: #e0e0e0;
        color: #333;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.2s, color 0.2s;
    `;
    btn.addEventListener('click', function() {
        includeOtherProvinces = !includeOtherProvinces;
        if (includeOtherProvinces) {
            this.style.background = '#4a90d9';
            this.style.color = '#fff';
            this.style.borderColor = '#4a90d9';
        } else {
            this.style.background = '#e0e0e0';
            this.style.color = '#333';
            this.style.borderColor = '#aaa';
        }
        updateComparisonTable();
    });
    
    controls.appendChild(btn);
    
    const tableContainer = section.querySelector('.table-container');
    section.insertBefore(controls, tableContainer);
}

/**
 * CONFIGURA LOS EVENTOS DELEGADOS DE LA TABLA
 * Evita agregar múltiples listeners si la función se llama más de una vez.
 */
function setupComparisonTableEvents() {
    if (window.__comparisonTableEventsSetup) return;
    window.__comparisonTableEventsSetup = true;
    
    document.addEventListener('click', function(e) {
        // 1) Links a "Sobre los datos" (tienen su propio handler)
        if (e.target.closest('.variable-link')) return;
        
        // 2) Toggle PBG per cápita
        if (e.target.closest('.th-toggle-pbg')) {
            pbgPerCapita = !pbgPerCapita;
            updateComparisonTable();
            return;
        }
        
        // 3) Toggle método de diputados
        if (e.target.closest('.th-toggle-diputados')) {
            diputadosMethod = (diputadosMethod === 'actual') ? 'decreto' : 'actual';
            updateComparisonTable();
            return;
        }
        
        // 4) Click en header ordenable
        const th = e.target.closest('.th-sortable');
        if (th) {
            const col = th.getAttribute('data-sort-column');
            if (col) handleSort(col);
        }
    });
}

/**
 * ALTERNA EL ORDENAMIENTO DE UNA COLUMNA
 */
function handleSort(column) {
    if (tablaSortColumn === column) {
        tablaSortDirection = (tablaSortDirection === 'asc') ? 'desc' : 'asc';
    } else {
        tablaSortColumn = column;
        tablaSortDirection = 'asc';
    }
    updateComparisonTable();
}

// =============================================
// HELPERS DE RENDER
// =============================================

/**
 * CALCULA EL COLOR DE CONTRASTE PARA TEXTO SEGÚN FONDO
 */
function getContrastColor(hexColor) {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * DEVUELVE EL ÍCONO DE ORDEN ACTUAL PARA UNA COLUMNA
 */
function getSortArrow(column) {
    if (tablaSortColumn !== column) return '';
    return tablaSortDirection === 'asc' ? ' ▲' : ' ▼';
}

/**
 * CREA UNA CELDA DE HEADER ORDENABLE ESTÁNDAR
 */
function createHeaderCell(label, column, docAnchor, options) {
    options = options || {};
    const th = document.createElement('th');
    th.className = 'th-sortable';
    th.setAttribute('data-sort-column', column);
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    if (options.minWidth) th.style.minWidth = options.minWidth;
    
    const arrow = getSortArrow(column);
    const infoIcon = docAnchor
        ? ` <a href="#${docAnchor}" class="variable-link" data-tab="datos" title="Más información"
              style="text-decoration:none; color:#3388ff; font-size:12px;">ⓘ</a>`
        : '';
    
    th.innerHTML = `<span>${label}</span>${infoIcon}<span class="sort-arrow">${arrow}</span>`;
    return th;
}

/**
 * CREA LA CELDA DE HEADER DE PBG (con toggle total / per cápita)
 */
function createPbgHeaderCell() {
    const th = document.createElement('th');
    th.className = 'th-sortable';
    th.setAttribute('data-sort-column', 'pbg');
    th.style.cssText = 'cursor:pointer; user-select:none; min-width:170px;';
    
    const arrow = getSortArrow('pbg');
    const toggleLabel = pbgPerCapita ? 'Per cápita' : 'Total';
    const toggleTitle = pbgPerCapita
        ? 'Cambiar a PBG total'
        : 'Cambiar a PBG per cápita';
    
    th.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
            <span>Producto Bruto Geográfico
                <a href="#datos-pbg" class="variable-link" data-tab="datos" title="Más información"
                   style="text-decoration:none; color:#3388ff; font-size:12px;">ⓘ</a>
                <span class="sort-arrow">${arrow}</span>
            </span>
            <button type="button" class="th-toggle-pbg" title="${toggleTitle}"
                style="font-size:11px; padding:2px 10px; border-radius:10px;
                       border:1px solid #aaa; background:#e0e0e0; cursor:pointer; color:#333;">
                ${toggleLabel}
            </button>
        </div>
    `;
    return th;
}

/**
 * CREA LA CELDA DE HEADER DE DIPUTADOS (con toggle cantidad actual / decreto-ley)
 */
function createDiputadosHeaderCell() {
    const th = document.createElement('th');
    th.className = 'th-sortable';
    th.setAttribute('data-sort-column', 'diputados');
    th.style.cssText = 'cursor:pointer; user-select:none; min-width:180px;';
    
    const arrow = getSortArrow('diputados');
    const toggleLabel = diputadosMethod === 'actual'
        ? 'Cantidad actual'
        : 'Decreto-ley 22847';
    const toggleTitle = diputadosMethod === 'actual'
        ? 'Cambiar a método Decreto-ley 22847'
        : 'Cambiar a método de cantidad actual';
    
    th.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
            <span>Diputados nacionales
                <a href="#datos-diputados" class="variable-link" data-tab="datos" title="Más información"
                   style="text-decoration:none; color:#3388ff; font-size:12px;">ⓘ</a>
                <span class="sort-arrow">${arrow}</span>
            </span>
            <button type="button" class="th-toggle-diputados" title="${toggleTitle}"
                style="font-size:11px; padding:2px 10px; border-radius:10px;
                       border:1px solid #aaa; background:#e0e0e0; cursor:pointer; color:#333;">
                ${toggleLabel}
            </button>
        </div>
    `;
    return th;
}

/**
 * CREA UNA CELDA DE DATO NUMÉRICO
 */
function createValueCell(value, decimals) {
    const td = document.createElement('td');
    td.style.textAlign = 'right';
    if (value === '—' || value === null || value === undefined) {
        td.textContent = '—';
        td.style.textAlign = 'center';
        td.style.color = '#999';
    } else if (typeof value === 'number') {
        td.textContent = formatearNumero(value, decimals);
    } else {
        td.textContent = value;
    }
    return td;
}

/**
 * CREA UNA FILA COMPLETA DE DATOS
 */
function createDataRow(row) {
    const tr = document.createElement('tr');
    
    // Columna 1: nombre de la división / provincia
    const tdName = document.createElement('td');
    tdName.textContent = row.name;
    tdName.style.fontWeight = '600';
    if (row.type === 'division') {
        tdName.style.backgroundColor = row.color;
        tdName.style.color = getContrastColor(row.color);
    } else {
        tdName.style.backgroundColor = '#f0f0f0';
        tdName.style.fontStyle = 'italic';
    }
    tr.appendChild(tdName);
    
    // Cantidad de partidos
    tr.appendChild(createValueCell(row.values.cantidad));
    // Superficie total
    tr.appendChild(createValueCell(row.values.superficie));
    // Población total
    tr.appendChild(createValueCell(row.values.poblacion_total));
    // Densidad (2 decimales)
    tr.appendChild(createValueCell(row.values.densidad, 2));
    // PBG (total o per cápita)
    if (pbgPerCapita) {
        tr.appendChild(createValueCell(row.values.pbg_percapita, 2));
    } else {
        tr.appendChild(createValueCell(row.values.pbg));
    }
    // Diputados nacionales
    tr.appendChild(createValueCell(row.values.diputados));
    // Posibles capitales (placeholder)
    const tdCap = document.createElement('td');
    tdCap.textContent = row.values.capitales;
    tdCap.style.fontSize = '12px';
    tdCap.style.textAlign = 'center';
    if (row.values.capitales === '—') tdCap.style.color = '#999';
    tr.appendChild(tdCap);
    
    return tr;
}

// =============================================
// ACTUALIZACIÓN DE LA TABLA
// =============================================

/**
 * ACTUALIZA LA TABLA COMPARATIVA CON LOS DATOS ACTUALES
 * Filas: divisiones (y provincias si el toggle está activo)
 * Columnas: variables
 */
function updateComparisonTable() {
    const table = document.getElementById('comparison-table');
    if (!table) return;
    
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    // -------- HEADER --------
    const headerRow = document.createElement('tr');
    
    const thName = document.createElement('th');
    thName.textContent = 'División';
    thName.style.minWidth = '150px';
    headerRow.appendChild(thName);
    
    headerRow.appendChild(createHeaderCell('Cantidad de partidos', 'cantidad', 'datos-procesamiento'));
    headerRow.appendChild(createHeaderCell('Superficie total (km²)', 'superficie', 'datos-superficie'));
    headerRow.appendChild(createHeaderCell('Población total', 'poblacion_total', 'datos-poblacion'));
    headerRow.appendChild(createHeaderCell('Densidad (hab/km²)', 'densidad', 'datos-densidad'));
    headerRow.appendChild(createPbgHeaderCell());
    headerRow.appendChild(createDiputadosHeaderCell());
    
    const thCap = document.createElement('th');
    thCap.textContent = 'Posibles capitales';
    thCap.style.minWidth = '180px';
    thCap.style.textAlign = 'center';
    headerRow.appendChild(thCap);
    
    thead.appendChild(headerRow);
    
    // -------- DATOS --------
    if (!partidosData || !partidosData.datos) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 8;
        td.textContent = 'Cargando datos de superficie y población...';
        td.style.textAlign = 'center';
        td.style.fontStyle = 'italic';
        td.style.color = '#666';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }
    
    // Calcular diputados para todas las divisiones (según el método activo)
    const diputadosMap = calcularDiputadosTodasDivisiones(diputadosMethod);
    
    // Construir array de filas
    const rows = [];
    for (let i = 1; i <= currentDivisionCount; i++) {
        rows.push({
            type: 'division',
            id: i,
            name: departmentGroups[i] ? departmentGroups[i].name : `División ${i}`,
            color: departmentGroups[i] ? departmentGroups[i].color : '#f8f9fa',
            values: {
                cantidad: departmentGroups[i] ? departmentGroups[i].departments.length : 0,
                superficie: calcularTotalDivision(i, 'superficie'),
                poblacion_total: calcularTotalDivision(i, 'poblacion_total'),
                densidad: calcularDensidadDivision(i),
                pbg: calcularTotalDivision(i, 'pbg'),
                pbg_percapita: calcularPbgPerCapitaDivision(i),
                diputados: (diputadosMap[i] !== undefined) ? diputadosMap[i] : 0,
                capitales: '—'  // Placeholder: se completará cuando existan los datos
            }
        });
    }
    
    // Filas de otras provincias (si corresponde)
    if (includeOtherProvinces) {
        const provincias = getProvinciasArgentinas();
        provincias.forEach(nombre => {
            const datos = (datosProvincias && datosProvincias.datos && datosProvincias.datos[nombre]) || null;
            rows.push({
                type: 'province',
                name: nombre,
                values: {
                    cantidad: '—',
                    superficie: datos ? datos.superficie : '—',
                    poblacion_total: datos ? datos.poblacion_total : '—',
                    densidad: (datos && datos.superficie > 0)
                        ? datos.poblacion_total / datos.superficie
                        : '—',
                    pbg: datos ? datos.pbg : '—',
                    pbg_percapita: (datos && datos.poblacion_total > 0 && datos.pbg)
                        ? datos.pbg / datos.poblacion_total
                        : '—',
                    diputados: '—',
                    capitales: '—'
                }
            });
        });
    }
    
    // Ordenar filas según el estado de ordenamiento
    if (tablaSortColumn) {
        rows.sort((a, b) => {
            const va = getRowValueForSort(a, tablaSortColumn);
            const vb = getRowValueForSort(b, tablaSortColumn);
            
            const aNum = typeof va === 'number' && !isNaN(va);
            const bNum = typeof vb === 'number' && !isNaN(vb);
            if (!aNum && !bNum) return 0;
            if (!aNum) return 1;   // Valores no numéricos van al final
            if (!bNum) return -1;
            
            return tablaSortDirection === 'asc' ? va - vb : vb - va;
        });
    }
    
    // Renderizar filas ordenadas
    rows.forEach(row => tbody.appendChild(createDataRow(row)));
}

/**
 * OBTIENE EL VALOR DE UNA FILA PARA LA COLUMNA DE ORDEN
 * Tiene en cuenta el toggle de PBG per cápita.
 */
function getRowValueForSort(row, column) {
    if (column === 'pbg' && pbgPerCapita) {
        return row.values.pbg_percapita;
    }
    return row.values[column];
}

// =============================================
// LINKS DE VARIABLES → PESTAÑA "SOBRE LOS DATOS"
// =============================================

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('variable-link')) {
        e.preventDefault();
        if (typeof activateTab === 'function') {
            activateTab('datos');
            const targetId = e.target.getAttribute('href').substring(1);
            setTimeout(() => {
                const target = document.getElementById(targetId);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        }
    }
});
