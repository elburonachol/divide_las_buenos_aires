/*
 * MÓDULO DE GESTIÓN DE DATOS - data-manager.js
 * 
 * Responsabilidades:
 * - Carga de datos externos (GeoJSON, datos_partidos.json, regiones_administrativas.json)
 * - Cálculos matemáticos y estadísticos
 * - Búsquedas y filtros en los datos
 * - Procesamiento de información para la tabla comparativa
 */

// =============================================
// CARGA DE DATOS EXTERNOS
// =============================================

/**
 * CARGA DEL ARCHIVO GEOJSON DESDE geometrias/deptos_pba.geojson
 * Carga todos los departamentos y los prepara para su uso en la aplicación
 */
function loadGeoJSON() {
    return fetch('/geometrias/deptos_pba.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar el archivo GeoJSON');
            }
            return response.json();
        })
        .then(data => {
            console.log(`✅ GeoJSON cargado: ${data.features.length} departamentos`);

            // Guardar todos los features (departamentos) para uso global
            allDepartments = data.features;

            // Ordenar alfabéticamente por nombre para consistencia
            allDepartments.sort((a, b) => {
                const nameA = (a.properties.nam || '').toUpperCase();
                const nameB = (b.properties.nam || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });

            // Crear la capa GeoJSON en el mapa usando funciones del módulo de mapa
            geoJsonLayer = L.geoJSON(allDepartments, {
                style: getDepartmentStyle,
                onEachFeature: setupDepartmentInteractions
            }).addTo(map);

            // Ajustar la vista del mapa para mostrar todos los departamentos
            setTimeout(() => {
                map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
            }, 100);

            // Poblar el listado de departamentos en la interfaz
            populateDepartmentsList(allDepartments);
            
            return allDepartments;
        })
        .catch(error => {
            console.error('❌ Error cargando el GeoJSON:', error);
            alert('Error al cargar el archivo GeoJSON. Verifica la consola para más detalles.');
            throw error; // Relanzar para que Promise.all falle apropiadamente
        });
}

/**
 * CARGA DEL ARCHIVO GEOJSON DE COMUNAS DESDE geometrias/comunas_caba_c_datos.geojson
 * Carga las 15 comunas de CABA para su uso en la aplicación
 * Nota: Este archivo tiene la misma estructura de datos que deptos_pba.geojson
 */
function loadComunasCABA() {
    return fetch('/geometrias/comunas_caba_c_datos.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar comunas: HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`✅ Comunas CABA cargadas: ${data.features.length} comunas`);
            console.log('📍 Comunas cargadas:', data.features.map(f => f.properties.nam));
            
            // Guardar todas las comunas
            comunasCABA = data.features;
            
            // Ordenar alfabéticamente como los departamentos
            comunasCABA.sort((a, b) => {
                const nameA = (a.properties.nam || '').toUpperCase();
                const nameB = (b.properties.nam || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });

            return comunasCABA;
        })
        .catch(error => {
            console.error('❌ Error cargando comunas CABA:', error);
            // No bloqueamos la aplicación si falla la carga de comunas
            return null;
        });
}

/**
 * CARGA DE DATOS DE PARTIDOS DESDE tablas_de_atributos/datos_partidos.json
 * Incluye superficie, población y otras variables para cálculos
 */
function loadPartidosData() {
    return fetch('/tablas_de_atributos/datos_partidos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            partidosData = data;
            console.log('✅ Datos de partidos cargados:', partidosData);
            console.log(`📊 Variables disponibles: ${Object.keys(partidosData.variables)}`);
            return partidosData;
        })
        .catch(error => {
            console.error('❌ Error cargando datos de partidos:', error);
            // No bloqueamos la aplicación si falla la carga de estos datos
            return null;
        });
}

/**
 * CARGA DE REGIONES ADMINISTRATIVAS DESDE tablas_de_atributos/regiones_administrativas.json
 * Incluye secciones electorales, regiones sanitarias, regiones educativas y departamentos judiciales
 */
function loadRegionesExistentes() {
    return fetch('/tablas_de_atributos/regiones_administrativas.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            regionesExistentes = data;
            console.log('✅ Regiones administrativas cargadas:', regionesExistentes);
            return regionesExistentes;
        })
        .catch(error => {
            console.error('❌ Error cargando regiones administrativas:', error);
            // No bloqueamos la aplicación si falla la carga de estos datos
            return null;
        });
}

