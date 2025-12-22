import { useState, useEffect } from 'react'
import './WeatherWidget.css'

interface WeatherData {
  temp: number
  description: string
  icon: string
  loading: boolean
  error: string | null
}

const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData>({
    temp: 0,
    description: '',
    icon: '',
    loading: true,
    error: null
  })

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Usar wttr.in API (pública y gratuita, sin API key)
        // San Juan, Argentina - Usar coordenadas específicas para evitar ambigüedad
        // Coordenadas: -31.5375° S, -68.5364° W (San Juan Capital, Argentina)
        const response = await fetch(
          'https://wttr.in/-31.5375,-68.5364?format=j1&lang=es',
          {
            headers: {
              'Accept': 'application/json'
            }
          }
        )
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: No se pudo obtener el clima`)
        }
        
        const data = await response.json()
        console.log('🌤️ Datos del clima recibidos:', data)
        
        // wttr.in estructura: data.current_condition[0]
        const current = data.current_condition?.[0]
        
        if (!current) {
          console.error('❌ No se encontró current_condition en la respuesta:', data)
          throw new Error('Formato de respuesta inválido')
        }
        
        // Obtener temperatura - puede venir como string o number
        const tempC = current.temp_C || current.tempC || current.temp
        console.log('🌡️ Temperatura raw:', tempC, 'tipo:', typeof tempC)
        
        const temperatura = typeof tempC === 'string' ? parseInt(tempC, 10) : Math.round(Number(tempC))
        
        // Validar que la temperatura sea un número válido
        if (isNaN(temperatura) || temperatura < -50 || temperatura > 60) {
          console.error('❌ Temperatura inválida:', temperatura)
          throw new Error(`Temperatura inválida: ${temperatura}°C`)
        }
        
        console.log('✅ Temperatura procesada:', temperatura, '°C')
        
        setWeather({
          temp: temperatura,
          description: current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || current.condition || 'Despejado',
          icon: current.weatherCode || current.code || '',
          loading: false,
          error: null
        })
      } catch (error) {
        // Si falla la API, mostrar datos por defecto
        console.error('❌ Error al obtener clima:', error)
        setWeather({
          temp: 0,
          description: 'Clima no disponible',
          icon: '',
          loading: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }

    fetchWeather()
    
    // Actualizar cada 10 minutos
    const interval = setInterval(fetchWeather, 10 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  const getWeatherIcon = (icon: string) => {
    if (!icon) return '🌤️'
    // Mapear códigos de wttr.in a emojis (códigos numéricos)
    const code = parseInt(icon)
    if (code >= 113 && code <= 116) return '☀️' // Clear/Sunny
    if (code >= 119 && code <= 122) return '☁️' // Cloudy
    if (code >= 143 && code <= 248) return '🌫️' // Fog/Mist
    if (code >= 260 && code <= 263) return '🌧️' // Light rain
    if (code >= 266 && code <= 299) return '🌦️' // Rain
    if (code >= 300 && code <= 321) return '🌧️' // Drizzle
    if (code >= 386 && code <= 395) return '⛈️' // Thunderstorm
    if (code >= 392 && code <= 395) return '⛈️' // Thunderstorm with rain
    if (code >= 227 && code <= 230) return '❄️' // Snow
    return '🌤️' // Default
  }

  if (weather.loading) {
    return (
      <div className="weather-widget">
        <div className="weather-loading">Cargando clima...</div>
      </div>
    )
  }

  if (weather.error) {
    return (
      <div className="weather-widget">
        <div className="weather-error" title={weather.error}>🌤️ --°C</div>
        <div className="weather-location">San Juan, AR</div>
      </div>
    )
  }
  
  // Si la temperatura es 0 y no está cargando, probablemente hay un error
  if (weather.temp === 0 && !weather.loading) {
    return (
      <div className="weather-widget">
        <div className="weather-error" title="No se pudo obtener la temperatura">🌤️ --°C</div>
        <div className="weather-location">San Juan, AR</div>
      </div>
    )
  }

  return (
    <div className="weather-widget">
      <div className="weather-icon">{getWeatherIcon(weather.icon)}</div>
      <div className="weather-info">
        <div className="weather-temp">{weather.temp}°C</div>
        <div className="weather-description">{weather.description}</div>
        <div className="weather-location">San Juan, AR</div>
      </div>
    </div>
  )
}

export default WeatherWidget

