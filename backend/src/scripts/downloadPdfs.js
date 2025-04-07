require('dotenv').config();
const { procesarTodosPDFs } = require('../services/pdfService');
const { verificarConexion } = require('../config/supabaseClient');

async function main() {
    try {
        console.log('[INFO] Verificando conexión con Supabase...');
        const conexionOk = await verificarConexion();
        if (!conexionOk) {
            console.error('[ERROR] No se pudo establecer conexión con Supabase');
            process.exit(1);
        }

        console.log('[INFO] Iniciando descarga y procesamiento de PDFs...');
        const resultado = await procesarTodosPDFs();
        console.log('[INFO] Proceso completado:');
        console.log(`Total de PDFs encontrados: ${resultado.total}`);
        console.log(`PDFs procesados exitosamente: ${resultado.procesados}`);
        console.log('\nDetalles por PDF:');
        resultado.resultados.forEach(r => {
            console.log(`\nTipo: ${r.tipo}`);
            console.log(`Ruta: ${r.ruta}`);
            console.log(`Expedientes encontrados: ${r.expedientes}`);
        });
    } catch (error) {
        console.error('[ERROR] Error en el proceso principal:', error);
        process.exit(1);
    }
}

main(); 