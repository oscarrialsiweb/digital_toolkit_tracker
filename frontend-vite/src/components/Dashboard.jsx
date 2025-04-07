import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { getStats, getExpedientes, uploadPDF, getChartData, getUltimosExpedientes, getClientes } from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalExpedientes: 0,
    enBaseDatos: 0,
    concedidos: 0,
    desistidos: 0,
    inadmitidos: 0,
    otrosEstados: 0,
  });

  const [filters, setFilters] = useState({
    mes: '',
    origen: '',
  });

  const [chartData, setChartData] = useState([]);
  const [ultimosExpedientes, setUltimosExpedientes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [clientesEnBaseDatos, setClientesEnBaseDatos] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const statsData = await getStats();
      setStats(statsData);

      const chartData = await getChartData();
      setChartData(chartData);

      const ultimosExp = await getUltimosExpedientes();
      setUltimosExpedientes(ultimosExp);

      const clientesData = await getClientes(filters);
      setClientes(clientesData);

      // Calcular clientes en base de datos
      const clientesEnBD = clientesData.filter(cliente => cliente.estado !== 'No encontrado').length;
      setClientesEnBaseDatos(clientesEnBD);
      
    } catch (err) {
      setError('Error al cargar los datos. Por favor, intente nuevamente.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUpdateStatus('Subiendo archivo...');
      const formData = new FormData();
      formData.append('pdf', file);
      
      await uploadPDF(formData);
      setUpdateStatus('Archivo procesado correctamente');
      loadData();
    } catch (err) {
      setUpdateStatus('Error al procesar el archivo');
      console.error('Error:', err);
    }
  };

  const handleBuscarPDFs = async () => {
    try {
      setUpdateStatus('Buscando nuevos PDFs...');
      await fetch('http://localhost:3001/api/update-pdfs', {
        method: 'POST',
      });
      setUpdateStatus('Búsqueda completada');
      loadData();
    } catch (err) {
      setUpdateStatus('Error al buscar PDFs');
      console.error('Error:', err);
    }
  };

  const handleSearch = async () => {
    try {
      setIsSearching(true);
      // Asegurarnos de que el mes es válido
      let searchFilters = { ...filters };
      if (searchFilters.mes) {
        const [year, month] = searchFilters.mes.split('-');
        const lastDay = new Date(year, month, 0).getDate();
        // Formato: YYYY-MM-DD
        searchFilters.mes = `${year}-${month}-01`;
      }
      // Normalizar el origen
      if (searchFilters.origen === 'Península') {
        searchFilters.origen = 'peninsula';
      } else if (searchFilters.origen === 'Canarias') {
        searchFilters.origen = 'canarias';
      }
      
      const clientesData = await getClientes(searchFilters);
      setClientes(clientesData);
    } catch (err) {
      setError('Error al buscar clientes. Por favor, intente nuevamente.');
      console.error('Error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const calcularPorcentaje = (valor, total) => {
    if (total === 0) return 0;
    return ((valor / total) * 100).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-700">Cargando datos...</p>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-8">
        {/* Panel Superior: Estadísticas y Acciones */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Estadísticas */}
            <div className="col-span-3 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600">Total Expedientes</h3>
                <p className="text-2xl font-bold text-gray-700">{stats.totalExpedientes}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-green-600">Nuestros Clientes</h3>
                <p className="text-2xl font-bold text-green-700">{clientesEnBaseDatos}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-600">Concedidos</h3>
                <p className="text-2xl font-bold text-blue-700">{stats.concedidos}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-red-600">Desistidos</h3>
                <p className="text-2xl font-bold text-red-700">{stats.desistidos}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-600">Inadmitidos</h3>
                <p className="text-2xl font-bold text-yellow-700">{stats.inadmitidos}</p>
              </div>
            </div>
            
            {/* Botones de Acción */}
            <div className="col-span-1 flex flex-col gap-3">
              <button
                onClick={handleBuscarPDFs}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Buscar Nuevos PDFs
              </button>
              <label className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Subir PDF Manualmente
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Panel Medio: Distribución y Últimos Expedientes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Distribución de Expedientes */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Expedientes</h2>
            <div className="space-y-4">
              <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full bg-blue-400"
                  style={{ width: `${calcularPorcentaje(stats.concedidos, stats.totalExpedientes)}%` }}
                ></div>
                <div 
                  className="absolute top-0 h-full bg-red-500"
                  style={{ 
                    left: `${calcularPorcentaje(stats.concedidos, stats.totalExpedientes)}%`,
                    width: `${calcularPorcentaje(stats.desistidos, stats.totalExpedientes)}%`
                  }}
                ></div>
                <div 
                  className="absolute top-0 h-full bg-yellow-500"
                  style={{ 
                    left: `${calcularPorcentaje(stats.concedidos + stats.desistidos, stats.totalExpedientes)}%`,
                    width: `${calcularPorcentaje(stats.inadmitidos, stats.totalExpedientes)}%`
                  }}
                ></div>
                <div 
                  className="absolute top-0 h-full bg-gray-500"
                  style={{ 
                    left: `${calcularPorcentaje(stats.concedidos + stats.desistidos + stats.inadmitidos, stats.totalExpedientes)}%`,
                    width: `${calcularPorcentaje(stats.otrosEstados, stats.totalExpedientes)}%`
                  }}
                ></div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-400 mr-2"></div>
                  <span className="text-blue-600">Concedidos: {calcularPorcentaje(stats.concedidos, stats.totalExpedientes)}%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-red-600">Desistidos: {calcularPorcentaje(stats.desistidos, stats.totalExpedientes)}%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                  <span className="text-yellow-600">Inadmitidos: {calcularPorcentaje(stats.inadmitidos, stats.totalExpedientes)}%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-gray-500 mr-2"></div>
                  <span className="text-gray-600">Otros: {calcularPorcentaje(stats.otrosEstados, stats.totalExpedientes)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Últimos Expedientes */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Últimos Expedientes Añadidos</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Expediente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Resolución</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ultimosExpedientes.map((expediente) => (
                    <tr key={expediente.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{expediente.codigo_expediente}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          expediente.tipo_resolucion === 'concesion' ? 'bg-green-100 text-green-800' :
                          expediente.tipo_resolucion === 'desistimiento' ? 'bg-red-100 text-red-800' :
                          expediente.tipo_resolucion === 'inadmision' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {expediente.tipo_resolucion.charAt(0).toUpperCase() + expediente.tipo_resolucion.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(expediente.fecha_procesamiento).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Panel Inferior: Lista de Clientes */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Lista de Clientes</h2>
            <div className="flex gap-4">
              <div>
                <label htmlFor="mes" className="block text-sm font-medium text-gray-700">Mes</label>
                <input
                  type="month"
                  id="mes"
                  name="mes"
                  value={filters.mes}
                  onChange={handleFilterChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-600 focus:ring-blue-600 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="origen" className="block text-sm font-medium text-gray-700">Origen</label>
                <select
                  id="origen"
                  name="origen"
                  value={filters.origen}
                  onChange={handleFilterChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-600 focus:ring-blue-600 sm:text-sm"
                >
                  <option value="">Todas</option>
                  <option value="peninsula">Península</option>
                  <option value="canarias">Canarias</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${isSearching ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSearching ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Buscando...
                    </span>
                  ) : 'Buscar'}
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Expediente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Creación</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cliente.codigo_expediente}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cliente.nombre}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cliente.nif}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cliente.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cliente.telefono}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cliente.estado || 'No encontrado'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cliente.origen}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(cliente.fecha_creacion).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 