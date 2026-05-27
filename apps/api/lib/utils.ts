export function parseDateRange(last?: string | null, start?: string | null, end?: string | null) {
  let startDate: Date | undefined
  let endDate: Date | undefined

  if (last) {
    const now = new Date()
    const match = last.match(/^(\d+)(d|w|m|y)$/)
    if (match) {
      const [, num, unit] = match
      const n = parseInt(num, 10)
      switch (unit) {
        case 'd':
          startDate = new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
          break
        case 'w':
          startDate = new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000)
          break
        case 'm':
          startDate = new Date(now)
          startDate.setMonth(startDate.getMonth() - n)
          break
        case 'y':
          startDate = new Date(now)
          startDate.setFullYear(startDate.getFullYear() - n)
          break
      }
    } else {
      const num = parseInt(last, 10)
      if (!isNaN(num)) {
        startDate = new Date(now.getTime() - num * 24 * 60 * 60 * 1000)
      }
    }
  }

  if (start) {
    startDate = new Date(start)
  }
  if (end) {
    endDate = new Date(end)
  }

  return { startDate, endDate }
}

export function parseActivities(activitiesStr: string | null): any[] {
  if (!activitiesStr) return []
  return activitiesStr.split(';').map(part => {
    const [namePart, ...restParts] = part.split(':')
    const name = namePart.trim()
    const props: Record<string, any> = {}
    if (restParts.length > 0) {
      restParts.join(':').split(',').forEach(prop => {
        const [k, v] = prop.split('=')
        if (k && v) {
          const key = k.trim()
          let value: any = v.trim()
          if (!isNaN(parseFloat(value))) {
            value = parseFloat(value)
          }
          props[key] = value
        }
      })
    }
    return { name, ...props }
  })
}

export function parseFoods(foodsStr: string | null): any[] {
  if (!foodsStr) return []
  return foodsStr.split(',').map(part => {
    const [name, amount] = part.split(':')
    return {
      name: name?.trim() || '',
      amount: amount?.trim() || ''
    }
  })
}