/**
 * CARGA DE DATOS DE OTRAS PROVINCIAS ARGENTINAS DESDE tablas_de_atributos/datos_provincias.json
 * Todavía no existe el archivo: falla silenciosamente si no está disponible.
 */
function loadDatosProvincias() {
    return fetch('/tablas_de_atributos/datos_provincias.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            datosProvincias = data;
            console.log('✅ Datos de otras provincias cargados');
            return datosProvincias;
        })
        .catch(error => {
            console.warn('ℹ️ datos_provincias.json no disponible aún:', error.message);
            return null;
        });
}

/**
 * CARGA DE DATOS DE COMUNAS DESDE tablas_de_atributos/datos_comunas.json
 * Incluye superficie y población de las comunas de CABA para cálculos
 */
let datosComuna = null;
let datosProvincias = null;

function loadDatosComuna() {
    return fetch('/tablas_de_atributos/datos_comunas.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            datosComuna = data;
            console.log('✅ Datos de comunas cargados:', datosComuna);
            return datosComuna;
        })
        .catch(error => {
            console.error('❌ Error cargando datos de comunas:', error);
            // No bloqueamos la aplicación si falla la carga de estos datos
            return null;
        });
}

// =============================================
// CÁLCULOS Y PROCESAMIENTO DE DATOS
// =============================================

/**
 * OBTIENE EL CÓDIGO CDE DE UN DEPARTAMENTO POR SU NOMBRE
 * @param {string} nombreDepartamento - Nombre del departamento a buscar
 * @returns {string|null} - Código CDE o null si no se encuentra
 */
function obtenerCodigoCdePorNombre(nombreDepartamento) {
    // Buscar en departamentos de PBA
    const dept = allDepartments.find(d => d.properties.nam === nombreDepartamento);
    if (dept) {
        // Usar cde_num (sin cero)
        return dept.properties.cde_num || null;
    }
    // Buscar en comunas de CABA
    const comuna = comunasCABA.find(c => c.properties.nam === nombreDepartamento);
    if (comuna) {
        return comuna.properties.cde_num || null;
    }
    return null;
}

/**
 * OBTIENE UN DEPARTAMENTO COMPLETO POR SU CÓDIGO CDE
 * @param {string} cde - Código CDE del departamento
 * @returns {Object|null} - Departamento encontrado o null
 */
function getDepartmentByCode(cde) {
    return allDepartments.find(dept => dept.properties.cde === cde);
}

/**
 * OBTIENE EL NOMBRE DE UN DEPARTAMENTO POR SU CÓDIGO CDE
 * @param {string} cde - Código CDE del departamento
 * @returns {string|null} - Nombre del departamento o null
 */
function getDepartmentNameByCode(cde) {
    const dept = getDepartmentByCode(cde);
    return dept ? dept.properties.nam : null;
}

/**
 * VERIFICA SI UN DEPARTAMENTO PERTENECE AL GBA POR SU CÓDIGO CDE
 * @param {string} cde - Código CDE del departamento
 * @returns {boolean} - True si pertenece al GBA
 */
function isGBADepartmentByCode(cde) {
    return gbaCodes.includes(cde);
}

// =============================================
// FUNCIONES AUXILIARES PARA GESTIÓN DE DATOS
// =============================================

/**
 * FORMATEA NÚMEROS CON SEPARADOR DE MILES Y OPCIONALMENTE DECIMALES
 * @param {number|string} numero - Número a formatear
 * @param {number} [decimales] - Cantidad de decimales a mostrar (opcional). 
 *                                Si no se indica, se redondea a entero (sin decimales).
 *                                Si se indica 0 o más, se usa coma como separador decimal.
 * @returns {string} - Número formateado
 */
function formatearNumero(numero, decimales) {
    if (numero === 0 || numero === '0') return '0';
    if (!numero && numero !== 0) return '-';
    
    let num = parseFloat(numero);
    if (isNaN(num)) return '-';
    
    let parteEntera, parteDecimal;
    
    if (decimales !== undefined && decimales >= 0) {
        // Redondear a la cantidad de decimales especificada
        let factor = Math.pow(10, decimales);
        num = Math.round(num * factor) / factor;
        let partes = num.toFixed(decimales).split('.');
        parteEntera = partes[0];
        parteDecimal = partes[1] || '';
    } else {
        // Sin decimales: redondear a entero
        num = Math.round(num);
        parteEntera = num.toString();
        parteDecimal = '';
    }
    
    // Agregar separador de miles (punto) en la parte entera
    parteEntera = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    if (parteDecimal) {
        return parteEntera + ',' + parteDecimal; // coma como separador decimal
    } else {
        return parteEntera;
    }
}

