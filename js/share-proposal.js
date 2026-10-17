/*
 * MÓDULO DE COMPARTIR PROPUESTA
 * 
 * Responsabilidades:
 * - Generación de la imagen compuesta del mapa (PBA + inset GBA/CABA)
 * - Generación de la imagen de la tabla comparativa (sin otras provincias)
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
 *
 * CONVENCIÓN DE ÍCONOS:
 * - El ícono de "copiar" debe ser siempre el SVG definido en COPY_ICON_SVG
 *   (dos hojas rectangulares superpuestas con leve desfase diagonal), NUNCA un emoji.
 *   Usar la misma constante en cualquier otro lugar de la web que necesite
 *   un botón de copiar.
 * - Los íconos de redes sociales deben ser SVG con la marca correspondiente,
 *   NUNCA texto ni emojis.
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

// URL de la capa base oficial del IGN (mapa base gris)
const IGN_TILE_URL = 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png';

// =============================================
// ÍCONOS SVG (CONVENCIÓN: NO USAR EMOJIS)
// =============================================

/**
 * Ícono de "copiar" — dos hojas rectangulares superpuestas con
 * leve desfase diagonal.
 * 
 * USAR ESTE MISMO ÍCONO en cualquier parte de la web que necesite
 * un botón de copiar (links, textos, códigos, etc.).
 */
const COPY_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

/** Ícono de "copiado" (checkmark) para feedback temporal */
const CHECK_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

/** Íconos de marcas de redes sociales (SVG inline, sin emojis) */
const SOCIAL_ICONS = {
    whatsapp: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>`,
    
    twitter: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    
    facebook: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>`,
    
    linkedin: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    
    instagram: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"/></svg>`
};

