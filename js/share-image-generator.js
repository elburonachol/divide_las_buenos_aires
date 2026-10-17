/*
 * MÓDULO DE GENERACIÓN DE IMÁGENES PARA COMPARTIR
 * 
 * Responsabilidades:
 * - Generación del mapa compuesto (PBA + inset GBA/CABA + rectángulo + líneas)
 * - Generación de la tabla comparativa como imagen
 *
 * DEPENDENCIAS:
 * - share-utils.js (constantes, mmToPx, mercatorToLatLng, sanitizeFilename)
 * - html2canvas
 * - Leaflet
 * - data-manager.js (allDepartments, comunasCABA, departmentGroups, getDepartmentGroupId)
 *
 * ORDEN DE CARGA: después de share-utils.js y data-manager.js.
 */

// =============================================
// CONSTANTES
// =============================================

/**
 * Provincias que NO se incluyen en la imagen descargable de la tabla.
 * PBA y CABA se conservan como referencia comparativa.
 */
const OTRAS_PROVINCIAS = [
    'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
    'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
    'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
    'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

// =============================================
// GENERACIÓN DEL MAPA
// =============================================

/**
 * CREA EL MAPA COMPUESTO (PBA + INSET GBA/CABA)
 * - Mapa grande: todo PBA (y comunas si están incluidas) coloreado.
 * - Inset: zoom del AMBA, también coloreado.
 * - Rectángulo y dos líneas verticales en negro, dibujados SOBRE el canvas.
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateMapImage() {
    console.log('🗺️ Generando imagen del mapa...');

    // Contenedor principal (fuera de pantalla)
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        left: -99999px;
        top: 0;
        width: ${SHARE_IMG_WIDTH_PX}px;
        height: ${SHARE_IMG_HEIGHT_PX}px;
        background: white;
        z-index: 1;
    `;
    document.body.appendChild(container);

    // -------- MAPA PRINCIPAL --------
    const mainMapDiv = document.createElement('div');
    mainMapDiv.style.cssText = `
        position: absolute;
        left: 0; top: 0;
        width: ${SHARE_IMG_WIDTH_PX}px;
        height: ${SHARE_IMG_HEIGHT_PX}px;
        z-index: 1;
    `;
    container.appendChild(mainMapDiv);

    const mainMap = L.map(mainMapDiv, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        zoomSnap: 0,
        zoomDelta: 0.1,
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false,
        animate: false
    });

    const mainSW = mercatorToLatLng(MAIN_MAP_BOUNDS.west, MAIN_MAP_BOUNDS.south);
    const mainNE = mercatorToLatLng(MAIN_MAP_BOUNDS.east, MAIN_MAP_BOUNDS.north);
    const mainBounds = L.latLngBounds(mainSW, mainNE);
    mainMap.fitBounds(mainBounds, { animate: false, padding: [0, 0] });

    L.tileLayer(IGN_TILE_URL, { crossOrigin: true, maxZoom: 18 }).addTo(mainMap);

    // Estilo común para PBA
    const mainPbaStyle = (feature) => {
        const deptName = feature.properties.nam;
        const groupId = getDepartmentGroupId(deptName);
        if (groupId) {
            return {
                fillColor: departmentGroups[groupId].color,
                fillOpacity: 0.8,
                color: 'transparent',
                weight: 0
            };
        }
        return { fillOpacity: 0, color: '#ccc', weight: 0.3 };
    };

    L.geoJSON(allDepartments, {
        style: mainPbaStyle,
        interactive: false,
        renderer: L.canvas({ padding: 0.5 })
    }).addTo(mainMap);

    // Comunas de CABA: se agregan si el usuario las incluyó
    if (typeof comunasIncluidas !== 'undefined' && comunasIncluidas
        && typeof comunasCABA !== 'undefined' && comunasCABA.length > 0) {
        const mainComunaStyle = (feature) => {
            const comunaName = feature.properties.nam;
            const groupId = getDepartmentGroupId(comunaName);
            if (groupId) {
                return {
                    fillColor: departmentGroups[groupId].color,
                    fillOpacity: 0.8,
                    color: 'transparent',
                    weight: 0
                };
            }
            return { fillOpacity: 0, color: '#ccc', weight: 0.3 };
        };
        L.geoJSON(comunasCABA, {
            style: mainComunaStyle,
            interactive: false,
            renderer: L.canvas({ padding: 0.5 })
        }).addTo(mainMap);
    }

    // -------- INSET (mapa pequeño) --------
    const insetDiv = document.createElement('div');
    insetDiv.style.cssText = `
        position: absolute;
        left: ${mmToPx(INSET_POS.left)}px;
        top: ${mmToPx(INSET_POS.top)}px;
        width: ${mmToPx(INSET_POS.width)}px;
        height: ${mmToPx(INSET_POS.height)}px;
        border: 2px solid #333;
        box-sizing: border-box;
        z-index: 999999;
        background: white;
    `;
    container.appendChild(insetDiv);

    const insetMap = L.map(insetDiv, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        zoomSnap: 0,
        zoomDelta: 0.1,
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false,
        animate: false
    });

    const insetSW = mercatorToLatLng(INSET_MAP_BOUNDS.west, INSET_MAP_BOUNDS.south);
    const insetNE = mercatorToLatLng(INSET_MAP_BOUNDS.east, INSET_MAP_BOUNDS.north);
    const insetBounds = L.latLngBounds(insetSW, insetNE);
    insetMap.fitBounds(insetBounds, { animate: false, padding: [0, 0] });

    L.tileLayer(IGN_TILE_URL, { crossOrigin: true, maxZoom: 18 }).addTo(insetMap);

    const insetPbaStyle = (feature) => {
        const deptName = feature.properties.nam;
        const groupId = getDepartmentGroupId(deptName);
        if (groupId) {
            return {
                fillColor: departmentGroups[groupId].color,
                fillOpacity: 0.85,
                color: 'transparent',
                weight: 0
            };
        }
        return { fillOpacity: 0, color: '#999', weight: 0.2 };
    };

    L.geoJSON(allDepartments, {
        style: insetPbaStyle,
        interactive: false,
        renderer: L.canvas({ padding: 0.5 })
    }).addTo(insetMap);

    if (typeof comunasIncluidas !== 'undefined' && comunasIncluidas
        && typeof comunasCABA !== 'undefined' && comunasCABA.length > 0) {
        const insetComunaStyle = (feature) => {
            const comunaName = feature.properties.nam;
            const groupId = getDepartmentGroupId(comunaName);
            if (groupId) {
                return {
                    fillColor: departmentGroups[groupId].color,
                    fillOpacity: 0.85,
                    color: 'transparent',
                    weight: 0
                };
            }
            return { fillOpacity: 0, color: '#999', weight: 0.2 };
        };
        L.geoJSON(comunasCABA, {
            style: insetComunaStyle,
            interactive: false,
            renderer: L.canvas({ padding: 0.5 })
        }).addTo(insetMap);
    }

    // Forzar recálculo de tamaño (crítico para el inset)
    setTimeout(() => {
        mainMap.invalidateSize();
        insetMap.invalidateSize();
    }, 300);

    // Esperar carga de tiles + render de canvas
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Capturar
    console.log('📸 Capturando imagen...');
    const canvas = await html2canvas(container, {
        width: SHARE_IMG_WIDTH_PX,
        height: SHARE_IMG_HEIGHT_PX,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 1,
        logging: false
    });

    // Dibujar rectángulo y líneas SOBRE el canvas capturado.
    // Se usa setTransform para asegurarse de que no haya transformaciones
    // residuales, y pxPerMm derivado del canvas real (robusto a cambios de escala).
    const ctx = canvas.getContext('2d');
    const pxPerMm = canvas.width / SHARE_IMG_WIDTH_MM;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Rectángulo (borde negro 0.6mm)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 * pxPerMm;
    ctx.beginPath();
    ctx.rect(
        RECT_POS.left * pxPerMm,
        RECT_POS.top * pxPerMm,
        RECT_POS.width * pxPerMm,
        RECT_POS.height * pxPerMm
    );
    ctx.stroke();

    // Línea 1 (borde negro 0.4mm)
    ctx.lineWidth = 0.4 * pxPerMm;
    ctx.beginPath();
    ctx.moveTo(LINE1_POS.left * pxPerMm, LINE1_POS.top * pxPerMm);
    ctx.lineTo(LINE1_POS.left * pxPerMm, (LINE1_POS.top + LINE1_POS.height) * pxPerMm);
    ctx.stroke();

    // Línea 2 (borde negro 0.4mm)
    ctx.beginPath();
    ctx.moveTo(LINE2_POS.left * pxPerMm, LINE2_POS.top * pxPerMm);
    ctx.lineTo(LINE2_POS.left * pxPerMm, (LINE2_POS.top + LINE2_POS.height) * pxPerMm);
    ctx.stroke();

    ctx.restore();

    // Limpiar
    mainMap.remove();
    insetMap.remove();
    document.body.removeChild(container);

    console.log('✅ Imagen del mapa generada');
    return canvas;
}

// =============================================
// GENERACIÓN DE LA TABLA
// =============================================

/**
 * GENERA LA IMAGEN DE LA TABLA COMPARATIVA
 * - Preserva el estado actual de la tabla (orden, modo PBG, modo diputados).
 * - Elimina las filas de "otras provincias" pero conserva PBA y CABA.
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateTableImage() {
    const originalTable = document.getElementById('comparison-table');
    if (!originalTable) throw new Error('No se encontró la tabla comparativa');

    const clone = originalTable.cloneNode(true);
    const tbody = clone.querySelector('tbody');

    if (tbody) {
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.forEach(row => {
            const firstCell = row.querySelector('td');
            if (!firstCell) return;
            const text = firstCell.textContent.trim();
            if (OTRAS_PROVINCIAS.some(p => text.includes(p))) {
                row.remove();
            }
        });
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        position: fixed;
        left: -99999px;
        top: 0;
        background: white;
        padding: 20px;
    `;
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const canvas = await html2canvas(wrapper, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
    });

    document.body.removeChild(wrapper);
    return canvas;
}

// =============================================
// EXPOSICIÓN GLOBAL
// =============================================

window.generateMapImage = generateMapImage;
window.generateTableImage = generateTableImage;

console.log('✅ Generador de imágenes de compartir inicializado');
