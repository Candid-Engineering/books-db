/**
 * A type-preserving version of `Object.fromEntries`. Object.fromEntries on its own returns `any` type.
 * @param entries an array of [key, value] pairs to convert to an object having {key: value} for each entry.
 * @returns Object containing {key: value} entries.
 */
export function ObjectFromEntries<const T extends ReadonlyArray<readonly [PropertyKey, unknown]>>(
  entries: T
): { [K in T[number] as K[0]]: K[1] } {
  return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] }
}

/**
 * A type-preserving version of `Object.entries`.
 * @param obj Object to convert into array of [key, value] pairs.
 * @returns Array of [key, value] pairs.
 */
export function typeSafeObjectEntries<T extends Record<PropertyKey, unknown>>(
  obj: T
): { [K in keyof T]: [K, T[K]] }[keyof T][] {
  return Object.entries(obj) as { [K in keyof T]: [K, T[K]] }[keyof T][]
}
