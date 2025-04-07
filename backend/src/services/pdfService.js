require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { supabase, insertExpediente, getExpedientes, getExpedientesByType } = require('../config/supabaseClient');
const { PDFDocument } = require('pdf-lib');

// Silenciar warnings específicos de TrueType
const originalWarn = console.warn;
console.warn = function(message) {
    if (message && message.includes && message.includes('Warning: TT: undefined function:')) {
        return; // Ignorar warnings de TrueType
    }
    originalWarn.apply(console, arguments);
};

if (!process.env.PDF_DOWNLOAD_URL) {
    throw new Error("La variable de entorno PDF_DOWNLOAD_URL no está definida");
}

const BASE_URL = process.env.PDF_DOWNLOAD_URL;
const DOWNLOAD_DIR = path.join(__dirname, '../../downloads');
const PROCESSED_DIR = path.join(__dirname, '../../processed');

// Asegurar que los directorios existen
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

const BASE_DIR = path.join(__dirname, '../../pdfs');

const TIPOS_RESOLUCION = {
    CONCESION: {
        nombre: "Resoluciones de Concesión",
        patrones: [
            "RESOLUCIONES DE CONCESIÓN",
            "RESOLUCIONES DE CONCESION",
            "RESOLUCIÓN DE CONCESIÓN",
            "RESOLUCION DE CONCESION",
            "CONCESIÓN DE AYUDAS",
            "CONCESION DE AYUDAS",
            "RESOLUCIÓN DE CONCESIÓN DE AYUDAS",
            "RESOLUCION DE CONCESION DE AYUDAS"
        ]
    },
    DESISTIDOS: {
        nombre: "Resoluciones de Desistidos",
        patrones: [
            "RESOLUCIONES DE DESISTIDOS",
            "RESOLUCIÓN DE DESISTIDOS",
            "RESOLUCION DE DESISTIDOS",
            "DESISTIDOS DE SOLICITUDES",
            "DESISTIDO DE SOLICITUD"
        ]
    },
    DESISTIMIENTO: {
        nombre: "Resoluciones de Desistimiento Expreso",
        patrones: [
            "RESOLUCIONES DE DESISTIMIENTO EXPRESO",
            "RESOLUCIÓN DE DESISTIMIENTO EXPRESO",
            "RESOLUCION DE DESISTIMIENTO EXPRESO",
            "RENUNCIA A LA SOLICITUD",
            "DESISTIMIENTO EXPRESO",
            "DESISTIMIENTO DE SOLICITUD"
        ]
    },
    INADMITIDOS: {
        nombre: "Resoluciones de Inadmitidos",
        patrones: [
            "RESOLUCIONES DE INADMITIDOS",
            "RESOLUCIÓN DE INADMITIDOS",
            "RESOLUCION DE INADMITIDOS",
            "INADMISIÓN DE SOLICITUDES",
            "INADMISION DE SOLICITUDES",
            "SOLICITUDES INADMITIDAS"
        ]
    }
};

// Asegurar que existen las carpetas necesarias
function inicializarCarpetas() {
    try {
        // Crear carpeta base si no existe
        if (!fs.existsSync(BASE_DIR)) {
            fs.mkdirSync(BASE_DIR, { recursive: true });
            console.log(`[INFO] Creada carpeta base: ${BASE_DIR}`);
        }

        // Crear carpetas para cada tipo de resolución
        Object.values(TIPOS_RESOLUCION).forEach(tipo => {
            const carpeta = path.join(BASE_DIR, tipo.nombre);
            if (!fs.existsSync(carpeta)) {
                fs.mkdirSync(carpeta, { recursive: true });
                console.log(`[INFO] Creada carpeta para ${tipo.nombre}: ${carpeta}`);
            }
        });

        // Crear carpetas de descarga y procesamiento
        if (!fs.existsSync(DOWNLOAD_DIR)) {
            fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
            console.log(`[INFO] Creada carpeta de descargas: ${DOWNLOAD_DIR}`);
        }
        if (!fs.existsSync(PROCESSED_DIR)) {
            fs.mkdirSync(PROCESSED_DIR, { recursive: true });
            console.log(`[INFO] Creada carpeta de procesados: ${PROCESSED_DIR}`);
        }

        console.log('[INFO] Todas las carpetas inicializadas correctamente');
    } catch (error) {
        console.error('[ERROR] Error al inicializar carpetas:', error);
        throw error;
    }
}

