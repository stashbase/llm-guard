/**
 * Convert camelCase to snake_case recursively
 */
export const toSnakeCase = <T = any>(obj: T): any => {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase)
  }

  if (obj instanceof Date || obj instanceof RegExp) {
    return obj
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        // Avoid leading underscore by checking if first char is uppercase
        key.replace(/([A-Z])/g, (match, letter, offset) =>
          offset === 0 ? letter.toLowerCase() : `_${letter.toLowerCase()}`
        ),
        toSnakeCase(value),
      ])
    )
  }

  return obj
}

/**
 * Convert snake_case to camelCase recursively
 */
export const toCamelCase = <T = any>(obj: T): any => {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(toCamelCase)
  }

  if (obj instanceof Date || obj instanceof RegExp) {
    return obj
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        // Handle both lowercase and uppercase letters after underscore
        key.replace(/_([a-z])/gi, (_, letter) => letter.toUpperCase()),
        toCamelCase(value),
      ])
    )
  }

  return obj
}

export function stringToSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // camelCase → camel_case
    .replace(/[\s\-]+/g, '_') // spaces/dashes → _
    .toLowerCase()
}
