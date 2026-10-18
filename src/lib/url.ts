// "https://www.ornek.com/menu" -> "www.ornek.com"; anything unparsable as is.
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
