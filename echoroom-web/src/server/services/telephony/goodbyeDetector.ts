const GOODBYE_PHRASES = [
  // English
  'goodbye',
  'bye',
  'hang up',
  'end call',
  "i'm done",
  "that's all",
  'see you later',
  'talk to you later',
  'i have to go',
  'i gotta go',
  'bye bye',
  'catch you later',
  // French
  'au revoir',
  'salut',
  'à bientôt',
  'à plus tard',
  'c\'est tout',
  'je dois y aller',
  'je vous remercie',
  'merci',
  'bonne journée',
  'bonne soirée',
]

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds a Unicode-aware word boundary regex for the given phrase.
 * Uses Unicode character classes (\p{L} for letters, \p{N} for numbers)
 * and underscore to mirror \b semantics while supporting accented French
 * characters (à, é, ô, etc.).
 */
function buildWordBoundaryPattern(phrase: string): RegExp {
  const escaped = escapeRegex(phrase)
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu')
}

const GOODBYE_PATTERNS = GOODBYE_PHRASES.map(buildWordBoundaryPattern)

export function detectGoodbye(text: string): boolean {
  const normalized = text.toLowerCase().trim()
  return GOODBYE_PATTERNS.some((pattern) => pattern.test(normalized))
}
