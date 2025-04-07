const { organizarPDFs } = require('../utils/pdfOrganizer');

async function main() {
    try {
        console.log('[INFO] Iniciando proceso de organización de PDFs...');
        const resultado = await organizarPDFs();
        console.log('[INFO] Proceso completado:', resultado);
    } catch (error) {
        console.error('[ERROR] Error en el proceso principal:', error);
    }
}

main(); 