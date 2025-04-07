const { supabase } = require('../config/supabaseClient');

async function modificarTablaClientes() {
    try {
        console.log('[INFO] Iniciando modificación de la tabla clientes...');

        // 1. Verificar si la columna estado existe
        const { data: columnas, error: errorColumnas } = await supabase
            .rpc('get_table_columns', { table_name: 'clientes' });

        if (errorColumnas) {
            console.error('[ERROR] Error al obtener columnas:', errorColumnas);
            throw errorColumnas;
        }

        const tieneEstado = columnas.some(col => col.column_name === 'estado');
        
        if (!tieneEstado) {
            console.log('[INFO] La columna estado ya no existe en la tabla clientes');
            return true;
        }

        // 2. Eliminar la columna estado
        const { error: errorEliminar } = await supabase
            .rpc('eliminar_columna_estado');

        if (errorEliminar) {
            console.error('[ERROR] Error al eliminar la columna estado:', errorEliminar);
            throw errorEliminar;
        }

        console.log('[INFO] Columna estado eliminada correctamente');
        return true;
    } catch (error) {
        console.error('[ERROR] Error en el proceso:', error.message);
        return false;
    }
}

async function main() {
    try {
        console.log('[INFO] Verificando conexión con Supabase...');
        const { data, error } = await supabase
            .from('clientes')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('[ERROR] No se pudo establecer conexión con Supabase');
            process.exit(1);
        }

        console.log('[INFO] Conexión establecida, procediendo con la modificación...');
        const resultado = await modificarTablaClientes();
        
        if (resultado) {
            console.log('[INFO] Modificación completada exitosamente');
            process.exit(0);
        } else {
            console.error('[ERROR] La modificación no se pudo completar');
            process.exit(1);
        }
    } catch (error) {
        console.error('[ERROR] Error en el proceso principal:', error.message);
        process.exit(1);
    }
}

// Ejecutar el script
main(); 