/*
 * MÓDULO DE MODAL DE COMPARTIR PROPUESTA
 * 
 * Responsabilidades:
 * - Modal de éxito post-publicación
 * - Previsualizaciones de mapa y tabla con spinners
 * - Descarga de imágenes
 * - Botones de redes sociales
 *
 * DEPENDENCIAS:
 * - share-utils.js (íconos, helpers, constantes)
 * - share-image-generator.js (generateMapImage, generateTableImage)
 *
 * ORDEN DE CARGA: después de share-utils.js y share-image-generator.js.
 */

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
            copyBtn.innerHTML = CHECK_ICON_SVG;
            setTimeout(() => { copyBtn.innerHTML = COPY_ICON_SVG; }, 1800);
        }).catch(err => {
            console.error('Error al copiar:', err);
        });
    });

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

    downloadMapBtn.addEventListener('click', () => {
        if (mapCanvas) downloadCanvas(mapCanvas, `${tituloSanitizado} mapa.png`);
    });
    downloadTableBtn.addEventListener('click', () => {
        if (tableCanvas) downloadCanvas(tableCanvas, `${tituloSanitizado} tabla.png`);
    });

    modal.querySelectorAll('.social-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const red = btn.getAttribute('data-red');
            const meta = SOCIAL_META[red];
            const text = `Así dividiría (las) Buenos Aires. Mirá la propuesta completa en: ${shareUrl}`;

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
                    if (err.name !== 'AbortError') {
                        console.warn('Web Share API falló:', err);
                    } else {
                        return;
                    }
                }
            }

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
// EXPOSICIÓN GLOBAL
// =============================================

window.showShareModal = showShareModal;

console.log('✅ Modal de compartir propuesta inicializado');
