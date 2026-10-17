/*
 * MÓDULO DE COMPARTIR PROPUESTA
 * 
 * Responsabilidades:
 * - Generación de la imagen compuesta del mapa (PBA + inset GBA/CABA)
 * - Generación de la imagen de la tabla comparativa
 * - Modal de éxito post-publicación con previsualizaciones y descargas
 * - Botones de redes sociales con instrucciones de uso
 *
 * DEPENDENCIAS:
 * - html2canvas (CDN)
 * - Leaflet (map, L)
 * - data-manager.js (calcularTotalDivision, formatearNumero, formatearMoneda)
 * - comparison-table.js (estructura de la tabla)
 *
 * ORDEN DE CARGA: después de comparison-table.js.
 */

// =============================================
// CONSTANTES DE DISEÑO
// =============================================

const SHARE_IMG_WIDTH_MM = 210;
const SHARE_IMG_HEIGHT_MM = 320;
const SHARE_IMG_WIDTH_PX = 1080;
const SHARE_IMG_PX_PER_MM = SHARE_IMG_WIDTH_PX / SHARE_IMG_WIDTH_MM;
const SHARE_IMG_HEIGHT_PX = Math.round(SHARE_IMG_HEIGHT_MM * SHARE_IMG_PX_PER_MM);

// Coordenadas del mapa de fondo (EPSG:3857 -> Leaflet LatLng)
const MAIN_MAP_BOUNDS = {
    west: -7093051.679,
    south: -5194476.193,
    east: -6253051.679,
    north: -3914476.193
};

// Coordenadas del mapa pequeño (inset)
const INSET_MAP_BOUNDS = {
    west: -6583589.694,
    south: -4178208.412,
    east: -6429589.694,
    north: -4062755.819
};

// Posiciones y dimensiones en mm
const INSET_POS = { left: 63.016, top: 208.706, width: 140.000, height: 104.957 };
const RECT_POS = { left: 119.388, top: 31.569, width: 46.492, height: 29.847 };
const LINE1_POS = { left: 62.866, top: 31.269, width: 56.222, height: 176.987 };
const LINE2_POS = { left: 166.180, top: 31.269, width: 36.986, height: 176.987 };

// =============================================
// UTILIDADES DE CONVERSIÓN
// =============================================

function mmToPx(mm) {
    return mm * SHARE_IMG_PX_PER_MM;
}

function mercatorToLatLng(x, y) {
    return L.CRS.EPSG3857.unproject(L.point(x, y));
}

// =============================================
// GENERACIÓN DE LA IMAGEN DEL MAPA
// =============================================