/**
 * CALCULA EL TOTAL DE UNA VARIABLE PARA TODOS LOS DEPARTAMENTOS Y COMUNAS DE UNA DIVISIÓN
 * @param {number} grupoId - ID de la división (1, 2, 3, ...)
 * @param {string} variable - Nombre de la variable a sumar ('superficie', 'poblacion_total', etc.)
 * @returns {number} - Suma total de la variable para la división
 */
function calcularTotalDivision(grupoId, variable) {
    // Verificar que tenemos datos cargados
    if (!partidosData || !partidosData.datos) {
        return 0;
    }
    
    const elementosEnGrupo = departmentGroups[grupoId].departments;
    let total = 0;
    let elementosConDatos = 0;
    
    // Sumar la variable para cada elemento (departamento o comuna) en la división
    elementosEnGrupo.forEach(nombreElemento => {
        const codigo = obtenerCodigoCdePorNombre(nombreElemento);
        if (codigo) {
            // Primero intentar con datos de partidos (PBA)
            if (partidosData && partidosData.datos[codigo] && partidosData.datos[codigo][variable] !== undefined) {
                total += partidosData.datos[codigo][variable];
                elementosConDatos++;
            }
            // Si no, intentar con datos de comunas (CABA)
            else if (datosComuna && datosComuna.datos[codigo] && datosComuna.datos[codigo][variable] !== undefined) {
                total += datosComuna.datos[codigo][variable];
                elementosConDatos++;
            }
        }
    });
    
    // Solo retornar total si encontramos datos para al menos un elemento
    return elementosConDatos > 0 ? total : 0;
}

/**
 * CALCULA LA DENSIDAD POBLACIONAL PARA UNA DIVISIÓN
 * @param {number} grupoId - ID de la división
 * @returns {number} - Densidad sin redondear (para que formatearNumero maneje los decimales)
 */
function calcularDensidadDivision(grupoId) {
    const poblacion = calcularTotalDivision(grupoId, 'poblacion_total');
    const superficie = calcularTotalDivision(grupoId, 'superficie');
    
    // Evitar división por cero y retornar densidad calculada sin redondear
    if (superficie > 0 && poblacion > 0) {
        return poblacion / superficie;  // devuelve número con precisión completa
    }
    return 0;  // en lugar de '0.0', para que formatearNumero lo maneje
}

/**
 * FORMATEA UN VALOR MONETARIO EN MILLONES DE PESOS
 * @param {number} valor - Valor numérico en millones
 * @returns {string} - Valor formateado (ej: "$ 12.345 M")
 */
function formatearMoneda(valor) {
    if (valor === 0 || valor === '0') return '$ 0';
    if (!valor && valor !== 0) return '-';
    
    const num = parseFloat(valor);
    if (isNaN(num)) return '-';
    
    // Redondear a entero (millones)
    const entero = Math.round(num);
    
    // Formatear con separador de miles
    const formateado = entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    return `$ ${formateado} M`;
}

// =============================================
// CÁLCULOS ESPECÍFICOS DE LA TABLA COMPARATIVA
// =============================================


/**
 * CALCULA LA POBLACIÓN DE UNA DIVISIÓN SEPARADA POR JURISDICCIÓN
 * @returns {Object} {pba: number, caba: number}
 */
function calcularPoblacionPorJurisdiccion(grupoId) {
    const elementos = departmentGroups[grupoId].departments;
    let pba = 0, caba = 0;
    
    elementos.forEach(nombre => {
        // ¿Es un departamento de PBA?
        const deptPBA = allDepartments.find(d => d.properties.nam === nombre);
        if (deptPBA) {
            const codigo = deptPBA.properties.cde_num;
            if (partidosData && partidosData.datos[codigo]
                && partidosData.datos[codigo].poblacion_total) {
                pba += partidosData.datos[codigo].poblacion_total;
            }
            return;
        }
        
        // ¿Es una comuna de CABA?
        const comuna = comunasCABA.find(c => c.properties.nam === nombre);
        if (comuna) {
            const codigo = comuna.properties.cde_num;
            if (datosComuna && datosComuna.datos[codigo]
                && datosComuna.datos[codigo].poblacion_total) {
                caba += datosComuna.datos[codigo].poblacion_total;
            }
        }
    });
    
    return { pba, caba };
}


