/**
 * 天气 API — Open-Meteo（免费，无需 Key，全球覆盖）
 *
 * 文档: https://open-meteo.com/en/docs
 *
 * 返回当前天气 + 简要评分，用于提示户外出行适宜度
 */

/**
 * 天气图标映射 (emoji) + 条件描述
 */
const WEATHER_CODES = {
  0:  { emoji: '☀️',  label: '晴',           score: 5, tip: '天气完美，尽情出发吧！' },
  1:  { emoji: '🌤️', label: '大部晴',        score: 5, tip: '好天气，适合出门走走' },
  2:  { emoji: '⛅',  label: '多云',          score: 4, tip: '云稍微多了点，但不影响出行' },
  3:  { emoji: '☁️',  label: '阴天',          score: 3, tip: '有点阴沉，带把伞以防万一' },
  45: { emoji: '🌫️', label: '雾',            score: 2, tip: '有雾，注意能见度' },
  48: { emoji: '🌫️', label: '冻雾',          score: 2, tip: '路面可能湿滑，注意安全' },
  51: { emoji: '🌦️', label: '小毛毛雨',      score: 3, tip: '小雨不影响，撑把伞就好' },
  53: { emoji: '🌦️', label: '毛毛雨',        score: 3, tip: '带伞出行，别淋湿' },
  55: { emoji: '🌧️', label: '大雨',          score: 2, tip: '雨有点大，建议缩短行程' },
  61: { emoji: '🌧️', label: '小雨',          score: 3, tip: '带把伞，雨中也有风情' },
  63: { emoji: '🌧️', label: '中雨',          score: 2, tip: '建议把户外改为室内路线' },
  65: { emoji: '🌧️', label: '大雨',          score: 1, tip: '暴雨天还是在家宅着吧~' },
  71: { emoji: '❄️', label: '小雪',          score: 3, tip: '下小雪了，穿上外套出发' },
  73: { emoji: '❄️', label: '中雪',          score: 2, tip: '注意防滑保暖' },
  75: { emoji: '❄️', label: '大雪',          score: 1, tip: '大雪天气，建议改天' },
  77: { emoji: '❄️', label: '雪粒',          score: 2, tip: '路面可能结冰，小心慢行' },
  80: { emoji: '🌧️', label: '阵雨',          score: 3, tip: '出门带伞，阵雨来去快' },
  81: { emoji: '🌧️', label: '中阵雨',        score: 2, tip: '建议缩短户外时间' },
  82: { emoji: '🌧️', label: '大阵雨',        score: 1, tip: '暴雨预警，改天吧~' },
  85: { emoji: '❄️', label: '小阵雪',        score: 2, tip: '穿暖和点再出门' },
  86: { emoji: '❄️', label: '大阵雪',        score: 1, tip: '雪太大了，宅家更舒服' },
  95: { emoji: '⛈️', label: '雷暴',          score: 1, tip: '雷暴天气，不适合外出！' },
  96: { emoji: '⛈️', label: '雷暴 + 小冰雹', score: 1, tip: '恶劣天气！强烈建议改天' },
  99: { emoji: '⛈️', label: '雷暴 + 大冰雹', score: 0, tip: '极端天气！出门危险' },
}

const FALLBACK_WEATHER = { emoji: '🌤️', label: '未知', score: 3, tip: '天气数据暂不可用，适度出行' }

/**
 * 获取当前位置的实时天气
 *
 * @param {number} lat 纬度
 * @param {number} lng 经度
 * @returns {Promise<{emoji, label, score, tip, temp, tempUnit}|null>}
 */
export async function fetchCurrentWeather(lat, lng) {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      current: 'temperature_2m,weather_code,is_day',
      timezone: 'auto',
      forecast_days: '1',
    })

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok) {
      console.warn('[Weather] fetch failed:', response.status)
      return null
    }

    const data = await response.json()
    const current = data.current
    if (!current) return null

    const code = current.weather_code
    const weatherInfo = WEATHER_CODES[code] || FALLBACK_WEATHER

    return {
      emoji: weatherInfo.emoji,
      label: weatherInfo.label,
      score: weatherInfo.score,
      tip: weatherInfo.tip,
      temp: Math.round(current.temperature_2m),
      tempUnit: data.current_units?.temperature_2m === '°F' ? '°F' : '°C',
      isDay: current.is_day === 1,
    }
  } catch (err) {
    console.warn('[Weather] request error:', err.message)
    return null
  }
}
