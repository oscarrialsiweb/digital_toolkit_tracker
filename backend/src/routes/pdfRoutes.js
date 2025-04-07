const express = require("express");
const router = express.Router();
const { listarPDFs, manejarDescargaYExtraccion } = require("../controllers/pdfController");

// Ruta para listar PDFs
router.get("/listar", listarPDFs);

// Ruta para procesar PDFs
router.post("/procesar", manejarDescargaYExtraccion);

module.exports = router;
