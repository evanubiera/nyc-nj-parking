// Names, match tokens, and facility keys (specs/03, "How facilities are built").

const SMALL_WORDS = new Set(['and', 'of', 'at']);

/** "BENSONHURST NO. 1" → "Bensonhurst No. 1"; "31ST" → "31st"; "(#1)" and "&" kept. */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, index) => {
      if (/^\s+$/.test(word)) return word;
      if (/^\d+(st|nd|rd|th)$/.test(word)) return word;
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      return word.replace(/(^|[(\-/])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
    })
    .join('');
}

const NAME_STOP_WORDS = new Set(['municipal', 'parking', 'field', 'garage', 'lot', 'and', 'outdoor']);

/**
 * Lower-case words used to match one facility across sources. "BENSONHURST NO. 1, FIELD" and
 * "Bensonhurst #1" both give ["bensonhurst", "1"]; "BROADWAY - 31ST STREET" gives ["broadway", "31", "street"].
 */
export function matchTokens(name: string): string[] {
  const text = name
    .toLowerCase()
    .replace(/–/g, '-')
    .replace(/\bno\.\s*(\d)/g, ' $1')
    .replace(/#/g, ' ')
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ');
  return text.split(' ').filter((token) => token.length > 0 && !NAME_STOP_WORDS.has(token));
}

/** Whether two names can be the same facility: the same letters, or one's words all in the other's. */
export function namesMatch(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a.join('') === b.join('')) return true;
  const setA = new Set(a);
  const setB = new Set(b);
  return a.every((token) => setB.has(token)) || b.every((token) => setA.has(token));
}

export function facilityKey(prefix: string, tokens: readonly string[]): string {
  return `${prefix}-${tokens.join('-')}`;
}
