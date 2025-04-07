require('dotenv').config();
const express = require("express");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Aquí agregas las rutas
const pdfRoutes = require("./routes/pdfRoutes");

// Rutas directamente sin prefijo '/api/pdf'
app.use("/pdf", pdfRoutes);

module.exports = app;
