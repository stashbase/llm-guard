export function extractTexts(input: unknown): string[] {
  if (input == null) {
    return []
  }

  if (typeof input === 'string') {
    return [input]
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => extractTexts(item))
  }

  if (typeof input === 'object') {
    const obj = input as {
      content?: unknown
      text?: unknown
    }

    if (typeof obj.content === 'string') {
      return [obj.content]
    }

    if (Array.isArray(obj.content)) {
      return obj.content.flatMap((block) => {
        if (typeof block === 'string') {
          return [block]
        }

        if (block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string') {
          return [(block as { text: string }).text]
        }

        return []
      })
    }

    if (typeof obj.text === 'string') {
      return [obj.text]
    }
  }

  return []
}
