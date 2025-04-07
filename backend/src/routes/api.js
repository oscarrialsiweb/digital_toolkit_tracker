require('dotenv').config();
const express = require('express');
const router = express.Router();
const pdfService = require('../services/pdfService');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const { supabase } = require('../lib/supabase');

// Obtener estadísticas generales
router.get('/stats', async (req, res) => {
  try {
    const stats = await pdfService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Obtener expedientes filtrados
router.get('/expedientes', async (req, res) => {
  try {
    const { mes, origen } = req.query;
    const expedientes = await pdfService.getExpedientesFiltrados({ mes, origen });
    res.json(expedientes);
  } catch (error) {
    console.error('Error al obtener expedientes:', error);
    res.status(500).json({ error: 'Error al obtener expedientes' });
  }
});

// Subir PDF manualmente
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
    }

    // Leer el archivo como buffer
    const buffer = fs.readFileSync(req.file.path);
    
    // Procesar el PDF con el buffer
    const result = await pdfService.procesarPDF(buffer);
    
    // Eliminar el archivo temporal
    fs.unlinkSync(req.file.path);
    
    if (!result) {
      return res.status(400).json({ error: 'No se pudieron extraer expedientes del PDF' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error al subir PDF:', error);
    res.status(500).json({ error: 'Error al procesar el PDF' });
  }
});

// Buscar y descargar nuevos PDFs
router.post('/update-pdfs', async (req, res) => {
  try {
    console.log('Iniciando búsqueda de nuevos PDFs...');
    const resultado = await pdfService.procesarTodosPDFs();
    console.log(`Proceso completado: ${resultado.procesados} PDFs procesados de ${resultado.total}`);
    res.json(resultado);
  } catch (error) {
    console.error('Error al actualizar PDFs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener datos para el gráfico
router.get('/chart-data', async (req, res) => {
  try {
    const chartData = await pdfService.getChartData();
    res.json(chartData);
  } catch (error) {
    console.error('Error al obtener datos del gráfico:', error);
    res.status(500).json({ error: 'Error al obtener datos del gráfico' });
  }
});

// Obtener últimos 5 expedientes
router.get('/ultimos-expedientes', async (req, res) => {
  try {
    const ultimosExp = await pdfService.getUltimosExpedientes();
    res.json(ultimosExp);
  } catch (error) {
    console.error('Error al obtener últimos expedientes:', error);
    res.status(500).json({ error: 'Error al obtener últimos expedientes' });
  }
});

// Endpoint para obtener los clientes
router.get('/clientes', async (req, res) => {
  try {
    const { mes, origen } = req.query;
    
    // Primero obtenemos los clientes
    let query = supabase
      .from('clientes')
      .select('*');

    // Aplicar filtros si están presentes
    if (mes) {
      const [year, month] = mes.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;
      
      query = query
        .gte('fecha_creacion', startDate)
        .lte('fecha_creacion', endDate);
    }
    
    if (origen) {
      query = query.eq('origen', origen);
    }

    // Ordenar por fecha de creación
    query = query.order('fecha_creacion', { ascending: false });
    
    const { data: clientes, error: errorClientes } = await query;
    
    if (errorClientes) throw errorClientes;

    console.log('[DEBUG] Clientes obtenidos:', clientes);

    // Obtener los códigos de expediente de los clientes
    const codigosExpedientes = clientes
      .map(cliente => cliente.codigo_expediente)
      .filter(codigo => codigo); // Filtrar valores nulos o undefined

    console.log('[DEBUG] Códigos de expedientes a buscar:', codigosExpedientes);

    // Obtener los expedientes correspondientes
    const { data: expedientes, error: errorExpedientes } = await supabase
      .from('expedientes')
      .select('codigo_expediente, tipo_resolucion')
      .in('codigo_expediente', codigosExpedientes);

    if (errorExpedientes) throw errorExpedientes;

    console.log('[DEBUG] Expedientes encontrados:', expedientes);

    // Crear un mapa de expedientes
    const expedientesMap = expedientes.reduce((acc, exp) => {
      acc[exp.codigo_expediente] = exp.tipo_resolucion;
      return acc;
    }, {});

    console.log('[DEBUG] Mapa de expedientes:', expedientesMap);

    // Transformar los datos para incluir el estado del expediente
    const transformedData = clientes.map(cliente => {
      const estado = expedientesMap[cliente.codigo_expediente];
      console.log(`[DEBUG] Cliente ${cliente.codigo_expediente} -> Estado: ${estado || 'No encontrado'}`);
      return {
        ...cliente,
        estado: estado || 'No encontrado'
      };
    });
    
    res.json(transformedData);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

module.exports = router; 