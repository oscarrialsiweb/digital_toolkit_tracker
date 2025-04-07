const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const BASE_DIR = path.join(__dirname, '../../pdfs');

const CARPETAS = {
    CONCESION: {
        nombre: "Resoluciones de Concesión",
        patrones: ["RESOLUCIÓN DE CONCESIÓN", "RESOLUCION DE CONCESION"]
    },
    DESISTIDOS: {
        nombre: "Resoluciones de Desistidos",
        patrones: ["RESOLUCIÓN DE DESISTIDOS", "RESOLUCION DE DESISTIDOS"]
    },
    DESISTIMIENTO: {
        nombre: "Resoluciones de Desistimiento Expreso",
        patrones: ["RESOLUCIÓN DE DESISTIMIENTO EXPRESO", "RESOLUCION DE DESISTIMIENTO EXPRESO", "RENUNCIA A LA SOLICITUD"]
    },
    INADMITIDOS: {
        nombre: "Resoluciones de Inadmitidos",
        patrones: ["RESOLUCIÓN DE INADMITIDOS", "RESOLUCION DE INADMITIDOS"]
    }
};

// Función para crear las carpetas si no existen
function crearCarpetas() {
    console.log("[INFO] Creando carpetas necesarias...");
    Object.values(CARPETAS).forEach(carpeta => {
        const carpetaPath = path.join(BASE_DIR, carpeta.nombre);
        if (!fs.existsSync(carpetaPath)) {
            fs.mkdirSync(carpetaPath, { recursive: true });
            console.log(`[INFO] Carpeta creada: ${carpeta.nombre}`);
        }
    });
}

// Función para determinar el tipo de resolución basado en el contenido
async function determinarTipoResolucion(filePath) {
    try {
        console.log(`[INFO] Analizando documento: ${filePath}`);
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        const text = data.text.toUpperCase();
        console.log(`[DEBUG] Analizando texto del documento...`);

        // Buscar coincidencias exactas con los patrones
        for (const [key, carpeta] of Object.entries(CARPETAS)) {
            for (const patron of carpeta.patrones) {
                if (text.includes(patron.toUpperCase())) {
                    console.log(`[INFO] Documento identificado como: ${carpeta.nombre}`);
                    return carpeta.nombre;
                }
            }
        }
        
        console.log('[WARN] No se encontró coincidencia con ningún tipo de resolución');
        return null;
    } catch (error) {
        console.error(`[ERROR] Error al determinar el tipo de resolución para ${filePath}:`, error);
        return null;
    }
}

// Función para organizar los PDFs
async function organizarPDFs() {
    try {
        crearCarpetas();
        
        // Obtener lista de archivos en la carpeta base
        const archivos = fs.readdirSync(BASE_DIR);
        const pdfs = archivos.filter(archivo => 
            archivo.toLowerCase().endsWith('.pdf') && 
            fs.statSync(path.join(BASE_DIR, archivo)).isFile()
        );
        
        console.log(`[INFO] Se encontraron ${pdfs.length} archivos PDF para organizar`);
        
        for (const pdf of pdfs) {
            const rutaActual = path.join(BASE_DIR, pdf);
            const tipo = await determinarTipoResolucion(rutaActual);
            
            if (tipo) {
                const rutaDestino = path.join(BASE_DIR, tipo, pdf);
                fs.renameSync(rutaActual, rutaDestino);
                console.log(`[INFO] Movido ${pdf} a ${tipo}`);
            } else {
                console.log(`[WARN] No se pudo clasificar ${pdf}, se mantiene en la carpeta base`);
            }
        }
        
        console.log('[INFO] Proceso de organización completado');
        return {
            mensaje: "PDFs organizados correctamente",
            totalProcesados: pdfs.length
        };
    } catch (error) {
        console.error('[ERROR] Error al organizar PDFs:', error);
        throw error;
    }
}

module.exports = {
    organizarPDFs
}; 