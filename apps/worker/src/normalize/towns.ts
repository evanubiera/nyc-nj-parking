// S4-44: New Jersey towns as the app names them. Sources write the same town differently: NJ Transit with its official
// label ("Oradell Borough", "South Orange Village Township"), NJDOT abbreviated ("Clinton Twp", "Mount Arlington Boro"),
// the tax-record sites and towns' own pages as people say it ("Oradell"). A label is read as the name the tax-record
// sites use for that town, so a town's facilities are listed together (WEB-13) and read alike.
import { BERGEN_TOWNS, ESSEX_TOWNS, HUDSON_TOWNS } from '../sources/nj-parcels-parking.ts';
import { NJ_MUNICIPAL_LABELS, REST_OF_NJ_TOWNS } from '../sources/nj-towns.ts';

const NAMES: Readonly<Record<string, { name: string }>> = Object.assign({}, HUDSON_TOWNS, ESSEX_TOWNS, BERGEN_TOWNS, ...Object.values(REST_OF_NJ_TOWNS));

/** "Clinton Twp" and "CLINTON TOWNSHIP" alike: lower case, abbreviations and a misspelling written out, punctuation dropped. */
function key(label: string): string {
  return label
    .toLowerCase()
    .replace(/\btwp\b\.?/g, 'township')
    .replace(/\btownsip\b/g, 'township')
    .replace(/\bboro\b\.?/g, 'borough')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const TYPE = / (borough|township|city|town|village)$/;
/** "Cape May County", "CAPE MAY", and "cape may" alike. */
const countyKey = (county: string) => county.toLowerCase().replace(/ county$/, '').trim();

interface Label {
  county: string;
  label: string;
  /** Without its kind of town: "clifton" for "Clifton City". */
  bare: string;
  name: string;
}
const LABELS: readonly Label[] = Object.entries(NJ_MUNICIPAL_LABELS).flatMap(([code, { label, county }]) => {
  const name = NAMES[code]?.name;
  return name ? [{ county: countyKey(county), label: key(label), bare: key(label).replace(TYPE, ''), name }] : [];
});

/** The one town with this label or bare name, in this county when it's known; null when none or several match. */
function only(matches: readonly Label[]): string | null {
  return matches.length === 1 ? matches[0]!.name : null;
}

/**
 * The app's name for a New Jersey town written as a label: its official label, abbreviated ("Clinton Twp"), turned
 * round ("City of Englewood"), with a kind too many ("South Orange Village Township" for "South Orange Village"), or
 * none ("Clifton"). Matched within the town's county when it's given, since labels repeat across counties (four
 * Washington Townships). Null when no single New Jersey town matches.
 */
export function njTownName(label: string, county?: string | null): string | null {
  const inCounty = county ? LABELS.filter((entry) => entry.county === countyKey(county)) : LABELS;
  const written = key(label);
  const turned = /^(borough|township|city|town|village) of (.+)$/.exec(written);
  const tries = [written, turned ? `${turned[2]} ${turned[1]}` : null, written.replace(TYPE, '')].filter((entry): entry is string => entry !== null);
  for (const entry of tries) {
    const name = only(inCounty.filter((town) => town.label === entry)) ?? only(inCounty.filter((town) => town.bare === entry));
    if (name) return name;
  }
  return null;
}
