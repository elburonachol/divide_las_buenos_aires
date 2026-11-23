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
    
    // Limpiar estados visuales residuales antes de recrear las cajas
    document.body.classList.remove('is-dragging');
    collapseAllGroupBoxes();
    
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
        groupBox.style.borderLeft = `8px solid ${color}`;
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
 * Configura todas las listas (principal y divisiones) para arrastrar elementos.
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

    // Evitar agregar más de una instancia de Sortable al listado principal
    const existingMainSortable = Sortable.get(allDepartmentsList);
    if (existingMainSortable) {
        existingMainSortable.destroy();
    }

    // Seguir el puntero durante un arrastre real para expandir sólo
    // la caja de división que está bajo el cursor.
    if (!window.divisionDragPointerListenerInitialized) {
        document.addEventListener('pointermove', updateDragTargetFromPointer);
        window.divisionDragPointerListenerInitialized = true;
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
        onStart: handleDragStart,
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
                onStart: handleDragStart,
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
 * HANDLER: INICIO DEL DRAG REAL (onStart)
 * Se activa una vez que comenzó el movimiento de arrastre, no al hacer
 * simplemente click sobre un departamento.
 * @param {Object} evt - Evento de SortableJS
 */
function handleDragStart(evt) {
    document.body.classList.add('is-dragging');
    updateDragTargetFromPointer(evt);
}

/**
 * HANDLER: MOVIMIENTO DURANTE EL DRAG (onMove)
 * Actualiza la caja de división que está bajo el cursor.
 * @param {Object} evt - Evento de SortableJS
 */
function handleDragMove(evt) {
    updateDragTargetFromPointer(evt);
}

/**
 * HANDLER: FIN DEL DRAG (onUnchoose)
 * Limpia las clases temporales de arrastre.
 * @param {Object} evt - Evento de SortableJS
 */
function handleDragUnchoose(evt) {
    document.body.classList.remove('is-dragging');
    clearDivisionDragTargetTimer();
    collapseAllGroupBoxes();
}

/**
 * HANDLER: FIN DEL DRAG CON DROP (onEnd)
 * Antes de limpiar las clases, resuelve la caja bajo el puntero como destino
 * explícito. Esto permite soltar sobre el área de destino aunque SortableJS
 * no haya detectado la lista comprimida durante su propio hit testing.
 * @param {Object} evt - Evento de SortableJS
 * @param {Function} [sortAfter] - Callback para reordenar tras el movimiento
 */
function handleDragEnd(evt, sortAfter) {
    const pointerPosition = getDragPointerPosition(evt);
    let targetBox = null;

    if (pointerPosition) {
        targetBox = getGroupBoxAtPointer(
            pointerPosition.clientX,
            pointerPosition.clientY
        );
    }

    // Si el evento final no incluye coordenadas, conservar el último objetivo
    if (!targetBox) {
        targetBox = document.querySelector('.group-box.is-drag-target');
    }

    document.body.classList.remove('is-dragging');
    clearDivisionDragTargetTimer();
    collapseAllGroupBoxes();

    // Si el puntero terminó sobre una caja, usar su lista como destino real
    const destinationList = targetBox
        ? targetBox.querySelector('.group-list')
        : null;

    if (destinationList) {
        handleDepartmentMove({
            ...evt,
            to: destinationList
        });
    } else {
        handleDepartmentMove(evt);
    }

    if (typeof sortAfter === 'function') {
        sortAfter();
    }
}

/**
 * OBTIENE LAS COORDENADAS DEL PUNTERO
 * Acepta eventos de SortableJS, PointerEvent y eventos táctiles.
 * @param {Object} evt - Evento de SortableJS o evento del puntero
 * @returns {Object|null} - Coordenadas clientX/clientY o null
 */
function getDragPointerPosition(evt) {
    const pointerEvent = evt && (evt.originalEvent || evt);
    if (!pointerEvent) return null;

    const touch = pointerEvent.changedTouches && pointerEvent.changedTouches[0]
        ? pointerEvent.changedTouches[0]
        : pointerEvent.touches && pointerEvent.touches[0]
            ? pointerEvent.touches[0]
            : null;

    const position = touch || pointerEvent;

    if (typeof position.clientX !== 'number' ||
        typeof position.clientY !== 'number') {
        return null;
    }

    return {
        clientX: position.clientX,
        clientY: position.clientY
    };
}

/**
 * BUSCA LA CAJA DE DIVISIÓN BAJO LAS COORDENADAS DEL PUNTERO
 * @param {number} clientX - Coordenada horizontal del puntero
 * @param {number} clientY - Coordenada vertical del puntero
 * @returns {HTMLElement|null} - Caja bajo el puntero o null
 */
function getGroupBoxAtPointer(clientX, clientY) {
    const allBoxes = document.querySelectorAll('.group-box');

    for (const box of allBoxes) {
        const rect = box.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
            return box;
        }
    }

    return null;
}

/**
 * ACTUALIZA LA CAJA DE DIVISIÓN OBJETIVO DEL DRAG SEGÚN EL PUNTERO
 * Al entrar en una caja, crea un área de destino de 40 px. Si el puntero
 * permanece allí, expande la lista después de 0.4 segundos.
 * @param {Object} evt - Evento de SortableJS o PointerEvent
 */
function updateDragTargetFromPointer(evt) {
    if (!document.body.classList.contains('is-dragging')) return;

    const pointerPosition = getDragPointerPosition(evt);
    if (!pointerPosition) return;

    const targetBox = getGroupBoxAtPointer(
        pointerPosition.clientX,
        pointerPosition.clientY
    );
    const currentTarget = document.querySelector('.group-box.is-drag-target');

    // Si no cambió la caja objetivo, no reiniciar el retardo
    if (targetBox === currentTarget) return;

    clearDivisionDragTargetTimer();
    collapseAllGroupBoxes();

    if (!targetBox) return;

    targetBox.classList.add('is-drag-target');

    // Expandir la lista si el puntero permanece sobre esta caja
    window.divisionDragTargetTimer = setTimeout(() => {
        if (document.body.classList.contains('is-dragging') &&
            targetBox.classList.contains('is-drag-target')) {
            targetBox.classList.add('is-drag-target-expanded');
        }
    }, 400);
}

/**
 * LIMPIA EL RETARDO PENDIENTE DE EXPANSIÓN DEL OBJETIVO
 */
function clearDivisionDragTargetTimer() {
    if (window.divisionDragTargetTimer) {
        clearTimeout(window.divisionDragTargetTimer);
        window.divisionDragTargetTimer = null;
    }
}

/**
 * COLAPSA TODAS LAS CAJAS DE DIVISIÓN
 * Remueve las clases temporales de objetivo y expansión.
 */
function collapseAllGroupBoxes() {
    document.querySelectorAll('.group-box').forEach(box => {
        box.classList.remove('is-drag-target', 'is-drag-target-expanded');
    });
}

/**
 * RESTAURA TODAS LAS LISTAS A SU ESTADO NORMAL
 * Limpia clases de drag y expansión. Se conserva como utilidad por si
 * algún flujo externo la invoca.
 */
function restoreAllLists() {
    document.body.classList.remove('is-dragging');
    clearDivisionDragTargetTimer();
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

    if (!draggedItem || !toElement) return;

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

    // Ordenar el destino alfabéticamente
    if (toElement.id === 'all-departments-list') {
        sortMainList();
    } else if (toElement.id.startsWith('division-')) {
        const destinationDivisionId = parseInt(toElement.id.replace('division-', ''), 10);
        if (!Number.isNaN(destinationDivisionId)) {
            sortDivisionList(destinationDivisionId);
        }
    }
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
