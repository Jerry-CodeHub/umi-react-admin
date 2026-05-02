const defaultInitializer = (index: number) => index;

export function createRange<T = number>(
  length: number,
  initializer: (index: number) => T = defaultInitializer as (index: number) => T,
): T[] {
  return [...new Array(length)].map((_, index) => initializer(index));
}
