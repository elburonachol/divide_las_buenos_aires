/*
 * MÓDULO DE GESTIÓN DE DIVISIONES
 * 
 * Responsabilidades:
 * - Creación y gestión de las cajas de división
 * - Sistema de drag & drop con redimensionamiento dinámico
 * - Ordenación de listas
 * - Actualización de grupos de departamentos
 */

/*
 * NOTA DE ESTILO: no deben usarse emojis en ninguna parte visible para el
 * usuario. Sólo se aceptan en los logs de consola (Herramientas de desarrollador).
 */

// =============================================
// SISTEMA DE DIVISIONES
// =============================================

/**
 * INICIALIZA LAS CAJAS DE DIVISIÓN EN LA INTERFAZ
 * Crea dinámicamente las divisiones según el número especificado
 * @param {number} newCount - Nuevo número de divisiones a mostrar
 */
function initializeDivisionBoxes(newCount) {
    const container = document.getElementById('division-boxes-container');
    
    // Sincronizar el input de número de divisiones
    const divisionInput = document.getElementById('division-count');
    if (divisionInput) {
        divisionInput.value = newCount;
        divisionInput.classList.remove('error');
    }
    
    // Guardar el estado actual antes del cambio para posible restauración
    const previousGroups = JSON.parse(JSON.stringify(departmentGroups));
    
    // Si se reducen las divisiones, procesar las que se eliminarán
    if (newCount < currentDivisionCount) {
        processDivisionReduction(newCount, previousGroups);
    }
    
    // Actualizar contador global
    currentDivisionCount = newCount;
    container.innerHTML = '';
    departmentGroups = {};
    
    // Crear nuevas cajas de división
    for (let i = 1; i <= newCount; i++) {
        const color = divisionColors[i - 1] || '#3388ff';
        const defaultName = `División ${i}`;
        departmentGroups[i] = { 
            color: color, 
            departments: [],
            name: defaultName
        };

        const groupBox = document.createElement('div');
        groupBox.className = 'group-box';
        groupBox.setAttribute('data-group-id', i);
        // Reemplazarla por:
        groupBox.style.borderLeft = `8px solid ${color}`;
        // Generar un tono claro del color para el fondo de la caja
        groupBox.style.background = hexToLightTint(color, 0.85);

        groupBox.innerHTML = `
            <h3 class="editable-division-name" contenteditable="true">${defaultName}</h3>
            <div class="group-list" id="division-${i}"></div>
        `;

        container.appendChild(groupBox);
        
        // Obtener referencia al nombre editable antes de usarla
        const editableName = groupBox.querySelector('.editable-division-name');
        
        // En modo simplificado, los nombres de las divisiones NO son editables
        if (window.isSimplifiedMode) {
            editableName.setAttribute('contenteditable', 'false');
            editableName.style.cursor = 'default';
        } else {
            editableName.addEventListener('blur', function() {
                departmentGroups[i].name = this.textContent;
                updateComparisonTable();
                if (currentRegionType) {
                    document.getElementById('existing-regions').value = '';
                    currentRegionType = null;
                }
            });
            editableName.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
            });
        }
        
        // Restaurar departamentos (PBA o comunas de CABA) si esta división existía antes
        if (previousGroups[i] && previousGroups[i].departments) {
            const divisionList = document.getElementById(`division-${i}`);
            previousGroups[i].departments.forEach(deptName => {
                const element = findDepartmentOrComuna(deptName);
                const isComuna = element && comunasCABA.includes(element);
                const isGBA = element && !isComuna && gbaCodes.includes(element.properties.cde);
                
                const item = document.createElement('div');
                item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
                item.textContent = deptName;
                item.setAttribute('data-dept-name', deptName);
                if (element) item.setAttribute('data-dept-code', element.properties.cde);
                divisionList.appendChild(item);
            });
            // Ordenar alfabéticamente los departamentos en la división
            sortDivisionList(i);
        }
    }

    // Reiniciar sistema de drag & drop con las nuevas divisiones
    initializeDragAndDrop();
    
    // Actualizar todo el estado de la aplicación
    notifyStateChange();
}

/**
 * ORDENA LOS DEPARTAMENTOS EN UNA DIVISIÓN ALFABÉTICAMENTE
 * @param {number} divisionId - ID de la división a ordenar
 */