/** Etiquetas accesibles y colores de fondo de cada red */
const SOCIAL_META = {
    whatsapp:  { label: 'WhatsApp',    color: '#25D366', url: (text) => `https://wa.me/?text=${encodeURIComponent(text)}` },
    twitter:   { label: 'Twitter / X', color: '#000000', url: (text, url) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=dividelasbuenosaires,mapa` },
    facebook:  { label: 'Facebook',    color: '#1877F2', url: (text, url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    linkedin:  { label: 'LinkedIn',    color: '#0A66C2', url: (text, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    instagram: { label: 'Instagram',   color: '#E1306C', url: () => 'https://www.instagram.com/' }
};

/**
 * Sugerencias por red social.
 * Reglas generales que se repiten:
 *  - Incluir SIEMPRE el mapa primero y la tabla después.
 *  - Mencionar dónde conviene poner el link según la red.
 */
const SOCIAL_HELP = {
    whatsapp: 'Adjuntá primero el mapa y después la tabla como imágenes. El enlace es clickeable en el chat, así que podés incluirlo al final del mensaje.',
    twitter: 'Subí primero el mapa y después la tabla como imágenes en el primer tweet. El enlace conviene ponerlo en un tweet posterior (hilo): Twitter/X reduce el alcance de los tweets que contienen enlaces externos.',
    facebook: 'Adjuntá el mapa y la tabla como imágenes. El enlace es clickeable en el texto de la publicación; conviene incluirlo al final.',
    linkedin: 'Adjuntá el mapa y la tabla como imágenes. El enlace es clickeable en el texto de la publicación; conviene incluirlo al final del texto.',
    instagram: 'Las publicaciones del feed NO permiten enlaces clickeables. Subí el mapa y la tabla como imágenes y poné el enlace en tu biografía, o usá el sticker de enlace en una historia.'
};

// =============================================
// UTILIDADES DE CONVERSIÓN
// =============================================

function mmToPx(mm) {
    return mm * SHARE_IMG_PX_PER_MM;
}

function mercatorToLatLng(x, y) {
    return L.CRS.EPSG3857.unproject(L.point(x, y));
}

/**
 * LIMPIA UN TEXTO PARA USARLO COMO NOMBRE DE ARCHIVO
 * Elimina caracteres inválidos en sistemas de archivos.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFilename(name) {
    return (name || 'propuesta')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
}

// =============================================
// GENERACIÓN DE LA IMAGEN DEL MAPA
// =============================================

/**
 * CREA EL MAPA COMPUESTO (PBA + INSET GBA/CABA)
 * - Mapa grande: todo PBA, con los departamentos coloreados según la división.
 * - Inset: zoom del AMBA, también coloreado.
 * - Rectángulo y dos líneas verticales en negro (especificaciones).
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateMapImage() {
    console.log('🗺️ Generando imagen del mapa...');

    // Contenedor principal
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

    console.log('📍 Bounds del mapa principal:', {
        SW: [mainSW.lat.toFixed(4), mainSW.lng.toFixed(4)],
        NE: [mainNE.lat.toFixed(4), mainNE.lng.toFixed(4)]
    });

    L.tileLayer(IGN_TILE_URL, { crossOrigin: true, maxZoom: 18 }).addTo(mainMap);

    L.geoJSON(allDepartments, {
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

    console.log('📍 Bounds del inset:', {
        SW: [insetSW.lat.toFixed(4), insetSW.lng.toFixed(4)],
        NE: [insetNE.lat.toFixed(4), insetNE.lng.toFixed(4)]
    });

    L.tileLayer(IGN_TILE_URL, { crossOrigin: true, maxZoom: 18 }).addTo(insetMap);

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

    // Forzar recálculo de tamaño (crítico para el inset)
    setTimeout(() => {
        mainMap.invalidateSize();
        insetMap.invalidateSize();
    }, 300);

    // Esperar carga de tiles + render de canvas
    await new Promise(resolve => setTimeout(resolve, 3000));

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
    console.log('📐 Tamaño del canvas capturado:', canvas.width, '×', canvas.height);

    // Dibujar rectángulo y líneas SOBRE el canvas capturado
    const ctx = canvas.getContext('2d');

    // Rectángulo (borde negro 0.6mm)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = mmToPx(0.6);
    ctx.strokeRect(
        mmToPx(RECT_POS.left),
        mmToPx(RECT_POS.top),
        mmToPx(RECT_POS.width),
        mmToPx(RECT_POS.height)
    );

    // Línea 1 (borde negro 0.4mm)
    ctx.lineWidth = mmToPx(0.4);
    ctx.beginPath();
    ctx.moveTo(mmToPx(LINE1_POS.left), mmToPx(LINE1_POS.top));
    ctx.lineTo(mmToPx(LINE1_POS.left), mmToPx(LINE1_POS.top + LINE1_POS.height));
    ctx.stroke();

    // Línea 2 (borde negro 0.4mm)
    ctx.beginPath();
    ctx.moveTo(mmToPx(LINE2_POS.left), mmToPx(LINE2_POS.top));
    ctx.lineTo(mmToPx(LINE2_POS.left), mmToPx(LINE2_POS.top + LINE2_POS.height));
    ctx.stroke();

    // Limpiar
    mainMap.remove();
    insetMap.remove();
    document.body.removeChild(container);

    console.log('✅ Imagen del mapa generada');
    return canvas;
}

// =============================================
// GENERACIÓN DE LA IMAGEN DE LA TABLA
// =============================================

/**
 * Lista de "otras provincias" (no PBA, no CABA) que NO se incluyen
 * en la imagen descargable. Se conservan las filas de PBA y CABA como
 * referencia comparativa.
 */
const OTRAS_PROVINCIAS = [
    'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
    'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
    'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
    'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

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
            // Eliminar filas de otras provincias (no PBA/CABA)
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
// DESCARGA
// =============================================

function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const titulo = proposal.titulo || 'propuesta';
    const tituloSanitizado = sanitizeFilename(titulo);

    // Botones de redes: se construyen dinámicamente con sus SVG
    const socialButtonsHtml = Object.keys(SOCIAL_META).map(red => {
        const meta = SOCIAL_META[red];
        return `
            <button class="social-btn" data-red="${red}"
                title="${meta.label}"
                aria-label="Compartir en ${meta.label}"
                style="
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 44px; height: 44px; border-radius: 50%;
                    background: ${meta.color}; color: white;
                    border: none; cursor: pointer;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                ">
                ${SOCIAL_ICONS[red]}
            </button>
        `;
    }).join('');

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
            max-width: 760px;
            width: 100%;
            box-shadow: 0 8px 30px rgba(0,0,0,0.3);
            position: relative;
        ">
            <button id="share-close" style="
                position: absolute; top: 12px; right: 18px;
                background: none; border: none;
                font-size: 26px; cursor: pointer; color: #999;
            " aria-label="Cerrar">×</button>

            <h3 style="margin-top: 0; color: #333; text-align: center;">
                ¡Tu propuesta está publicada!
            </h3>
            <p style="color: #666; font-size: 14px; text-align: center; margin-bottom: 20px;">
                Compartila con este enlace:
            </p>

            <!-- URL + botón copiar -->
            <div style="
                display: flex; gap: 10px; align-items: center;
                background: #f5f5f5; padding: 10px 14px;
                border-radius: 6px; margin-bottom: 25px;
            ">
                <span id="share-url" style="
                    flex: 1; font-size: 13px; color: #333;
                    word-break: break-all;
                ">${shareUrl}</span>
                <button id="share-copy-btn"
                    title="Copiar enlace"
                    aria-label="Copiar enlace"
                    style="
                        display: inline-flex; align-items: center; justify-content: center;
                        background: #3388ff; color: white; border: none;
                        width: 36px; height: 36px; border-radius: 4px;
                        cursor: pointer;
                    ">${COPY_ICON_SVG}</button>
            </div>

            <!-- Previsualizaciones -->
            <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: flex-start;">

                <!-- Mapa -->
                <div style="flex: 1; min-width: 260px; max-width: 320px; text-align: center;">
                    <h4 style="color: #444; margin-bottom: 8px;">Mapa de divisiones</h4>
                    <div id="map-preview-container" style="
                        position: relative; width: 100%;
                        min-height: 200px; max-height: 400px;
                        background: #f0f0f0; border-radius: 6px; overflow: hidden;
                        display: flex; align-items: center; justify-content: center;
                    ">
                        <div id="map-spinner">
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
                        <img id="map-preview-img" alt="Previsualización del mapa"
                            style="display: none; max-width: 100%; max-height: 400px; object-fit: contain;">
                    </div>
                    <button id="download-map-btn" disabled style="
                        margin-top: 10px; background: #3498db; color: white;
                        border: none; padding: 8px 18px; border-radius: 4px;
                        cursor: pointer; font-size: 13px; opacity: 0.5;
                    ">Descargar mapa</button>
                </div>

                <!-- Tabla -->
                <div style="flex: 1; min-width: 260px; max-width: 320px; text-align: center;">
                    <h4 style="color: #444; margin-bottom: 8px;">Tabla comparativa</h4>
                    <div id="table-preview-container" style="
                        position: relative; width: 100%;
                        min-height: 200px; max-height: 400px;
                        background: #f0f0f0; border-radius: 6px; overflow: auto;
                        display: flex; align-items: center; justify-content: center;
                    ">
                        <div id="table-spinner">
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
                        <img id="table-preview-img" alt="Previsualización de la tabla"
                            style="display: none; max-width: 100%; max-height: 400px; object-fit: contain;">
                    </div>
                    <button id="download-table-btn" disabled style="
                        margin-top: 10px; background: #3498db; color: white;
                        border: none; padding: 8px 18px; border-radius: 4px;
                        cursor: pointer; font-size: 13px; opacity: 0.5;
                    ">Descargar tabla</button>
                </div>
            </div>

            <!-- Redes sociales -->
            <h4 style="color: #444; margin-top: 30px; text-align: center;">
                Compartir en redes sociales
            </h4>
            <p style="color: #888; font-size: 12px; text-align: center; margin-bottom: 15px;">
                Descargá las imágenes y adjuntalas manualmente al compartir.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                ${socialButtonsHtml}
            </div>

            <div id="social-help" style="
                display: none; margin-top: 15px; padding: 12px;
                background: #f0f6ff; border-radius: 6px;
                font-size: 13px; color: #495057; line-height: 1.6;
            "></div>

            <style>
                @keyframes share-spin { to { transform: rotate(360deg); } }
                .social-btn:hover { transform: scale(1.08); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
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

    // Botón copiar
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            copyBtn.innerHTML = CHECK_ICON_SVG;
            setTimeout(() => { copyBtn.innerHTML = COPY_ICON_SVG; }, 1800);
        }).catch(err => {
            console.error('Error al copiar:', err);
        });
    });

    // Generar mapa en segundo plano
    generateMapImage().then(canvas => {
        mapCanvas = canvas;
        mapImg.src = canvas.toDataURL('image/png');
        mapImg.style.display = 'block';
        mapSpinner.style.display = 'none';
        downloadMapBtn.disabled = false;
        downloadMapBtn.style.opacity = '1';
        downloadMapBtn.style.cursor = 'pointer';
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
        downloadTableBtn.style.opacity = '1';
        downloadTableBtn.style.cursor = 'pointer';
    }).catch(err => {
        console.error('Error generando tabla:', err);
        tableSpinner.innerHTML = '<span style="color:#d32f2f;font-size:13px;">Error al crear la tabla</span>';
    });

    // Botones de descarga con título del usuario
    downloadMapBtn.addEventListener('click', () => {
        if (mapCanvas) downloadCanvas(mapCanvas, `${tituloSanitizado} mapa.png`);
    });
    downloadTableBtn.addEventListener('click', () => {
        if (tableCanvas) downloadCanvas(tableCanvas, `${tituloSanitizado} tabla.png`);
    });

    // Redes sociales
    modal.querySelectorAll('.social-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const red = btn.getAttribute('data-red');
            const meta = SOCIAL_META[red];
            const text = `Así dividiría (las) Buenos Aires. Mirá la propuesta completa en: ${shareUrl}`;

            // 1) Intentar Web Share API con archivos (funciona en mobile)
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
                    // AbortError si el usuario cancela; otros errores de permisos
                    if (err.name !== 'AbortError') {
                        console.warn('Web Share API falló:', err);
                    } else {
                        return; // el usuario canceló, no hacer fallback
                    }
                }
            }

            // 2) Fallback: abrir la red social correspondiente
            let url = '';
            if (red === 'twitter') {
                url = meta.url(text, shareUrl);
            } else if (red === 'facebook' || red === 'linkedin') {
                url = meta.url('', shareUrl);
            } else if (red === 'whatsapp') {
                url = meta.url(text);
            } else if (red === 'instagram') {
                url = meta.url();
            }

            socialHelp.innerHTML = `<strong>${meta.label}:</strong> ${SOCIAL_HELP[red]}`;
            socialHelp.style.display = 'block';

            if (url) {
                window.open(url, '_blank', 'noopener');
            }
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
