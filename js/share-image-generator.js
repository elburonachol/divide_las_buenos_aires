/*
 * MÓDULO DE GENERACIÓN DE IMÁGENES PARA COMPARTIR
 * 
 * Responsabilidades:
 * - Generación del mapa compuesto (PBA + inset GBA/CABA + rectángulo + líneas)
 * - Generación de la tabla comparativa como imagen
 * - Pre-generación en segundo plano (prefetch) del mapa
 * - Caché del mapa generado para reutilizarlo en el modal de compartir
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

/**
 * Grosor del borde GBA en milímetros sobre la imagen final (210mm de ancho).
 * En píxeles: 0.3 mm × SHARE_IMG_PX_PER_MM.
 */
const GBA_BORDER_MM = 0.3;

/**
 * Milisegundos de espera máxima para que carguen los tiles del IGN
 * antes de capturar el canvas. Si la red está lenta, se captura igual.
 */
const TIMEOUT_TILES_MS = 5000;

// =============================================
// CACHÉ DEL MAPA (PREFETCH)
// =============================================
// 
// El mapa tarda varios segundos en generarse (por la espera de tiles).
// Para mejorar la UX, exponemos `preGenerateMapImage()` que arranca la
// generación en segundo plano. Cuando el usuario llega al modal de
// compartir, `generateMapImage()` reutiliza el resultado cacheado.
// 
// El caché se invalida cuando:
//   - La propuesta cambia (vía invalidateMapImageCache() desde notifyStateChange)
//   - La generación falla
// =============================================

let _cachedMapImagePromise = null;

/**
 * INVALIDA EL CACHÉ DEL MAPA
 * Debe llamarse cuando la propuesta del usuario cambia (drag&drop,
 * cambio de cantidad de divisiones, etc.) para evitar usar una imagen
 * desactualizada.
 */
function invalidateMapImageCache() {
    _cachedMapImagePromise = null;
}

/**
 * ARRANCA LA GENERACIÓN DEL MAPA EN SEGUNDO PLANO
 * Si ya hay un caché válido, no hace nada.
 * @returns {Promise<HTMLCanvasElement>|null}
 */
function preGenerateMapImage() {
    if (_cachedMapImagePromise) return _cachedMapImagePromise;
    
    console.log('🚀 Pre-generando mapa en segundo plano...');
    _cachedMapImagePromise = _generateMapImageInternal().catch(err => {
        console.error('❌ Error pre-generando mapa:', err);
        _cachedMapImagePromise = null;
        throw err;
    });
    return _cachedMapImagePromise;
}

/**
 * GENERA (O REUTILIZA) LA IMAGEN DEL MAPA
 * API pública. Si hay una promesa cacheada, la reutiliza.
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateMapImage() {
    if (_cachedMapImagePromise) {
        try {
            return await _cachedMapImagePromise;
        } catch (e) {
            _cachedMapImagePromise = null;
        }
    }
    return await _generateMapImageInternal();
}

// =============================================
// GENERACIÓN DEL MAPA (INTERNA)
// =============================================

/**
 * ESPERA ACTIVA HASTA QUE CARGUEN LOS TILES O SE AGOTE EL TIMEOUT
 * Usa un enfoque de sondeo cada 250ms sobre el estado interno de Leaflet.
 */
async function waitForTilesToLoad(map, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        let stillLoading = false;
        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
                // Leaflet marca _loading cuando hay peticiones en vuelo.
                // Si el layer no expone _loading (versiones nuevas), lo ignoramos.
                if (layer._loading === true) stillLoading = true;
            }
        });
        if (!stillLoading) return;
        await new Promise(res => setTimeout(res, 250));
    }
}

/**
 * CREA EL MAPA COMPUESTO (PBA + INSET GBA/CABA)
 * 
 * NOTA SOBRE EL FONDO DEL IGN:
 * ------------------------------------------------------------------
 * El fondo del IGN se agrega con las dos llamadas
 * `L.tileLayer(IGN_TILE_URL, ...).addTo(...)` que aparecen más abajo.
 * 
 * Para DESACTIVAR el fondo del IGN (si en algún momento tarda demasiado
 * o falla por CORS), comentá o eliminá esas DOS líneas. El resto del
 * código (colores de divisiones, bordes GBA, rectángulo y líneas
 * diagonales) sigue funcionando igual y el mapa se exportará sobre
 * fondo blanco.
 * 
 * Adicionalmente, podés reducir el valor de TIMEOUT_TILES_MS a 0
 * para saltarte la espera de tiles.
 * ------------------------------------------------------------------
 * 
 * @returns {Promise<HTMLCanvasElement>}
 */