function sortDivisionList(divisionId) {
    const divisionList = document.getElementById(`division-${divisionId}`);
    if (!divisionList) return;
    
    const items = Array.from(divisionList.querySelectorAll('.department-item'));
    
    // Ordenar por nombre del departamento
    items.sort((a, b) => {
        const nameA = a.getAttribute('data-dept-name').toUpperCase();
        const nameB = b.getAttribute('data-dept-name').toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    // Reconstruir lista ordenada
    divisionList.innerHTML = '';
    items.forEach(item => {
        divisionList.appendChild(item);
    });
}

/**
 * PROCESA LA REDUCCIÓN DE DIVISIONES CUANDO SE DISMINUYE EL NÚMERO
 * Preserva las divisiones superiores y elimina las inferiores
 */
function processDivisionReduction(newCount, previousGroups) {
    // Para cada división que será eliminada (números más altos)
    for (let i = newCount + 1; i <= currentDivisionCount; i++) {
        if (previousGroups[i] && previousGroups[i].departments) {
            // Devolver cada departamento al listado principal
            previousGroups[i].departments.forEach(deptName => {
                returnDepartmentToMainList(deptName);
            });
        }
    }
}

/**
 * ORDENA EL LISTADO PRINCIPAL ALFABÉTICAMENTE
 * Mantiene la lista de departamentos siempre ordenada
 */
function sortMainList() {
    const listContainer = document.getElementById('all-departments-list');
    const items = Array.from(listContainer.querySelectorAll('.department-item'));
    
    // Ordenar por nombre del departamento
    items.sort((a, b) => {
        const nameA = a.getAttribute('data-dept-name').toUpperCase();
        const nameB = b.getAttribute('data-dept-name').toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    // Reconstruir lista ordenada
    listContainer.innerHTML = '';
    items.forEach(item => {
        listContainer.appendChild(item);
    });
}

/**
 * DEVUELVE UN DEPARTAMENTO AL LISTADO PRINCIPAL
 * @param {string} departmentName - Nombre del departamento a devolver
 */
function returnDepartmentToMainList(departmentName) {
    const listContainer = document.getElementById('all-departments-list');
    
    // Recuperar datos completos del departamento o comuna
    const element = findDepartmentOrComuna(departmentName);
    const isComuna = element && comunasCABA.includes(element);
    const isGBA = element && !isComuna && gbaCodes.includes(element.properties.cde);
    
    // Crear elemento para el listado
    const item = document.createElement('div');
    item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
    item.textContent = departmentName;
    item.setAttribute('data-dept-name', departmentName);
    item.setAttribute('data-dept-code', element ? element.properties.cde : '');
    
    listContainer.appendChild(item);
    sortMainList();
}

/**
 * POBLA EL LISTADO PRINCIPAL CON TODOS LOS DEPARTAMENTOS
 * @param {Array} features - Array de features GeoJSON con los departamentos
 */
function populateDepartmentsList(features) {
    const listContainer = document.getElementById('all-departments-list');
    listContainer.innerHTML = '';
    
    features.forEach(feature => {
        const nombre = feature.properties.nam;
        const codigo = feature.properties.cde;
        const isGBA = gbaCodes.includes(codigo);
        
        const item = document.createElement('div');
        item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
        item.textContent = nombre;
        item.setAttribute('data-dept-name', nombre);
        item.setAttribute('data-dept-code', codigo);
        listContainer.appendChild(item);
    });
    
    // Ordenar alfabéticamente después de poblar
    sortMainList();
}

/**
 * ACTUALIZA EL CONTADOR DE DEPARTAMENTOS RESTANTES EN EL LISTADO
 * Muestra cuántos elementos quedan disponibles para asignar
 * y el total de elementos según si comunas están incluidas
 */
function updateRemainingCount() {
    const listContainer = document.getElementById('all-departments-list');
    const remainingCount = listContainer.querySelectorAll('.department-item').length;
    
    // Calcular total: 135 departamentos + 15 comunas si están incluidas
    const totalCount = comunasIncluidas ? 150 : 135;
    
    document.getElementById('dept-remaining-count').textContent = remainingCount;
    document.getElementById('dept-total-count').textContent = totalCount;
}

/**
 * ACTUALIZA LA ESTRUCTURA INTERNA DE GRUPOS DE DEPARTAMENTOS
 * Sincroniza el objeto departmentGroups con el estado actual del DOM
 */
function updateDepartmentGroups() {
    Object.keys(departmentGroups).forEach(groupId => {
        departmentGroups[groupId].departments = [];
        const divisionList = document.getElementById(`division-${groupId}`);
        if (divisionList) {
            const items = divisionList.querySelectorAll('.department-item');
            items.forEach(item => {
                const deptName = item.getAttribute('data-dept-name');
                if (deptName) {
                    departmentGroups[groupId].departments.push(deptName);
                }
            });
        }
    });
}

// =============================================
// SISTEMA DE DRAG & DROP CON REDIMENSIONAMIENTO DINÁMICO
// =============================================

/**
 * INICIALIZA EL SISTEMA DE DRAG & DROP CON SORTABLEJS
 * Configura todas las listas (principal y divisiones) para arrastrar elementos
 * con redimensionamiento dinámico.
 *
 * El grupo de las Sortables es 'departamentos' en TODOS los contenedores
 * (listado principal y cajas de división) para que SortableJS pueda mover
 * elementos entre cualquiera de ellos sin restricciones de nombre.
 */
function initializeDragAndDrop() {
    const allDepartmentsList = document.getElementById('all-departments-list');
    const divisionLists = Array.from({length: currentDivisionCount}, (_, i) => 
        document.getElementById(`division-${i + 1}`)
    );

    // En modo simplificado no se permite arrastrar departamentos
    if (window.isSimplifiedMode) {
        console.log('🔒 Drag & drop deshabilitado en modo simplificado');
        return;
    }

    // Configurar lista principal de departamentos
    Sortable.create(allDepartmentsList, {
        group: {
            name: 'departamentos', // Mismo nombre que las divisiones: permite intercambio libre
            pull: true,
            put: true
        },
        sort: true,
        animation: 150,
        ghostClass: 'dragging',
        dragClass: 'dragging-item',
        onChoose: handleDragChoose,
        onMove: handleDragMove,
        onUnchoose: handleDragUnchoose,
        onAdd: function(evt) {
            // Reordenar automáticamente después de agregar elemento
            setTimeout(() => {
                sortMainList();
            }, 100);
        },
        onEnd: function(evt) {
            handleDragEnd(evt, sortMainList);
        }
    });

    // Configurar cada lista de división
    divisionLists.forEach((divisionList, index) => {
        if (divisionList) {
            Sortable.create(divisionList, {
                group: {
                    name: 'departamentos', // Unificado con el listado principal
                    pull: true,
                    put: true
                },
                animation: 150,
                ghostClass: 'dragging',
                dragClass: 'dragging-item',
                onChoose: handleDragChoose,
                onMove: handleDragMove,
                onUnchoose: handleDragUnchoose,
                onEnd: function(evt) {
                    handleDragEnd(evt, () => sortDivisionList(index + 1));
                }
            });
        }
    });
}

/**
 * HANDLER: INICIO DEL DRAG (onChoose)
 * - Marca el body con la clase .is-dragging para activar los estilos
 *   de drag (hit areas invisibles en cada caja de división).
 * - Si el drag se origina en una caja de división, marca esa caja como
 *   objetivo inicial (la que estaba bajo el cursor al iniciar el drag).
 * @param {Object} evt - Evento de SortableJS
 */
function handleDragChoose(evt) {
    document.body.classList.add('is-dragging');
    
    // Marcar como objetivo la caja de origen (si aplica)
    const fromGroupBox = evt.from.closest('.group-box');
    if (fromGroupBox) {
        fromGroupBox.classList.add('is-drag-target');
    }
}

/**
 * HANDLER: MOVIMIENTO DURANTE EL DRAG (onMove)
 * Detecta por puntero qué caja de división está bajo el cursor y le
 * aplica .is-drag-target (quitándosela a las demás). Si el puntero no
 * está sobre ninguna caja de división, deja todas colapsadas.
 * @param {Object} evt - Evento de SortableJS
 */
function handleDragMove(evt) {
    updateDragTargetFromPointer(evt);
}

/**
 * HANDLER: FIN DEL DRAG SIN DROP (onUnchoose)
 * Limpia las clases de drag y deja todas las cajas colapsadas.
 * @param {Object} evt - Evento de SortableJS
 */
function handleDragUnchoose(evt) {
    document.body.classList.remove('is-dragging');
    collapseAllGroupBoxes();
}

/**
 * HANDLER: FIN DEL DRAG CON DROP (onEnd)
 * Limpia las clases de drag, procesa el movimiento y reordena la lista
 * afectada (listado principal o división).
 * @param {Object} evt - Evento de SortableJS
 * @param {Function} [sortAfter] - Callback para reordenar tras el movimiento
 */
function handleDragEnd(evt, sortAfter) {
    document.body.classList.remove('is-dragging');
    collapseAllGroupBoxes();
    handleDepartmentMove(evt);
    if (typeof sortAfter === 'function') {
        sortAfter();
    }
}

/**
 * ACTUALIZA LA CAJA DE DIVISIÓN OBJETIVO DEL DRAG SEGÚN EL PUNTERO
 * Usa las coordenadas del evento original (clientX/clientY) para
 * encontrar cuál .group-box está bajo el cursor, y le aplica la clase
 * .is-drag-target. Si no hay ninguna bajo el cursor, quita la clase de
 * todas.
 * @param {Object} evt - Evento de SortableJS (con evt.originalEvent)
 */
function updateDragTargetFromPointer(evt) {
    const originalEvent = evt.originalEvent;
    if (!originalEvent) return;
    
    const clientX = originalEvent.clientX;
    const clientY = originalEvent.clientY;
    
    // Buscar la caja de división bajo el puntero
    const allBoxes = document.querySelectorAll('.group-box');
    let targetBox = null;
    
    allBoxes.forEach(box => {
        const rect = box.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
            targetBox = box;
        }
    });
    
    // Actualizar clases: sólo la caja bajo el cursor queda como objetivo
    allBoxes.forEach(box => {
        if (box === targetBox) {
            box.classList.add('is-drag-target');
        } else {
            box.classList.remove('is-drag-target');
        }
    });
}

/**
 * COLAPSA TODAS LAS CAJAS DE DIVISIÓN
 * Remueve la clase .is-drag-target de todas las .group-box.
 * Se llama al terminar el drag o al pasar el puntero fuera de cualquier caja.
 */
function collapseAllGroupBoxes() {
    document.querySelectorAll('.group-box').forEach(box => {
        box.classList.remove('is-drag-target');
    });
}

/**
 * RESTAURA TODAS LAS LISTAS A SU ESTADO NORMAL
 * Limpia clases de drag y expansión. Se conserva como utilidad por si
 * algún flujo externo la invoca (aunque los nuevos handlers ya hacen
 * la limpieza vía handleDragUnchoose / handleDragEnd).
 */
function restoreAllLists() {
    document.body.classList.remove('is-dragging');
    collapseAllGroupBoxes();
    
    // Compatibilidad: remover .compressed/.expanded por si quedaron residuales
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            const groupBox = divisionList.closest('.group-box');
            if (groupBox) {
                groupBox.classList.remove('expanded', 'compressed');
            }
        }
    }
    
    const allDepartmentsList = document.getElementById('all-departments-list');
    if (allDepartmentsList && allDepartmentsList.parentElement) {
        allDepartmentsList.parentElement.classList.remove('compressed', 'expanded');
    }
}

/**
 * MANEJA EL MOVIMIENTO DE DEPARTAMENTOS ENTRE LISTAS
 * Procesa eventos de drag & drop y mueve múltiples departamentos si están seleccionados
 */
function handleDepartmentMove(evt) {
    const draggedItem = evt.item;
    const toElement = evt.to;
    const fromElement = evt.from;

    // Determinar si estamos moviendo un departamento seleccionado
    const hasSelectedDepartments = selectedDepartmentsSet.size > 0;
    const isDraggedItemSelected = draggedItem.classList.contains('selected');

    let departmentsToMove = [];

    // Si el elemento arrastrado está seleccionado Y hay otros seleccionados, mover todos
    if (isDraggedItemSelected && hasSelectedDepartments) {
        departmentsToMove = Array.from(selectedDepartmentsSet);
    } else {
        // Si no, mover solo el departamento arrastrado
        const deptName = draggedItem.getAttribute('data-dept-name');
        departmentsToMove = [deptName];
    }

    // Para cada departamento a mover
    departmentsToMove.forEach(deptName => {
        // Encontrar el elemento en cualquier contenedor
        const element = findDepartmentElement(deptName);
        if (!element) return;

        const currentContainer = element.parentElement;

        // Si el destino es el listado principal
        if (toElement.id === 'all-departments-list') {
            // Mover al listado principal si no está ya allí
            if (currentContainer.id !== 'all-departments-list') {
                toElement.appendChild(element);
            }
            // Asegurar que no esté en ninguna división
            removeDepartmentFromAllDivisions(deptName);
        } 
        // Si el destino es una división
        else {
            // Remover de todas las divisiones (excepto la de destino) y del listado
            removeDepartmentFromAllDivisions(deptName, toElement.id);
            removeDepartmentFromMainList(deptName);
            
            // Mover a la división de destino si no está ya allí
            if (currentContainer.id !== toElement.id) {
                toElement.appendChild(element);
            }
        }
    });

    // Limpiar selección después de mover
    clearAllSelections();

    // Salir del modo región existente si está activo
    if (currentRegionType) {
        document.getElementById('existing-regions').value = '';
        currentRegionType = null;
    }

    // Actualizar todo el estado de la aplicación
    notifyStateChange();
    sortMainList();
}

/**
 * CONVIERTE UN COLOR HEX EN UN TONO MUY CLARO (TINT)
 * @param {string} hex - Color en formato #RRGGBB
 * @param {number} factor - Factor de claridad (0 a 1). 0.85 = muy claro.
 * @returns {string} - Color hex claro
 */
function hexToLightTint(hex, factor) {
    // Eliminar # si existe
    hex = hex.replace('#', '');
    
    // Convertir a RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Mezclar con blanco
    const newR = Math.round(r + (255 - r) * factor);
    const newG = Math.round(g + (255 - g) * factor);
    const newB = Math.round(b + (255 - b) * factor);
    
    // Convertir de vuelta a hex
    return '#' + [newR, newG, newB].map(c => {
        const hexStr = c.toString(16);
        return hexStr.length === 1 ? '0' + hexStr : hexStr;
    }).join('');
}
