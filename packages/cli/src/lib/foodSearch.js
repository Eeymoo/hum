import config from './config.js'

const CACHE_KEY = 'foodCache'

function getCache() {
  return config.get(CACHE_KEY) || []
}

function setCache(cache) {
  config.set(CACHE_KEY, cache)
}

function parseNumber(str) {
  if (!str || str === '—' || str === '') return null
  const num = parseFloat(String(str).replace(/[^\d.]/g, ''))
  return isNaN(num) ? null : num
}

function parseKjToKcal(str) {
  const kj = parseNumber(str)
  if (kj === null) return null
  return Math.round(kj / 4.184 * 10) / 10
}

/**
 * Parse a single food item from the API response array into a structured object.
 * Field mapping (based on actual API response):
 *   [0]  foodCode       → sourceId
 *   [2]  foodName       → name
 *   [5]  water %
 *   [6]  edible portion
 *   [7]  energy (kJ)    → energyKcal (converted)
 *   [8]  protein (g)
 *   [9]  fat (g)
 *   [11] dietary fiber (g)
 *   [12] carbohydrate (g)
 */
function parseFoodItem(item) {
  return {
    source: 'chinanutri',
    sourceId: String(item[0]),
    name: item[2] || '',
    energyKcal: parseKjToKcal(item[7]),
    protein: parseNumber(item[8]),
    fat: parseNumber(item[9]),
    carbs: parseNumber(item[12]),
    rawItem: item
  }
}

/**
 * Search foods from the remote API.
 * Returns an array of parsed food objects.
 */
export async function searchRemote(name, limit = 20) {
  const body = new URLSearchParams({
    categoryOne: '0',
    categoryTwo: '0',
    foodName: name,
    pageNum: '1',
    field: '0',
    flag: '0'
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      'https://nlc.chinanutri.cn/fq/FoodInfoQueryAction!queryFoodInfoList.do',
      {
        method: 'POST',
        headers: {
          'Referer': 'https://nlc.chinanutri.cn/fq/foodlist.htm',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: body.toString(),
        signal: controller.signal
      }
    )

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const items = data.list || []

    return items.slice(0, limit).map(parseFoodItem)
  } catch (error) {
    clearTimeout(timeout)
    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT')
    }
    throw error
  }
}

/**
 * Search cached foods by name (fuzzy match).
 */
export function searchCache(name, limit = 5) {
  const cache = getCache()
  const keyword = name.toLowerCase()
  return cache
    .filter(item => item.name.toLowerCase().includes(keyword))
    .slice(0, limit)
}

/**
 * Upsert food items into local cache.
 */
export function upsertCache(items) {
  const cache = getCache()
  for (const item of items) {
    const idx = cache.findIndex(c => c.sourceId === item.sourceId)
    const entry = {
      source: item.source,
      sourceId: item.sourceId,
      name: item.name,
      energyKcal: item.energyKcal,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      updatedAt: new Date().toISOString()
    }
    if (idx >= 0) {
      cache[idx] = entry
    } else {
      cache.push(entry)
    }
  }
  setCache(cache)
}

/**
 * Main search function: cache-first with remote fallback.
 */
export async function searchFood(name, { limit = 5, noCache = false } = {}) {
  // 1. If cache is allowed, try cache first
  if (!noCache) {
    const cached = searchCache(name, limit)
    if (cached.length > 0) {
      return { items: cached, fromCache: true }
    }
  }

  // 2. Query remote
  try {
    const remoteItems = await searchRemote(name, limit)
    if (remoteItems.length > 0) {
      upsertCache(remoteItems)
      return { items: remoteItems.slice(0, limit), fromCache: false }
    }
    return { items: [], fromCache: false }
  } catch (error) {
    // 3. On remote failure, try cache as fallback
    if (error.message === 'TIMEOUT') {
      const cached = searchCache(name, limit)
      if (cached.length > 0) {
        return { items: cached, fromCache: true, degraded: true }
      }
      throw new Error('查询超时，请稍后重试')
    }
    // Other remote errors: degrade to cache
    const cached = searchCache(name, limit)
    if (cached.length > 0) {
      return { items: cached, fromCache: true, degraded: true }
    }
    throw error
  }
}
