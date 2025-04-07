const { supabase } = require('../config/supabaseClient');

async function crearTabla() {
    try {
        console.log('[INFO] Creando tabla expedientes...');
        const { error } = await supabase.rpc('crear_tabla_expedientes', {
            codigo_expediente: 'codigo_expediente'
        });
        
        if (error) {
            // Si el error es porque la tabla ya existe, lo ignoramos
            if (error.message.includes('already exists')) {
                console.log('[INFO] La tabla expedientes ya existe');
                return true;
            }
            throw error;
        }
        
        console.log('[INFO] Tabla expedientes creada correctamente');
        return true;
    } catch (error) {
        console.error('[ERROR] Error al crear la tabla:', error.message);
        return false;
    }
}

async function main() {
    try {
        // Verificar conexión
        console.log('[INFO] Verificando conexión con Supabase...');
        const { data, error } = await supabase
            .from('expedientes')
            .select('count')
            .limit(1);
        
        if (error) {
            // Si el error es porque la tabla no existe, la creamos
            if (error.message.includes('relation "expedientes" does not exist')) {
                console.log('[INFO] La tabla expedientes no existe, procediendo a crearla...');
                const creada = await crearTabla();
                if (!creada) {
                    console.error('[ERROR] No se pudo crear la tabla');
                    process.exit(1);
                }
            } else {
                throw error;
            }
        }
        
        console.log('[INFO] Conexión a Supabase establecida correctamente');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error en el proceso principal:', error.message);
        process.exit(1);
    }
}

main();

module.exports = {
    crearTabla
}; 