// Extraer texto del PDF y determinar su tipo
async function analizarPDF(buffer) {
    try {
        console.log('[INFO] Analizando PDF...');
        
        // Cargar el PDF con pdf-parse
        const data = await pdfParse(buffer);
        
        // Extraer el texto completo
        let texto = data.text;
        console.log(`[DEBUG] Longitud total del texto extraído: ${texto.length} caracteres`);
        
        // Buscar el título de la resolución
        const tituloRegex = /RESOLUCIÓN DE (?:CONCESIÓN|DESISTIMIENTO|INADMISIÓN).*?(?=D\.|CONSIDERANDO|VISTO|EXPONE)/i;
        const match = texto.match(tituloRegex);
        if (match) {
            console.log('[DEBUG] Título encontrado:', match[0]);
        } else {
            console.log('[DEBUG] No se encontró el título en el texto');
        }
        
        // Buscar la sección de expedientes
        const seccionExpedientes = texto.match(/ANEXO.*?EXPEDIENTES.*?(?=ANEXO|$)/is);
        if (seccionExpedientes) {
            console.log('[DEBUG] Sección de expedientes encontrada');
            texto = seccionExpedientes[0];
        } else {
            console.log('[DEBUG] No se encontró la sección de expedientes, buscando en todo el texto');
        }
        
        // Limpiar el texto para análisis
        texto = texto
            .replace(/\n/g, ' ')  // Reemplazar saltos de línea por espacios
            .replace(/\s+/g, ' ') // Reemplazar múltiples espacios por uno solo
            .toUpperCase();
        
        // Eliminar la firma electrónica y códigos de verificación
        const firmaRegex = /CÓDIGO SEGURO DE VERIFICACIÓN.*?PÁGINA\d+\/\d+/gi;
        texto = texto.replace(firmaRegex, '');
        
        // Buscar expedientes en el texto
        const expedientes = extraerExpedientes(texto);
        
        if (expedientes.length === 0) {
            console.log('[WARN] El PDF no contiene expedientes válidos');
            return null;
        }
        
        console.log(`[INFO] Encontrados ${expedientes.length} expedientes en el PDF`);
        
        // Determinar el tipo de resolución
        const tipoResolucion = determinarTipoResolucion(texto);
        
        return {
            expedientes,
            tipoResolucion,
            texto
        };
        
    } catch (error) {
        console.error('[ERROR] Error al analizar PDF:', error);
        return null;
    }
}

function determinarTipoResolucion(texto) {
    console.log('[DEBUG] Determinando tipo de resolución...');
    
    // Buscar el tipo de resolución en el texto
    if (texto.includes('DESISTIMIENTO') || texto.includes('DESISTIDOS')) {
        console.log('[DEBUG] Tipo de resolución encontrado: DESISTIMIENTO');
        return {
            tipo: 'DESISTIMIENTO',
            nombre: 'Resoluciones de Desistimiento'
        };
    } else if (texto.includes('INADMISIÓN') || texto.includes('INADMISION')) {
        console.log('[DEBUG] Tipo de resolución encontrado: INADMISION');
        return {
            tipo: 'INADMISION',
            nombre: 'Resoluciones de Inadmisión'
        };
    } else if (texto.includes('CONCESIÓN') || texto.includes('CONCESION')) {
        console.log('[DEBUG] Tipo de resolución encontrado: CONCESION');
        return {
            tipo: 'CONCESION',
            nombre: 'Resoluciones de Concesión'
        };
    }
    
    console.log('[WARN] No se pudo determinar el tipo de resolución');
    return null;
}

