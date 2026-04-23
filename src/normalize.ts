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

const extractTextsInternal = (input: unknown, seen: WeakSet<object>): string[] => {
  if (input == null) {
    return []
  }

  const directText = toNormalizedText(input)
  if (directText) {
    return [directText]
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => extractTextsInternal(item, seen))
  }

  if (!isRecord(input)) {
    return []
  }

  if (seen.has(input)) {
    return []
  }
  seen.add(input)

  const out: string[] = []
  const push = (value: unknown) => {
    out.push(...extractTextsInternal(value, seen))
  }

  const contentText = toNormalizedText(input.content)
  if (contentText) {
    out.push(contentText)
  } else if (input.content != null) {
    push(input.content)
  }

  const textValue = toNormalizedText(input.text)
  if (textValue) {
    out.push(textValue)
  }

  const messageText = toNormalizedText(input.message)
  if (messageText) {
    out.push(messageText)
  }

  // Common message container keys across LLM providers and wrappers.
  if (input.parts != null) push(input.parts)
  if (input.contents != null) push(input.contents)
  if (input.messages != null) push(input.messages)
  return out
}

export function extractTexts(input: unknown): string[] {
  return extractTextsInternal(input, new WeakSet())
}