/**
 * DEVUELVE LAS PROVINCIAS "COMPLETAS" QUE SIEMPRE SE MUESTRAN EN LA TABLA
 * Estas son la Provincia de Buenos Aires (cde "6") y la Ciudad Autónoma
 * de Buenos Aires (cde "2"). Se muestran siempre, sin importar el toggle.
 * @returns {Array} - Lista de {cde, nombre, info}
 */
function getProvinciasCompletas() {
    if (!datosProvincias || !datosProvincias.datos) return [];
    const codes = ['6', '2'];  // PBA primero, CABA después
    return codes
        .filter(c => datosProvincias.datos[c])
        .map(cde => ({
            cde: cde,
            nombre: datosProvincias.datos[cde].nombre_provincia || `Provincia ${cde}`,
            info: datosProvincias.datos[cde]
        }));
}

/**
 * DEVUELVE LAS OTRAS PROVINCIAS ARGENTINAS (excluyendo PBA y CABA)
 * Se muestran sólo cuando el toggle "Incluir otras provincias" está activo.
 * @returns {Array} - Lista de {cde, nombre, info}
 */
function getProvinciasArgentinas() {
    if (!datosProvincias || !datosProvincias.datos) return [];
    const excluir = new Set(['2', '6']);  // CABA y PBA
    return Object.entries(datosProvincias.datos)
        .filter(([cde]) => !excluir.has(cde))
        .map(([cde, info]) => ({
            cde: cde,
            nombre: info.nombre_provincia || `Provincia ${cde}`,
            info: info
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// =============================================
// CÁLCULOS ADICIONALES PARA LA TABLA COMPARATIVA
// =============================================

/**
 * CALCULA EL PORCENTAJE DE HOGARES CON NBI EN UNA DIVISIÓN
 * Fórmula: (suma hogares_nbi / suma hogares_total) * 100
 * @param {number} grupoId - ID de la división
 * @returns {number} - Porcentaje (0-100)
 */
function calcularPorcentajeNbiDivision(grupoId) {
    const nbi = calcularTotalDivision(grupoId, 'hogares_nbi');
    const total = calcularTotalDivision(grupoId, 'hogares_total');
    if (total > 0) return (nbi / total) * 100;
    return 0;
}

/**
 * CALCULA EL PBG PER CÁPITA DE UNA DIVISIÓN EN PESOS CONSTANTES DE 2004
 * El PBG está almacenado en millones de pesos, así que multiplicamos
 * por 1.000.000 antes de dividir por la población para obtener el
 * resultado en pesos por habitante (evita valores tipo 0,2).
 * @param {number} grupoId - ID de la división
 * @returns {number} - PBG per cápita en pesos constantes de 2004 por habitante
 */
function calcularPbgPerCapitaDivision(grupoId) {
    const pbg = calcularTotalDivision(grupoId, 'pbg');       // millones de $
    const poblacion = calcularTotalDivision(grupoId, 'poblacion_total');
    if (poblacion > 0 && pbg > 0) {
        return (pbg * 1000000) / poblacion;                  // $ por habitante
    }
    return 0;
}

/**
 * CALCULA EL PORCENTAJE DE HOGARES CON NBI PARA UNA PROVINCIA
 * a partir de un objeto info con hogares_nbi y hogares_total.
 * @param {Object} info - Objeto con {hogares_nbi, hogares_total}
 * @returns {number} - Porcentaje (0-100)
 */
function calcularPorcentajeNbiProvincia(info) {
    if (!info || !info.hogares_total) return 0;
    return (info.hogares_nbi / info.hogares_total) * 100;
}

/**
 * CALCULA EL PBG PER CÁPITA DE UNA PROVINCIA EN PESOS CONSTANTES DE 2004
 * @param {Object} info - Objeto con {pbg, poblacion_total}
 * @returns {number} - PBG per cápita en pesos de 2004 por habitante
 */
function calcularPbgPerCapitaProvincia(info) {
    if (!info || !info.poblacion_total || !info.pbg) return 0;
    return (info.pbg * 1000000) / info.poblacion_total;
}