// Extraer expedientes del texto
function extraerExpedientes(texto) {
    try {
        console.log('[DEBUG] Extrayendo expedientes del texto...');
        
        // Patrón para expedientes en formato tabla
        const tablaRegex = /(\d{4}\/C022\/\d{8})\s+(\d{2}\/\d{2}\/\d{4})\s+[\d.,]+\s*€/g;
        
        // Patrón para expedientes individuales
        const expedienteRegex = /(\d{4}\/C022\/\d{8})/g;
        
        // Conjunto para almacenar expedientes únicos
        const expedientes = new Set();
        
        // Primero intentar encontrar expedientes en formato tabla
        const matchesTabla = [...texto.matchAll(tablaRegex)];
        if (matchesTabla.length > 0) {
            console.log(`[DEBUG] Encontrados ${matchesTabla.length} expedientes en formato tabla`);
            matchesTabla.forEach(match => {
                const expediente = match[1];
                if (validarExpediente(expediente)) {
                    expedientes.add(expediente);
                }
            });
        }
        
        // Si no se encontraron expedientes en formato tabla, buscar individuales
        if (expedientes.size === 0) {
            console.log('[DEBUG] No se encontraron expedientes en formato tabla, buscando individuales');
            
            // Buscar expedientes individuales
            const matchesExpediente = [...texto.matchAll(expedienteRegex)];
            console.log(`[DEBUG] Encontrados ${matchesExpediente.length} posibles expedientes individuales`);
            
            matchesExpediente.forEach(match => {
                const expediente = match[1];
                if (validarExpediente(expediente)) {
                    expedientes.add(expediente);
                }
            });
        }
        
        // Convertir el conjunto a array
        const resultado = Array.from(expedientes);
        console.log(`[DEBUG] Total de expedientes únicos encontrados: ${resultado.length}`);
        
        return resultado;
    } catch (error) {
        console.error('[ERROR] Error al extraer expedientes:', error);
        return [];
    }
}

// Validar formato de expediente
function validarExpediente(expediente) {
    // Verificar formato básico YYYY/C022/NNNNNNNN
    const formatoBasico = /^\d{4}\/C022\/\d{8}$/;
    if (!formatoBasico.test(expediente)) {
        return false;
    }
    
    // Verificar que el año está entre 2000 y el año actual
    const año = parseInt(expediente.split('/')[0]);
    const añoActual = new Date().getFullYear();
    if (año < 2000 || año > añoActual) {
        return false;
    }
    
    return true;
}

