/*
 * MÓDULO DE CÁLCULO DE DIPUTADOS NACIONALES
 * 
 * Responsabilidades:
 * - Cálculo de diputados por división según dos métodos:
 *   * 'actual': distribución del cupo vigente (70 para PBA, 25 para CABA)
 *     entre las divisiones propuestas, según población de cada jurisdicción.
 *   * 'decreto': aplicación del Decreto-ley 22847/1983
 *     (1 diputado cada 161.000 habitantes o fracción mayor a 80.500,
 *      más 3 adicionales, con mínimo de 5).
 * - Cálculo de diputados para provincias completas.
 *
 * DEPENDENCIAS (globales):
 * - departmentGroups, currentDivisionCount (main.js)
 * - allDepartments, comunasCABA (data-manager.js)
 * - partidosData, datosComuna (data-manager.js)
 * - calcularTotalDivision (data-manager.js)
 *
 * ORDEN DE CARGA: después de data-manager.js.
 */

// =============================================
// CÁLCULO DE DIPUTADOS POR DIVISIÓN
// =============================================

/**
 * CALCULA LA CANTIDAD DE DIPUTADOS PARA TODAS LAS DIVISIONES SEGÚN EL MÉTODO
 * @param {string} metodo - 'actual' o 'decreto'
 * @returns {Object} - Mapa {grupoId: cantidadDiputados}
 */
function calcularDiputadosTodasDivisiones(metodo) {
    const result = {};
    
    if (metodo === 'decreto') {
        for (let i = 1; i <= currentDivisionCount; i++) {
            const poblacion = calcularTotalDivision(i, 'poblacion_total');
            result[i] = calcularDiputadosDecreto(poblacion);
        }
        return result;
    }
    
    // Método "Cantidad actual":
    // Distribuir 70 diputados entre divisiones de PBA (según población de PBA)
    // y 25 entre divisiones de CABA (según población de CABA).
    // Usamos el método del mayor resto para garantizar sumas exactas.
    const pbaPops = [];
    const cabaPops = [];
    let totalPba = 0, totalCaba = 0;
    
    for (let i = 1; i <= currentDivisionCount; i++) {
        const { pba, caba } = calcularPoblacionPorJurisdiccion(i);
        pbaPops.push(pba);
        cabaPops.push(caba);
        totalPba += pba;
        totalCaba += caba;
    }
    
    const pbaRaw = totalPba > 0
        ? pbaPops.map(p => (p / totalPba) * 70)
        : pbaPops.map(() => 0);
    const cabaRaw = totalCaba > 0
        ? cabaPops.map(p => (p / totalCaba) * 25)
        : cabaPops.map(() => 0);
    
    const pbaRounded = distribuirPorMayorResto(pbaRaw, 70);
    const cabaRounded = distribuirPorMayorResto(cabaRaw, 25);
    
    for (let i = 1; i <= currentDivisionCount; i++) {
        result[i] = pbaRounded[i - 1] + cabaRounded[i - 1];
    }
    
    return result;
}

/**
 * APLICA EL MÉTODO DEL DECRETO-LEY 22847 A UNA POBLACIÓN
 * 1 diputado por cada 161.000 habitantes o fracción mayor a 80.500
 * Más 3 diputados adicionales por división. Mínimo 5 diputados.
 */
function calcularDiputadosDecreto(poblacion) {
    if (!poblacion || poblacion <= 0) return 5;
    const base = Math.floor(poblacion / 161000);
    const resto = poblacion % 161000;
    const extra = (resto >= 80500) ? 1 : 0;
    const total = base + extra + 3;
    return Math.max(5, total);
}

/**
 * DISTRIBUYE UN TOTAL ENTERO ENTRE VALORES USANDO EL MÉTODO DEL MAYOR RESTO
 * Garantiza que la suma de los valores enteros sea exactamente igual al total.
 */
function distribuirPorMayorResto(valores, total) {
    const pisos = valores.map(v => Math.floor(v));
    const restos = valores.map((v, i) => ({ resto: v - pisos[i], index: i }));
    restos.sort((a, b) => b.resto - a.resto);
    
    const sumaPisos = pisos.reduce((a, b) => a + b, 0);
    const sobrantes = total - sumaPisos;
    
    const resultado = [...pisos];
    for (let k = 0; k < sobrantes && k < restos.length; k++) {
        resultado[restos[k].index]++;
    }
    return resultado;
}

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

// =============================================
// CÁLCULO DE DIPUTADOS POR PROVINCIA
// =============================================

/**
 * DEVUELVE LA CANTIDAD DE DIPUTADOS DE UNA PROVINCIA SEGÚN EL MÉTODO
 * Para PBA y CABA hay valores conocidos; para el resto se aplica el
 * Decreto-ley 22847 cuando corresponde.
 * @param {Object} info - Objeto con {poblacion_total}
 * @param {string} cde - Código CDE de la provincia
 * @param {string} metodo - 'actual' o 'decreto'
 * @returns {number|string} - Cantidad o '—'
 */
function calcularDiputadosProvincia(info, cde, metodo) {
    if (metodo === 'decreto') {
        return calcularDiputadosDecreto(info.poblacion_total);
    }
    // Método actual: cantidades fijas para PBA y CABA
    if (cde === '6') return 70;   // Provincia de Buenos Aires
    if (cde === '2') return 25;   // Ciudad Autónoma de Buenos Aires
    return '—';
}

console.log('✅ Módulo de cálculo de diputados inicializado');
