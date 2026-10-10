// A discount (a negative price) reads "-€ 1,50".
export function formatEuro(cents: number): string {
  return `${cents < 0 ? '-' : ''}€ ${(Math.abs(cents) / 100).toFixed(2).replace('.', ',')}`
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}