// Descargar y procesar un PDF
async function descargarYProcesarPDF(url) {
    try {
        console.log(`[INFO] Descargando PDF desde: ${url}`);
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/pdf,application/x-pdf,application/octet-stream',
            'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
        };

        const response = await axios({
            method: 'GET',
            url,
            headers,
            responseType: 'arraybuffer'
        });

        console.log('[DEBUG] Respuesta recibida:', {
            status: response.status,
            headers: response.headers,
            contentType: response.headers['content-type']
        });

        // Verificar que es un PDF
        if (!response.headers['content-type']?.includes('application/pdf')) {
            console.warn('[WARN] El archivo descargado no es un PDF válido');
            return null;
        }

        // Analizar el contenido del PDF
        const analisis = await analizarPDF(response.data);
        if (!analisis) {
            console.warn('[WARN] No se pudo determinar el tipo de resolución');
            return null;
        }

        // Verificar si hay expedientes
        if (!analisis.expedientes || analisis.expedientes.length === 0) {
            console.warn('[WARN] El PDF no contiene expedientes válidos');
            return null;
        }

        console.log(`[INFO] Encontrados ${analisis.expedientes.length} expedientes en el PDF`);

        // Generar nombre único para el archivo
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const nombreArchivo = `${analisis.tipoResolucion.tipo}_${timestamp}.pdf`;
        const rutaArchivo = path.join(BASE_DIR, analisis.tipoResolucion.nombre, nombreArchivo);

        // Guardar el archivo en la carpeta correspondiente
        fs.writeFileSync(rutaArchivo, response.data);
        console.log(`[INFO] PDF guardado en: ${rutaArchivo}`);

        // Guardar expedientes en Supabase
        console.log(`[INFO] Guardando ${analisis.expedientes.length} expedientes en Supabase`);
        let expedientesGuardados = 0;
        
        for (const codigo of analisis.expedientes) {
            try {
                console.log(`[INFO] Procesando expediente: ${codigo}`);
                
                // Verificar si el expediente ya existe
                const { data: expedienteExistente, error: errorBusqueda } = await supabase
                    .from('expedientes')
                    .select('codigo_expediente')
                    .eq('codigo_expediente', codigo)
                    .single();

                const datosExpediente = {
                    codigo_expediente: codigo,
                    tipo_resolucion: analisis.tipoResolucion.tipo.toLowerCase(),
                    url_pdf: url,
                    fecha_procesamiento: new Date().toISOString()
                };

                // Si el error es PGRST116, significa que el expediente no existe
                if (errorBusqueda && errorBusqueda.code === 'PGRST116') {
                    console.log(`[INFO] Expediente ${codigo} no existe, procediendo a insertarlo`);
                    const { error: errorInsercion } = await supabase
                        .from('expedientes')
                        .insert([datosExpediente]);

                    if (errorInsercion) {
                        console.error(`[ERROR] Error al insertar expediente ${codigo}:`, errorInsercion);
                        continue;
                    }
                    expedientesGuardados++;
                } else if (errorBusqueda) {
                    // Si es otro tipo de error, lo registramos y continuamos
                    console.error(`[ERROR] Error inesperado al buscar expediente ${codigo}:`, errorBusqueda);
                    continue;
                } else if (expedienteExistente) {
                    // Si el expediente existe, lo actualizamos
                    console.log(`[INFO] Expediente ${codigo} ya existe, actualizando...`);
                    const { error: errorActualizacion } = await supabase
                        .from('expedientes')
                        .update(datosExpediente)
                        .eq('codigo_expediente', codigo);

                    if (errorActualizacion) {
                        console.error(`[ERROR] Error al actualizar expediente ${codigo}:`, errorActualizacion);
                        continue;
                    }
                    expedientesGuardados++;
                }
                
                expedientesGuardados++;
                console.log(`[INFO] Expediente ${codigo} guardado correctamente`);
            } catch (error) {
                console.error(`[ERROR] Error procesando expediente ${codigo}:`, error);
            }
        }

        console.log(`[INFO] Guardados ${expedientesGuardados} expedientes en Supabase`);
        
        return {
            tipo: analisis.tipoResolucion.tipo,
            ruta: rutaArchivo,
            expedientes: expedientesGuardados
        };
    } catch (error) {
        console.error(`[ERROR] Error procesando PDF de ${url}:`, error);
        if (error.response) {
            console.error('[ERROR] Status:', error.response.status);
            console.error('[ERROR] Headers:', error.response.headers);
        }
        return null;
    }
}

