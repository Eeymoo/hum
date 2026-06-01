function parseArray(str: string | null): any[] {
  if (!str) return []
  try {
    return JSON.parse(str)
  } catch {
    return []
  }
}

export function deserializeDiet(diet: any) {
  return {
    ...diet,
    foods: JSON.parse(diet.foods || '[]'),
    attachments: parseArray(diet.attachments),
    extraData: diet.extraData ? JSON.parse(diet.extraData) : null
  }
}

export function deserializeExercise(exercise: any) {
  return {
    ...exercise,
    activities: JSON.parse(exercise.activities || '[]'),
    attachments: parseArray(exercise.attachments),
    extraData: exercise.extraData ? JSON.parse(exercise.extraData) : null
  }
}

export function deserializeSleep(sleep: any) {
  return {
    ...sleep,
    attachments: parseArray(sleep.attachments),
    extraData: sleep.extraData ? JSON.parse(sleep.extraData) : null
  }
}

export function deserializeWeight(weight: any) {
  return {
    ...weight,
    attachments: parseArray(weight.attachments),
    extraData: weight.extraData ? JSON.parse(weight.extraData) : null
  }
}
