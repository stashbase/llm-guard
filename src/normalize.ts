const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const toNormalizedText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const visitValue = (value: unknown, output: string[], seen: WeakSet<object>) => {
  const normalizedText = toNormalizedText(value)
  if (normalizedText) {
    output.push(normalizedText)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visitValue(item, output, seen)
    }
    return
  }

  if (!isRecord(value)) {
    return
  }

  if (seen.has(value)) {
    return
  }

  seen.add(value)

  for (const nestedValue of Object.values(value)) {
    visitValue(nestedValue, output, seen)
  }
}

export const normalizeToTexts = (value: unknown): string[] => {
  const output: string[] = []
  visitValue(value, output, new WeakSet())
  return output
}
