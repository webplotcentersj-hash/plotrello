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
        // San Juan, Argentina
        const response = await fetch(
          'https://wttr.in/San%20Juan,Argentina?format=j1&lang=es',
          {
            headers: {
              'Accept': 'application/json'
            }
          }
        )
        
        if (!response.ok) {
          throw new Error('No se pudo obtener el clima')
        }
        
        const data = await response.json()
        
        // wttr.in estructura: data.current_condition[0]
        const current = data.current_condition[0]
        
        setWeather({
          temp: parseInt(current.temp_C),
          description: current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || 'Despejado',
          icon: current.weatherCode || '',
          loading: false,
          error: null
        })
      } catch (error) {
        // Si falla la API, mostrar datos por defecto
        console.warn('Error al obtener clima:', error)
        setWeather({
          temp: 25, // Temperatura promedio de San Juan
          description: 'Clima no disponible',
          icon: '',
          loading: false,
          error: null
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
        <div className="weather-error">🌤️ --°C</div>
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

