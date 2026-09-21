/** Display-only labels. Does not affect modpack hashes or download paths. */
export function displayModTag(tag?: string | null): string | null {
  if (!tag) return null
  if (/^obrigat/i.test(tag)) return "Required"
  if (/^opcional/i.test(tag)) return "Optional"
  return tag
}