/**
 * CREA EL MAPA COMPUESTO (PBA + INSET GBA/CABA)
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateMapImage() {
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        left: -99999px;
        top: 0;
        width: ${SHARE_IMG_WIDTH_PX}px;
        height: ${SHARE_IMG_HEIGHT_PX}px;
        background: white;
    `;
    document.body.appendChild(container);

    // Mapa de fondo
    const mainMapDiv = document.createElement('div');
    mainMapDiv.style.cssText = `width: ${SHARE_IMG_WIDTH_PX}px; height: ${SHARE_IMG_HEIGHT_PX}px;`;
    container.appendChild(mainMapDiv);

    const mainMap = L.map(mainMapDiv, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true
    });
    const mainSW = mercatorToLatLng(MAIN_MAP_BOUNDS.west, MAIN_MAP_BOUNDS.south);
    const mainNE = mercatorToLatLng(MAIN_MAP_BOUNDS.east, MAIN_MAP_BOUNDS.north);
    mainMap.fitBounds(L.latLngBounds(mainSW, mainNE));

    // Tile layer (IGN gris)
    L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
        crossOrigin: true,
        maxZoom: 18
    }).addTo(mainMap);

    // GeoJSON de departamentos coloreados según división
    const deptsGeoJSON = L.geoJSON(allDepartments, {
        style: (feature) => {
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
        },
        interactive: false,
        renderer: L.canvas({ padding: 0.5 })
    }).addTo(mainMap);

    // Mapa pequeño (inset)
    const insetDiv = document.createElement('div');
    insetDiv.style.cssText = `
        position: absolute;
        left: ${mmToPx(INSET_POS.left)}px;
        top: ${mmToPx(INSET_POS.top)}px;
        width: ${mmToPx(INSET_POS.width)}px;
        height: ${mmToPx(INSET_POS.height)}px;
        border: 2px solid #333;
        box-sizing: border-box;
        z-index: 10;
    `;
    container.appendChild(insetDiv);

    const insetMap = L.map(insetDiv, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true
    });
    const insetSW = mercatorToLatLng(INSET_MAP_BOUNDS.west, INSET_MAP_BOUNDS.south);
    const insetNE = mercatorToLatLng(INSET_MAP_BOUNDS.east, INSET_MAP_BOUNDS.north);
    insetMap.fitBounds(L.latLngBounds(insetSW, insetNE));

    L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
        crossOrigin: true,
        maxZoom: 18
    }).addTo(insetMap);

    L.geoJSON(allDepartments, {
        style: (feature) => {
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
        },
        interactive: false,
        renderer: L.canvas({ padding: 0.5 })
    }).addTo(insetMap);

    // Esperar a que los tiles carguen
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Capturar el contenedor completo con html2canvas
    const canvas = await html2canvas(container, {
        width: SHARE_IMG_WIDTH_PX,
        height: SHARE_IMG_HEIGHT_PX,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 1
    });

    // Dibujar líneas y rectángulo sobre el canvas
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';

    // Rectángulo
    ctx.lineWidth = mmToPx(0.6);
    ctx.strokeRect(
        mmToPx(RECT_POS.left),
        mmToPx(RECT_POS.top),
        mmToPx(RECT_POS.width),
        mmToPx(RECT_POS.height)
    );

    // Línea 1
    ctx.lineWidth = mmToPx(0.4);
    ctx.beginPath();
    ctx.moveTo(mmToPx(LINE1_POS.left), mmToPx(LINE1_POS.top));
    ctx.lineTo(mmToPx(LINE1_POS.left), mmToPx(LINE1_POS.top + LINE1_POS.height));
    ctx.stroke();

    // Línea 2
    ctx.beginPath();
    ctx.moveTo(mmToPx(LINE2_POS.left), mmToPx(LINE2_POS.top));
    ctx.lineTo(mmToPx(LINE2_POS.left), mmToPx(LINE2_POS.top + LINE2_POS.height));
    ctx.stroke();

    // Limpiar
    mainMap.remove();
    insetMap.remove();
    document.body.removeChild(container);

    return canvas;
}

// =============================================
// GENERACIÓN DE LA IMAGEN DE LA TABLA
// =============================================

/**
 * GENERA LA IMAGEN DE LA TABLA COMPARATIVA (SIN OTRAS PROVINCIAS)
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateTableImage() {
    // Clonar la tabla para no afectar la original
    const originalTable = document.getElementById('comparison-table');
    if (!originalTable) throw new Error('No se encontró la tabla comparativa');

    const clone = originalTable.cloneNode(true);
    const tbody = clone.querySelector('tbody');

    // Eliminar filas de otras provincias (si existen)
    if (tbody) {
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.forEach(row => {
            const firstCell = row.querySelector('td');
            if (firstCell && firstCell.textContent.includes('Provincia')) {
                row.remove();
            }
        });
    }

    // Contenedor temporal
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
        scale: 2
    });

    document.body.removeChild(wrapper);
    return canvas;
}

// =============================================
// UTILIDADES DE DESCARGA Y COMPARTIR
// =============================================

function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

async function canvasToBlob(canvas) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// =============================================
// MODAL DE COMPARTIR
// =============================================

/**
 * MUESTRA EL MODAL DE ÉXITO CON LAS IMÁGENES Y OPCIONES DE COMPARTIR
 * @param {Object} proposal - Propuesta publicada (resultado de Supabase)
 */