async function _generateMapImageInternal() {
    console.log('🗺️ Generando imagen del mapa...');

    const borderPx = GBA_BORDER_MM * SHARE_IMG_PX_PER_MM;

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

    // ⚠️ FONDO DEL IGN — Comentar esta línea para desactivar el fondo:
    L.tileLayer(IGN_TILE_URL, { crossOrigin: true, maxZoom: 18 }).addTo(mainMap);

    /**
     * ESTILO DE PARTIDOS DE PBA EN EL MAPA PRINCIPAL
     * - Asignados: color de la división con borde transparente.
     * - GBA (campo `properties.gba === true`): borde negro de 0.3mm
     *   superpuesto, aunque estén asignados a una división.
     * - No asignados: fondo blanco con borde gris fino.
     */
    const mainPbaStyle = (feature) => {
        const deptName = feature.properties.nam;
        const groupId = getDepartmentGroupId(deptName);
        const isGBA = feature.properties.gba === true;
        const borderColor = isGBA ? '#000000' : 'transparent';
        const borderWeight = isGBA ? borderPx : 0;

        if (groupId) {
            return {
                fillColor: departmentGroups[groupId].color,
                fillOpacity: 0.8,
                color: borderColor,
                weight: borderWeight
            };
        }
        return {
            fillOpacity: 0,
            color: isGBA ? '#000000' : '#ccc',
            weight: isGBA ? borderPx : 0.3
        };
    };

    L.geoJSON(allDepartments, {
        style: mainPbaStyle,
        interactive: false,
        renderer: L.canvas({ padding: 0.5 })
    }).addTo(mainMap);

    // Comunas de CABA: SIEMPRE tienen borde negro de 0.3mm (todas son GBA)
    if (typeof comunasIncluidas !== 'undefined' && comunasIncluidas
        && typeof comunasCABA !== 'undefined' && comunasCABA.length > 0) {
        const mainComunaStyle = (feature) => {
            const comunaName = feature.properties.nam;
            const groupId = getDepartmentGroupId(comunaName);
            if (groupId) {
                return {
                    fillColor: departmentGroups[groupId].color,
                    fillOpacity: 0.8,
                    color: '#000000',
                    weight: borderPx
                };
            }
            return { fillOpacity: 0, color: '#000000', weight: borderPx };
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

    // ⚠️ FONDO DEL IGN — Comentar esta línea para desactivar el fondo:
    L.tileLayer(IGN_TILE_URL, { crossOrigin: true, maxZoom: 18 }).addTo(insetMap);

    const insetPbaStyle = (feature) => {
        const deptName = feature.properties.nam;
        const groupId = getDepartmentGroupId(deptName);
        const isGBA = feature.properties.gba === true;
        const borderColor = isGBA ? '#000000' : 'transparent';
        const borderWeight = isGBA ? borderPx : 0;

        if (groupId) {
            return {
                fillColor: departmentGroups[groupId].color,
                fillOpacity: 0.85,
                color: borderColor,
                weight: borderWeight
            };
        }
        return {
            fillOpacity: 0,
            color: isGBA ? '#000000' : '#999',
            weight: isGBA ? borderPx : 0.2
        };
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
                    color: '#000000',
                    weight: borderPx
                };
            }
            return { fillOpacity: 0, color: '#000000', weight: borderPx };
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

    // Esperar tiles (activo) + margen de seguridad para el render
    await new Promise(resolve => setTimeout(resolve, 300));
    await waitForTilesToLoad(mainMap, TIMEOUT_TILES_MS);
    await waitForTilesToLoad(insetMap, TIMEOUT_TILES_MS);
    await new Promise(resolve => setTimeout(resolve, 500));

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

    // =============================================
    // DIBUJO DE RECTÁNGULO Y LÍNEAS DIAGONALES
    // =============================================
    // Estas figuras se dibujan SOBRE el canvas ya capturado, para que
    // no interfieran con la captura de Leaflet y se vean nítidas.
    // =============================================
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

    // Línea 1: diagonal del extremo superior derecho al extremo
    // inferior izquierdo de su caja delimitadora.
    ctx.lineWidth = 0.4 * pxPerMm;
    ctx.beginPath();
    ctx.moveTo(
        (LINE1_POS.left + LINE1_POS.width) * pxPerMm,
        LINE1_POS.top * pxPerMm
    );
    ctx.lineTo(
        LINE1_POS.left * pxPerMm,
        (LINE1_POS.top + LINE1_POS.height) * pxPerMm
    );
    ctx.stroke();

    // Línea 2: diagonal del extremo superior izquierdo al extremo
    // inferior derecho de su caja delimitadora.
    ctx.beginPath();
    ctx.moveTo(
        LINE2_POS.left * pxPerMm,
        LINE2_POS.top * pxPerMm
    );
    ctx.lineTo(
        (LINE2_POS.left + LINE2_POS.width) * pxPerMm,
        (LINE2_POS.top + LINE2_POS.height) * pxPerMm
    );
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
window.preGenerateMapImage = preGenerateMapImage;
window.invalidateMapImageCache = invalidateMapImageCache;

console.log('✅ Generador de imágenes de compartir inicializado');
