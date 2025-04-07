import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
})

export const getStats = async () => {
  try {
    const response = await api.get('/stats')
    return response.data
  } catch (error) {
    console.error('Error fetching stats:', error)
    throw error
  }
}

export const getExpedientes = async (filters = null) => {
  try {
    const response = await api.get('/expedientes', { 
      params: filters || {} 
    })
    return response.data
  } catch (error) {
    console.error('Error fetching expedientes:', error)
    throw error
  }
}

export const uploadPDF = async (file) => {
  try {
    const formData = new FormData()
    formData.append('pdf', file)
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  } catch (error) {
    console.error('Error uploading PDF:', error)
    throw error
  }
}

export const getChartData = async () => {
  try {
    const response = await api.get('/chart-data')
    return response.data
  } catch (error) {
    console.error('Error fetching chart data:', error)
    throw error
  }
}

export const getUltimosExpedientes = async () => {
  try {
    const response = await api.get('/ultimos-expedientes')
    return response.data
  } catch (error) {
    console.error('Error fetching últimos expedientes:', error)
    throw error
  }
}

export const getClientes = async (filters) => {
  try {
    const response = await api.get('/clientes', { params: filters })
    return response.data
  } catch (error) {
    console.error('Error fetching clientes:', error)
    throw error
  }
} 