const { obtenerEnlacesPDF, descargarPDF, extraerTablasDesdePDF, TIPOS_RESOLUCION } = require("../services/pdfService");
const path = require("path");

async function listarPDFs(req, res) {
    try {
        const enlaces = await obtenerEnlacesPDF();
        res.json({ 
            mensaje: "Enlaces obtenidos exitosamente", 
            total: enlaces.length,
            tiposEncontrados: [...new Set(enlaces.map(e => e.tipo))],
            enlaces 
        });
    } catch (error) {
        console.error("Error al obtener los enlaces:", error);
        res.status(500).json({ mensaje: error.message });
    }
}

async function manejarDescargaYExtraccion(req, res) {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ mensaje: "Debe proporcionar la URL del PDF." });
        }

        // Descargar el PDF
        const rutaPDF = await descargarPDF(url);
        
        // Extraer tablas del PDF
        const resultado = await extraerTablasDesdePDF(rutaPDF);

        // Preparar respuesta
        const respuesta = {
            mensaje: "PDF procesado exitosamente",
            archivo: path.basename(rutaPDF),
            totalTablas: resultado.tablas.length,
            tablas: resultado.tablas,
            metadata: resultado.metadata
        };

        res.json(respuesta);
    } catch (error) {
        console.error("Error en el procesamiento:", error);
        res.status(500).json({ mensaje: error.message });
    }
}

module.exports = { listarPDFs, manejarDescargaYExtraccion };