function showShareModal(proposal) {
    const shareCode = proposal.user_share_code;
    const shareUrl = `${window.location.origin}/propuesta/${shareCode}`;

    const modal = document.createElement('div');
    modal.id = 'share-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        z-index: 10000;
        font-family: Arial, sans-serif;
        overflow-y: auto;
        padding: 30px 15px;
        box-sizing: border-box;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 700px;
            width: 100%;
            box-shadow: 0 8px 30px rgba(0,0,0,0.3);
            position: relative;
        ">
            <button id="share-close" style="
                position: absolute; top: 12px; right: 18px;
                background: none; border: none;
                font-size: 26px; cursor: pointer; color: #999;
            ">×</button>

            <h3 style="margin-top: 0; color: #333; text-align: center;">
                ¡Tu propuesta está publicada!
            </h3>
            <p style="color: #666; font-size: 14px; text-align: center; margin-bottom: 20px;">
                Compartila con este enlace:
            </p>

            <div style="
                display: flex; gap: 10px; align-items: center;
                background: #f5f5f5; padding: 10px 14px;
                border-radius: 6px; margin-bottom: 25px;
            ">
                <span id="share-url" style="
                    flex: 1; font-size: 13px; color: #333;
                    word-break: break-all;
                ">${shareUrl}</span>
                <button id="share-copy-btn" title="Copiar enlace" style="
                    background: #3388ff; color: white; border: none;
                    padding: 8px 12px; border-radius: 4px;
                    cursor: pointer; font-size: 16px;
                ">📋</button>
            </div>

            <!-- Previsualizaciones -->
            <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
                <div style="flex: 1; min-width: 280px; text-align: center;">
                    <h4 style="color: #444; margin-bottom: 8px;">Mapa de divisiones</h4>
                    <div id="map-preview-container" style="
                        position: relative; width: 100%; aspect-ratio: 210/320;
                        background: #f0f0f0; border-radius: 6px; overflow: hidden;
                        display: flex; align-items: center; justify-content: center;
                    ">
                        <div class="share-spinner" id="map-spinner">
                            <div style="
                                width: 28px; height: 28px;
                                border: 3px solid #e1e8ed;
                                border-top-color: #3498db;
                                border-radius: 50%;
                                animation: share-spin 0.8s linear infinite;
                                margin: 0 auto 10px;
                            "></div>
                            <span style="color: #666; font-size: 13px;">Creando mapa...</span>
                        </div>
                        <img id="map-preview-img" style="
                            display: none; width: 100%; height: 100%; object-fit: contain;
                        ">
                    </div>
                    <button id="download-map-btn" disabled style="
                        margin-top: 10px; background: #3498db; color: white;
                        border: none; padding: 8px 18px; border-radius: 4px;
                        cursor: pointer; font-size: 13px;
                    ">Descargar mapa</button>
                </div>

                <div style="flex: 1; min-width: 280px; text-align: center;">
                    <h4 style="color: #444; margin-bottom: 8px;">Tabla comparativa</h4>
                    <div id="table-preview-container" style="
                        position: relative; width: 100%; min-height: 180px;
                        background: #f0f0f0; border-radius: 6px; overflow: auto;
                        display: flex; align-items: center; justify-content: center;
                    ">
                        <div class="share-spinner" id="table-spinner">
                            <div style="
                                width: 28px; height: 28px;
                                border: 3px solid #e1e8ed;
                                border-top-color: #3498db;
                                border-radius: 50%;
                                animation: share-spin 0.8s linear infinite;
                                margin: 0 auto 10px;
                            "></div>
                            <span style="color: #666; font-size: 13px;">Creando tabla...</span>
                        </div>
                        <img id="table-preview-img" style="
                            display: none; max-width: 100%; height: auto;
                        ">
                    </div>
                    <button id="download-table-btn" disabled style="
                        margin-top: 10px; background: #3498db; color: white;
                        border: none; padding: 8px 18px; border-radius: 4px;
                        cursor: pointer; font-size: 13px;
                    ">Descargar tabla</button>
                </div>
            </div>

            <!-- Redes sociales -->
            <h4 style="color: #444; margin-top: 30px; text-align: center;">
                Compartir en redes sociales
            </h4>
            <p style="color: #888; font-size: 12px; text-align: center; margin-bottom: 15px;">
                Las redes sociales no permiten adjuntar imágenes automáticamente desde la web.
                Descargá las imágenes y adjuntalas manualmente al compartir.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <button class="social-btn" data-red="whatsapp" style="
                    background: #25D366; color: white; border: none;
                    padding: 10px 18px; border-radius: 6px; cursor: pointer;
                    font-size: 13px; font-weight: 600;
                ">WhatsApp</button>
                <button class="social-btn" data-red="twitter" style="
                    background: #1DA1F2; color: white; border: none;
                    padding: 10px 18px; border-radius: 6px; cursor: pointer;
                    font-size: 13px; font-weight: 600;
                ">Twitter / X</button>
                <button class="social-btn" data-red="facebook" style="
                    background: #1877F2; color: white; border: none;
                    padding: 10px 18px; border-radius: 6px; cursor: pointer;
                    font-size: 13px; font-weight: 600;
                ">Facebook</button>
                <button class="social-btn" data-red="linkedin" style="
                    background: #0A66C2; color: white; border: none;
                    padding: 10px 18px; border-radius: 6px; cursor: pointer;
                    font-size: 13px; font-weight: 600;
                ">LinkedIn</button>
                <button class="social-btn" data-red="instagram" style="
                    background: #E1306C; color: white; border: none;
                    padding: 10px 18px; border-radius: 6px; cursor: pointer;
                    font-size: 13px; font-weight: 600;
                ">Instagram</button>
            </div>

            <div id="social-help" style="
                display: none; margin-top: 15px; padding: 12px;
                background: #f0f6ff; border-radius: 6px;
                font-size: 13px; color: #495057; line-height: 1.6;
            "></div>

            <style>
                @keyframes share-spin { to { transform: rotate(360deg); } }
                .social-btn:hover { opacity: 0.9; }
            </style>
        </div>
    `;

    document.body.appendChild(modal);

    // Referencias
    const closeBtn = document.getElementById('share-close');
    const copyBtn = document.getElementById('share-copy-btn');
    const mapImg = document.getElementById('map-preview-img');
    const tableImg = document.getElementById('table-preview-img');
    const mapSpinner = document.getElementById('map-spinner');
    const tableSpinner = document.getElementById('table-spinner');
    const downloadMapBtn = document.getElementById('download-map-btn');
    const downloadTableBtn = document.getElementById('download-table-btn');
    const socialHelp = document.getElementById('social-help');

    let mapCanvas = null;
    let tableCanvas = null;

    closeBtn.addEventListener('click', () => {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.parentNode.removeChild(modal);
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            copyBtn.textContent = '✅';
            setTimeout(() => { copyBtn.textContent = '📋'; }, 2000);
        });
    });

    // Generar mapa en segundo plano
    generateMapImage().then(canvas => {
        mapCanvas = canvas;
        mapImg.src = canvas.toDataURL('image/png');
        mapImg.style.display = 'block';
        mapSpinner.style.display = 'none';
        downloadMapBtn.disabled = false;
    }).catch(err => {
        console.error('Error generando mapa:', err);
        mapSpinner.innerHTML = '<span style="color:#d32f2f;font-size:13px;">Error al crear el mapa</span>';
    });

    // Generar tabla en segundo plano
    generateTableImage().then(canvas => {
        tableCanvas = canvas;
        tableImg.src = canvas.toDataURL('image/png');
        tableImg.style.display = 'block';
        tableSpinner.style.display = 'none';
        downloadTableBtn.disabled = false;
    }).catch(err => {
        console.error('Error generando tabla:', err);
        tableSpinner.innerHTML = '<span style="color:#d32f2f;font-size:13px;">Error al crear la tabla</span>';
    });

    downloadMapBtn.addEventListener('click', () => {
        if (mapCanvas) downloadCanvas(mapCanvas, 'mapa-divisiones.png');
    });
    downloadTableBtn.addEventListener('click', () => {
        if (tableCanvas) downloadCanvas(tableCanvas, 'tabla-comparativa.png');
    });

    // Redes sociales
    modal.querySelectorAll('.social-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const red = btn.getAttribute('data-red');
            const text = `Así dividiría (las) Buenos Aires. Mirá la propuesta completa en: ${shareUrl}`;
            const hashtags = 'dividelasbuenosaires,mapa';

            // Intentar Web Share API con archivos (lo más cercano a lo que se pide)
            if (navigator.share && navigator.canShare && mapCanvas && tableCanvas) {
                try {
                    const mapBlob = await canvasToBlob(mapCanvas);
                    const tableBlob = await canvasToBlob(tableCanvas);
                    const files = [
                        new File([mapBlob], 'mapa.png', { type: 'image/png' }),
                        new File([tableBlob], 'tabla.png', { type: 'image/png' })
                    ];
                    if (navigator.canShare({ files })) {
                        await navigator.share({
                            title: 'Divide (las) Buenos Aires',
                            text: text,
                            url: shareUrl,
                            files: files
                        });
                        return;
                    }
                } catch (err) {
                    console.warn('Web Share API no disponible o cancelada:', err);
                }
            }

            // Fallback: abrir la red social con texto + enlace
            let url = '';
            switch (red) {
                case 'whatsapp':
                    url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                    socialHelp.innerHTML = `
                        <strong>WhatsApp:</strong> Se abrirá un chat con el texto y el enlace.
                        Descargá las imágenes y adjuntalas manualmente. El enlace es clickeable en el mensaje.
                    `;
                    break;
                case 'twitter':
                    url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${hashtags}`;
                    socialHelp.innerHTML = `
                        <strong>Twitter / X:</strong> Se abrirá el compositor con el texto y el enlace.
                        Adjuntá primero el mapa y luego la tabla usando el botón de imagen.
                        El enlace cuenta como 23 caracteres; conviene ponerlo al final.
                    `;
                    break;
                case 'facebook':
                    url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                    socialHelp.innerHTML = `
                        <strong>Facebook:</strong> Se compartirá el enlace. En la publicación,
                        adjuntá las imágenes y pegá el texto descriptivo. El enlace es clickeable.
                    `;
                    break;
                case 'linkedin':
                    url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
                    socialHelp.innerHTML = `
                        <strong>LinkedIn:</strong> Se compartirá el enlace. En la publicación,
                        adjuntá las imágenes y pegá el texto descriptivo. El enlace es clickeable.
                    `;
                    break;
                case 'instagram':
                    socialHelp.innerHTML = `
                        <strong>Instagram:</strong> No permite compartir enlaces desde la web.
                        Descargá las imágenes, subilas como publicación o historia, y agregá el
                        enlace en la biografía o en un sticker de enlace (solo en historias).
                    `;
                    return;
            }

            socialHelp.style.display = 'block';
            if (url) window.open(url, '_blank', 'noopener');
        });
    });
}

// =============================================
// EXPOSICIÓN PÚBLICA
// =============================================

window.showShareModal = showShareModal;
window.generateMapImage = generateMapImage;
window.generateTableImage = generateTableImage;

console.log('✅ Módulo de compartir propuesta inicializado');
