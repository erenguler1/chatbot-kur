const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]} ${date.getFullYear()}`
}
