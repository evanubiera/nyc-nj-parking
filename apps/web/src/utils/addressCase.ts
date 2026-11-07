// WEB-11: NYC GeoSearch writes street addresses in capitals ("120 BROADWAY", "350 5 AVENUE"). We show them as
// people write them: "120 Broadway", "350 5th Avenue". A part already in mixed case, as NJ_Geocode writes, is left
// as it is, and so are state codes such as "NY".

/** Short words that stay lower case inside a name: "Avenue of the Americas". */
const SMALL_WORDS = new Set(['of', 'the', 'and', 'at', 'on', 'in', 'by', 'to']);
/** Street abbreviations have no vowels, like initials, but are cased as words: "St Marks Place", "Ft Hamilton". */
const ABBREVIATIONS = new Set(['st', 'mt', 'ft', 'jr', 'sr', 'pl', 'dr', 'rd', 'ct', 'ln', 'sq', 'blvd', 'pkwy', 'hwy', 'expy', 'tpke']);
/** A numbered street written without its ordinal, as the City's address directory does: "5 AVENUE" is 5th Avenue. */
const STREET_TYPES = new Set(['avenue', 'street', 'place', 'road', 'drive', 'terrace', 'lane', 'court', 'walk', 'boulevard', 'parkway']);

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function ordinal(number: string): string {
  const n = Number(number);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${number}${suffix}`;
}

/** "B'WAY" → "B'way", "O'BRIEN" → "O'Brien", "MCDONALD" → "McDonald", "WILKES-BARRE" → "Wilkes-Barre". */
function caseName(word: string): string {
  return word
    .toLowerCase()
    .split('-')
    .map((part) => {
      const pieces = part.split("'");
      const cased = pieces.map((piece, index) => (index === 0 || /^[od]$/.test(pieces[index - 1]!) ? capital(piece) : piece)).join("'");
      return /^Mc[a-z]{2,}/.test(cased) ? `Mc${capital(cased.slice(2))}` : cased;
    })
    .join('-');
}

function caseWord(word: string, firstWord: boolean): string {
  // House numbers ("120A", "47-10") stay as written; an ordinal's suffix is lower case ("2ND" → "2nd").
  if (/^\d/.test(word)) return /^\d+(ST|ND|RD|TH)$/.test(word) ? word.toLowerCase() : word;
  const lower = word.toLowerCase();
  if (word.length === 1) return word; // "E 33rd St", "Avenue A"
  if (!firstWord && SMALL_WORDS.has(lower)) return lower;
  // Initials such as FDR, JFK, and MLK have no vowels: they stay in capitals.
  if (!/[AEIOUY]/.test(word) && !ABBREVIATIONS.has(lower)) return word;
  return caseName(word);
}

function casePart(part: string): string {
  const words = part.split(' ');
  const firstWord = words.findIndex((word) => !/^\d/.test(word));
  return words
    .map((word, index) => {
      const next = words[index + 1]?.toLowerCase();
      if (index > 0 && /^\d+$/.test(word) && next && STREET_TYPES.has(next)) return ordinal(word);
      return caseWord(word, index === firstWord);
    })
    .join(' ');
}

/** An address label with each part written in capitals put in proper case. */
export function properCaseAddress(label: string): string {
  return label
    .split(', ')
    .map((part) => (/[A-Z]/.test(part) && !/[a-z]/.test(part) && !/^[A-Z]{2,3}$/.test(part) ? casePart(part) : part))
    .join(', ');
}