// Obtener enlaces de PDFs de la página
async function obtenerEnlacesPDF() {
    try {
        console.log('[INFO] Obteniendo enlaces de PDFs...');
        const baseUrl = process.env.PDF_DOWNLOAD_URL;
        console.log('[DEBUG] URL base:', baseUrl);

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
        };

        const response = await axios.get(baseUrl, { headers });
        console.log('[DEBUG] Respuesta recibida:', response.status);
        console.log('[DEBUG] Headers de respuesta:', response.headers);
        
        const $ = cheerio.load(response.data);
        const enlaces = new Set();

        // Buscar enlaces que contengan "obtenerBinarioDocumento"
        $('a').each((i, element) => {
            const href = $(element).attr('href');
            const onclick = $(element).attr('onclick');
            const texto = $(element).text().toLowerCase();
            
            console.log(`[DEBUG] Analizando enlace ${i + 1}:`, {
                href,
                onclick,
                texto
            });
            
            if (href && href.includes('obtenerBinarioDocumento')) {
                const url = new URL(href, baseUrl).href;
                enlaces.add(url);
                console.log('[DEBUG] Enlace encontrado (href):', url);
            }
            
            if (onclick && onclick.includes('obtenerBinarioDocumento')) {
                const match = onclick.match(/obtenerBinarioDocumento\/([^'"]+)/);
                if (match) {
                    const url = `${baseUrl}/obtenerBinarioDocumento/${match[1]}`;
                    enlaces.add(url);
                    console.log('[DEBUG] Enlace encontrado (onclick):', url);
                }
            }
            
            // Buscar enlaces que contengan palabras clave relacionadas con resoluciones
            if (texto.includes('resolución') || 
                texto.includes('concesión') || 
                texto.includes('ayuda') || 
                texto.includes('kit digital')) {
                const url = $(element).attr('href');
                if (url) {
                    const fullUrl = new URL(url, baseUrl).href;
                    enlaces.add(fullUrl);
                    console.log('[DEBUG] Enlace encontrado (texto):', fullUrl);
                }
            }
        });

        // Buscar enlaces en imágenes
        $('img').each((i, element) => {
            const src = $(element).attr('src');
            const title = $(element).attr('title');
            
            console.log(`[DEBUG] Analizando imagen ${i + 1}:`, {
                src,
                title
            });
            
            if (src && src.includes('obtenerBinarioDocumento')) {
                const url = new URL(src, baseUrl).href;
                enlaces.add(url);
                console.log('[DEBUG] Enlace encontrado (img src):', url);
            }
            
            if (title && title.includes('obtenerBinarioDocumento')) {
                const match = title.match(/obtenerBinarioDocumento\/([^'"]+)/);
                if (match) {
                    const url = `${baseUrl}/obtenerBinarioDocumento/${match[1]}`;
                    enlaces.add(url);
                    console.log('[DEBUG] Enlace encontrado (img title):', url);
                }
            }
        });

        // Buscar enlaces en tablas
        $('table tr').each((i, row) => {
            $(row).find('a').each((j, link) => {
                const href = $(link).attr('href');
                if (href) {
                    const url = new URL(href, baseUrl).href;
                    enlaces.add(url);
                    console.log('[DEBUG] Enlace encontrado (tabla):', url);
                }
            });
        });

        const enlacesArray = Array.from(enlaces);
        console.log(`[INFO] Total de enlaces encontrados: ${enlacesArray.length}`);
        console.log('[DEBUG] Enlaces encontrados:', enlacesArray);
        
        return enlacesArray;
    } catch (error) {
        console.error('[ERROR] Error al obtener enlaces:', error);
        if (error.response) {
            console.error('[ERROR] Status:', error.response.status);
            console.error('[ERROR] Headers:', error.response.headers);
        }
        return [];
    }
}

// Procesar todos los PDFs
async function procesarTodosPDFs() {
    try {
        inicializarCarpetas();
        
        const enlaces = await obtenerEnlacesPDF();
        console.log(`[INFO] Encontrados ${enlaces.length} enlaces de PDF`);
        
        const resultados = [];
        for (const url of enlaces) {
            const resultado = await descargarYProcesarPDF(url);
            if (resultado) {
                resultados.push({
                    url,
                    ...resultado
                });
            }
        }

        return {
            total: enlaces.length,
            procesados: resultados.length,
            resultados
        };
    } catch (error) {
        console.error('[ERROR] Error en el proceso principal:', error);
        throw error;
    }
}

// Obtener estadísticas
async function getStats() {
    try {
        console.log('[DEBUG] Obteniendo estadísticas de la base de datos...');
        
        // Obtener todos los expedientes de la base de datos usando paginación
        let todosLosExpedientes = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
            console.log(`[DEBUG] Obteniendo página ${page + 1} de expedientes...`);
            
            const { data: expedientes, error, count } = await supabase
                .from('expedientes')
                .select('*', { count: 'exact' })
                .order('fecha_procesamiento', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);
                
            if (error) {
                console.error('[ERROR] Error al obtener expedientes:', error);
                throw error;
            }
            
            if (expedientes && expedientes.length > 0) {
                todosLosExpedientes = [...todosLosExpedientes, ...expedientes];
                console.log(`[DEBUG] Obtenidos ${expedientes.length} expedientes en la página ${page + 1}`);
                
                // Verificar si hay más páginas
                if (expedientes.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }
        
        console.log(`[DEBUG] Total de expedientes en base de datos: ${todosLosExpedientes.length}`);
        
        // Contar expedientes por tipo
        const concedidos = todosLosExpedientes.filter(e => e.tipo_resolucion === 'concesion').length;
        const desistidos = todosLosExpedientes.filter(e => e.tipo_resolucion === 'desistimiento').length;
        const inadmitidos = todosLosExpedientes.filter(e => e.tipo_resolucion === 'inadmision').length;
        
        console.log('[DEBUG] Estadísticas calculadas:', {
            total: todosLosExpedientes.length,
            concedidos,
            desistidos,
            inadmitidos
        });
        
        return {
            totalExpedientes: todosLosExpedientes.length,
            enBaseDatos: todosLosExpedientes.length,
            concedidos: concedidos,
            desistidos: desistidos,
            inadmitidos: inadmitidos,
            otrosEstados: todosLosExpedientes.length - (concedidos + desistidos + inadmitidos)
        };
    } catch (error) {
        console.error('[ERROR] Error obteniendo estadísticas:', error);
        throw error;
    }
}

// Obtener expedientes filtrados
async function getExpedientesFiltrados({ mes, origen }) {
    try {
        let query = supabase
            .from('expedientes')
            .select('*');

        // Solo aplicar filtros si se proporcionan
        if (mes || origen) {
            if (mes) {
                const [year, month] = mes.split('-');
                const startDate = `${year}-${month}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const endDate = `${year}-${month}-${lastDay}`;
                
                query = query
                    .gte('fecha_procesamiento', startDate)
                    .lte('fecha_procesamiento', endDate);
            }
            
            if (origen) {
                query = query.eq('origen', origen);
            }
        }

        const { data: expedientes, error } = await query.order('fecha_procesamiento', { ascending: false });

        if (error) throw error;
        return expedientes;
    } catch (error) {
        console.error('Error obteniendo expedientes:', error);
        throw error;
    }
}

// Obtener datos para el gráfico
async function getChartData() {
    try {
        const expedientes = await getExpedientes();
        const tipos = {};
        
        expedientes.forEach(e => {
            tipos[e.tipo_resolucion] = (tipos[e.tipo_resolucion] || 0) + 1;
        });

        return Object.entries(tipos).map(([name, cantidad]) => ({
            name,
            cantidad
        }));
    } catch (error) {
        console.error('Error obteniendo datos del gráfico:', error);
        throw error;
    }
}

async function procesarPDFsExistentes() {
    try {
        console.log('[INFO] Procesando PDFs existentes...');
        inicializarCarpetas();
        
        const resultados = [];
        
        // Procesar cada tipo de resolución
        for (const [tipo, info] of Object.entries(TIPOS_RESOLUCION)) {
            const carpeta = path.join(BASE_DIR, info.nombre);
            if (!fs.existsSync(carpeta)) {
                console.log(`[INFO] No existe la carpeta ${carpeta}`);
                continue;
            }
            
            const archivos = fs.readdirSync(carpeta);
            console.log(`[INFO] Encontrados ${archivos.length} PDFs en ${info.nombre}`);
            
            for (const archivo of archivos) {
                if (!archivo.toLowerCase().endsWith('.pdf')) continue;
                
                const rutaArchivo = path.join(carpeta, archivo);
                console.log(`[INFO] Procesando ${rutaArchivo}`);
                
                try {
                    const buffer = fs.readFileSync(rutaArchivo);
                    const analisis = await analizarPDF(buffer);
                    
                    if (analisis) {
                        console.log(`[INFO] Encontrados ${analisis.expedientes.length} expedientes en ${archivo}`);
                        
                        // Guardar expedientes en Supabase
                        for (const codigo of analisis.expedientes) {
                            await insertExpediente({
                                codigo_expediente: codigo,
                                tipo_resolucion: tipo.toLowerCase(),
                                url_pdf: rutaArchivo,
                                fecha_procesamiento: new Date().toISOString()
                            });
                        }
                        
                        resultados.push({
                            archivo,
                            tipo: analisis.tipoResolucion.tipo,
                            expedientes: analisis.expedientes.length
                        });
                    }
                } catch (error) {
                    console.error(`[ERROR] Error procesando ${archivo}:`, error);
                }
            }
        }
        
        console.log(`[INFO] Procesados ${resultados.length} PDFs existentes`);
        return resultados;
    } catch (error) {
        console.error('[ERROR] Error procesando PDFs existentes:', error);
        throw error;
    }
}

// Función para procesar un PDF individual
async function procesarPDF(buffer) {
    try {
        console.log('[INFO] Procesando PDF...');
        const analisis = await analizarPDF(buffer);
        
        if (!analisis) {
            console.log('[WARN] No se pudo analizar el PDF');
            return null;
        }
        
        console.log(`[INFO] Encontrados ${analisis.expedientes.length} expedientes en el PDF`);
        
        // Guardar expedientes en Supabase
        console.log(`[INFO] Guardando ${analisis.expedientes.length} expedientes en Supabase`);
        let expedientesGuardados = 0;
        let expedientesNuevos = 0;
        let expedientesActualizados = 0;
        
        for (const codigo of analisis.expedientes) {
            try {
                console.log(`[INFO] Procesando expediente: ${codigo}`);
                
                // Verificar si el expediente ya existe
                const { data: expedienteExistente, error: errorBusqueda } = await supabase
                    .from('expedientes')
                    .select('codigo_expediente')
                    .eq('codigo_expediente', codigo)
                    .single();

                const datosExpediente = {
                    codigo_expediente: codigo,
                    tipo_resolucion: analisis.tipoResolucion.tipo.toLowerCase(),
                    url_pdf: 'subido_manualmente',
                    fecha_procesamiento: new Date().toISOString()
                };

                // Si el error es PGRST116, significa que el expediente no existe
                if (errorBusqueda && errorBusqueda.code === 'PGRST116') {
                    console.log(`[INFO] Expediente ${codigo} no existe, procediendo a insertarlo`);
                    const { error: errorInsercion } = await supabase
                        .from('expedientes')
                        .insert([datosExpediente]);

                    if (errorInsercion) {
                        console.error(`[ERROR] Error al insertar expediente ${codigo}:`, errorInsercion);
                        continue;
                    }
                    expedientesNuevos++;
                } else if (errorBusqueda) {
                    // Si es otro tipo de error, lo registramos y continuamos
                    console.error(`[ERROR] Error inesperado al buscar expediente ${codigo}:`, errorBusqueda);
                    continue;
                } else if (expedienteExistente) {
                    // Si el expediente existe, lo actualizamos
                    console.log(`[INFO] Expediente ${codigo} ya existe, actualizando...`);
                    const { error: errorActualizacion } = await supabase
                        .from('expedientes')
                        .update(datosExpediente)
                        .eq('codigo_expediente', codigo);

                    if (errorActualizacion) {
                        console.error(`[ERROR] Error al actualizar expediente ${codigo}:`, errorActualizacion);
                        continue;
                    }
                    expedientesActualizados++;
                }
                
                expedientesGuardados++;
                console.log(`[INFO] Expediente ${codigo} guardado correctamente`);
            } catch (error) {
                console.error(`[ERROR] Error procesando expediente ${codigo}:`, error);
            }
        }

        console.log(`[INFO] Guardados ${expedientesGuardados} expedientes en Supabase (${expedientesNuevos} nuevos, ${expedientesActualizados} actualizados)`);
        
        return {
            tipo: analisis.tipoResolucion.tipo,
            expedientes: expedientesGuardados,
            nuevos: expedientesNuevos,
            actualizados: expedientesActualizados,
            total: analisis.expedientes.length
        };
    } catch (error) {
        console.error('[ERROR] Error procesando PDF:', error);
        throw error;
    }
}

// Obtener los últimos 5 expedientes
async function getUltimosExpedientes() {
    try {
        console.log('[DEBUG] Obteniendo últimos 5 expedientes...');
        
        const { data, error } = await supabase
            .from('expedientes')
            .select('*')
            .order('fecha_procesamiento', { ascending: false })
            .limit(5);
            
        if (error) {
            console.error('[ERROR] Error al obtener últimos expedientes:', error);
            throw error;
        }
        
        console.log(`[DEBUG] Obtenidos ${data.length} últimos expedientes`);
        return data;
    } catch (error) {
        console.error('[ERROR] Error obteniendo últimos expedientes:', error);
        throw error;
    }
}

module.exports = { 
    procesarPDF, 
    procesarTodosPDFs,
    procesarPDFsExistentes,
    getStats,
    getExpedientesFiltrados,
    getChartData,
    getUltimosExpedientes
};