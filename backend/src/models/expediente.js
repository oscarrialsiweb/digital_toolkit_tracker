const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Expediente = sequelize.define('Expediente', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombreArchivo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tipo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    estado: {
        type: DataTypes.STRING
    },
    fechaDescarga: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    origen: {
        type: DataTypes.STRING
    },
    mes: {
        type: DataTypes.STRING
    }
});

// Sincronizar el modelo con la base de datos
sequelize.sync()
    .then(() => {
        console.log('Tabla Expediente sincronizada');
    })
    .catch(err => {
        console.error('Error al sincronizar tabla Expediente:', err);
    });

module.exports = Expediente;
