const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
const envPath = path.join(__dirname, '../../.env');
console.log('[DEBUG] Intentando cargar .env desde:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('[ERROR] Error al cargar .env:', result.error);
} else {
    console.log('[INFO] Archivo .env cargado correctamente');
}

// Verificar variables de entorno
console.log('[DEBUG] SUPABASE_URL:', process.env.SUPABASE_URL ? 'Definida' : 'No definida');
console.log('[DEBUG] SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Definida' : 'No definida');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Las variables de entorno SUPABASE_URL y SUPABASE_KEY son requeridas');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Función para verificar la conexión
async function verificarConexion() {
    try {
        const { data, error } = await supabase
            .from('expedientes')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        console.log('[INFO] Conexión a Supabase establecida correctamente');
        return true;
    } catch (error) {
        console.error('[ERROR] Error al conectar con Supabase:', error.message);
        return false;
    }
}

// Función para insertar un expediente
async function insertExpediente(expediente) {
    try {
        console.log('[DEBUG] Insertando expediente:', expediente);
        
        // Asegurarnos de que el tipo_resolucion esté en minúsculas
        const datosExpediente = {
            ...expediente,
            codigo_expediente: expediente.codigo_expediente,
            tipo_resolucion: expediente.tipo_resolucion.toLowerCase(),
            fecha_procesamiento: expediente.fecha_procesamiento || new Date().toISOString()
        };

        // Verificar si el expediente ya existe
        const { data: existente, error: errorBusqueda } = await supabase
            .from('expedientes')
            .select('codigo_expediente')
            .eq('codigo_expediente', datosExpediente.codigo_expediente)
            .single();

        if (errorBusqueda && errorBusqueda.code !== 'PGRST116') {
            throw errorBusqueda;
        }

        let resultado;
        if (existente) {
            // Actualizar el expediente existente
            const { data, error } = await supabase
                .from('expedientes')
                .update(datosExpediente)
                .eq('codigo_expediente', datosExpediente.codigo_expediente)
                .select();

            if (error) throw error;
            resultado = data[0];
        } else {
            // Insertar nuevo expediente
            const { data, error } = await supabase
                .from('expedientes')
                .insert([datosExpediente])
                .select();

            if (error) throw error;
            resultado = data[0];
        }

        console.log('[DEBUG] Expediente guardado:', resultado);
        return resultado;
    } catch (error) {
        console.error('[ERROR] Error al insertar expediente:', error.message);
        throw error;
    }
}

// Función para obtener todos los expedientes
async function getExpedientes() {
    try {
        const { data, error } = await supabase
            .from('expedientes')
            .select('*')
            .order('fecha_procesamiento', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[ERROR] Error al obtener expedientes:', error.message);
        throw error;
    }
}

// Función para obtener expedientes por tipo
async function getExpedientesByType(type) {
    try {
        const { data, error } = await supabase
            .from('expedientes')
            .select('*')
            .eq('tipo_resolucion', type)
            .order('fecha_procesamiento', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[ERROR] Error al obtener expedientes por tipo:', error.message);
        throw error;
    }
}

module.exports = {
    supabase,
    verificarConexion,
    insertExpediente,
    getExpedientes,
    getExpedientesByType
}; 