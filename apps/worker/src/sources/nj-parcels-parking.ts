// S4-3, S4-14, S4-25, S4-32, and S4-37: unconfirmed parking sites in New Jersey's towns, from the State's parcel and
// tax-record layer (ADR-0012, ADR-0015, ADR-0018, ADR-0019, ADR-0020, specs/06 "State parcels and tax records"). One
// source each for Hudson, Essex, and Bergen, and one for the other 18 counties. A site is public land (class 15C) that the
// assessor describes as parking. The layer doesn't say who owns it (owner names are redacted) or whether the public
// may park there, so every site is marked unconfirmed, with operator type `unknown` and no official page (REC-9).
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { metersBetween } from '../facilities/cluster.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { titleCase } from '../normalize/names.ts';
import { arcgisItemPage, parseJson, queryArcgisLayer, resolveArcgisLayer } from './arcgis.ts';
import { REST_OF_NJ_TOWNS, type Towns } from './nj-towns.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const NJ_PARCELS_ITEM_ID = '533599bbfbaa4748bf39faf1375a8a9c';

export type { Towns };

/** Hudson County's towns (Jersey City's and West New York's IDs as before). */
export const HUDSON_TOWNS: Towns = {
  '0901': { name: 'Bayonne', key: 'bayonne' },
  '0902': { name: 'East Newark', key: 'east-newark' },
  '0903': { name: 'Guttenberg', key: 'guttenberg' },
  '0904': { name: 'Harrison', key: 'harrison' },
  '0905': { name: 'Hoboken', key: 'hoboken' },
  '0906': { name: 'Jersey City', key: 'jc' },
  '0907': { name: 'Kearny', key: 'kearny' },
  '0908': { name: 'North Bergen', key: 'north-bergen' },
  '0909': { name: 'Secaucus', key: 'secaucus' },
  '0910': { name: 'Union City', key: 'union-city' },
  '0911': { name: 'Weehawken', key: 'weehawken' },
  '0912': { name: 'West New York', key: 'wny' },
};

/** Essex County's towns. */
export const ESSEX_TOWNS: Towns = {
  '0701': { name: 'Belleville', key: 'belleville' },
  '0702': { name: 'Bloomfield', key: 'bloomfield' },
  '0703': { name: 'Caldwell', key: 'caldwell' },
  '0704': { name: 'Cedar Grove', key: 'cedar-grove' },
  '0705': { name: 'East Orange', key: 'east-orange' },
  '0706': { name: 'Essex Fells', key: 'essex-fells' },
  '0707': { name: 'Fairfield', key: 'fairfield' },
  '0708': { name: 'Glen Ridge', key: 'glen-ridge' },
  '0709': { name: 'Irvington', key: 'irvington' },
  '0710': { name: 'Livingston', key: 'livingston' },
  '0711': { name: 'Maplewood', key: 'maplewood' },
  '0712': { name: 'Millburn', key: 'millburn' },
  '0713': { name: 'Montclair', key: 'montclair' },
  '0714': { name: 'Newark', key: 'newark' },
  '0715': { name: 'North Caldwell', key: 'north-caldwell' },
  '0716': { name: 'Nutley', key: 'nutley' },
  '0717': { name: 'Orange', key: 'orange' },
  '0718': { name: 'Roseland', key: 'roseland' },
  '0719': { name: 'South Orange', key: 'south-orange' },
  '0720': { name: 'Verona', key: 'verona' },
  '0721': { name: 'West Caldwell', key: 'west-caldwell' },
  '0722': { name: 'West Orange', key: 'west-orange' },
};

/** Bergen County's towns, with the layer's abbreviations written out ("HASBROUCK HGHTS" is Hasbrouck Heights). */
export const BERGEN_TOWNS: Towns = {
  '0201': { name: 'Allendale', key: 'allendale' },
  '0202': { name: 'Alpine', key: 'alpine' },
  '0203': { name: 'Bergenfield', key: 'bergenfield' },
  '0204': { name: 'Bogota', key: 'bogota' },
  '0205': { name: 'Carlstadt', key: 'carlstadt' },
  '0206': { name: 'Cliffside Park', key: 'cliffside-park' },
  '0207': { name: 'Closter', key: 'closter' },
  '0208': { name: 'Cresskill', key: 'cresskill' },
  '0209': { name: 'Demarest', key: 'demarest' },
  '0210': { name: 'Dumont', key: 'dumont' },
  '0211': { name: 'Elmwood Park', key: 'elmwood-park' },
  '0212': { name: 'East Rutherford', key: 'east-rutherford' },
  '0213': { name: 'Edgewater', key: 'edgewater' },
  '0214': { name: 'Emerson', key: 'emerson' },
  '0215': { name: 'Englewood', key: 'englewood' },
  '0216': { name: 'Englewood Cliffs', key: 'englewood-cliffs' },
  '0217': { name: 'Fair Lawn', key: 'fair-lawn' },
  '0218': { name: 'Fairview', key: 'fairview' },
  '0219': { name: 'Fort Lee', key: 'fort-lee' },
  '0220': { name: 'Franklin Lakes', key: 'franklin-lakes' },
  '0221': { name: 'Garfield', key: 'garfield' },
  '0222': { name: 'Glen Rock', key: 'glen-rock' },
  '0223': { name: 'Hackensack', key: 'hackensack' },
  '0224': { name: 'Harrington Park', key: 'harrington-park' },
  '0225': { name: 'Hasbrouck Heights', key: 'hasbrouck-heights' },
  '0226': { name: 'Haworth', key: 'haworth' },
  '0227': { name: 'Hillsdale', key: 'hillsdale' },
  '0228': { name: 'Ho-Ho-Kus', key: 'ho-ho-kus' },
  '0229': { name: 'Leonia', key: 'leonia' },
  '0230': { name: 'Little Ferry', key: 'little-ferry' },
  '0231': { name: 'Lodi', key: 'lodi' },
  '0232': { name: 'Lyndhurst', key: 'lyndhurst' },
  '0233': { name: 'Mahwah', key: 'mahwah' },
  '0234': { name: 'Maywood', key: 'maywood' },
  '0235': { name: 'Midland Park', key: 'midland-park' },
  '0236': { name: 'Montvale', key: 'montvale' },
  '0237': { name: 'Moonachie', key: 'moonachie' },
  '0238': { name: 'New Milford', key: 'new-milford' },
  '0239': { name: 'North Arlington', key: 'north-arlington' },
  '0240': { name: 'Northvale', key: 'northvale' },
  '0241': { name: 'Norwood', key: 'norwood' },
  '0242': { name: 'Oakland', key: 'oakland' },
  '0243': { name: 'Old Tappan', key: 'old-tappan' },
  '0244': { name: 'Oradell', key: 'oradell' },
  '0245': { name: 'Palisades Park', key: 'palisades-park' },
  '0246': { name: 'Paramus', key: 'paramus' },
  '0247': { name: 'Park Ridge', key: 'park-ridge' },
  '0248': { name: 'Ramsey', key: 'ramsey' },
  '0249': { name: 'Ridgefield', key: 'ridgefield' },
  '0250': { name: 'Ridgefield Park', key: 'ridgefield-park' },
  '0251': { name: 'Ridgewood', key: 'ridgewood' },
  '0252': { name: 'River Edge', key: 'river-edge' },
  '0253': { name: 'River Vale', key: 'river-vale' },
  '0254': { name: 'Rochelle Park', key: 'rochelle-park' },
  '0255': { name: 'Rockleigh', key: 'rockleigh' },
  '0256': { name: 'Rutherford', key: 'rutherford' },
  '0257': { name: 'Saddle Brook', key: 'saddle-brook' },
  '0258': { name: 'Saddle River', key: 'saddle-river' },
  '0259': { name: 'South Hackensack', key: 'south-hackensack' },
  '0260': { name: 'Teaneck', key: 'teaneck' },
  '0261': { name: 'Tenafly', key: 'tenafly' },
  '0262': { name: 'Teterboro', key: 'teterboro' },
  '0263': { name: 'Upper Saddle River', key: 'upper-saddle-river' },
  '0264': { name: 'Waldwick', key: 'waldwick' },
  '0265': { name: 'Wallington', key: 'wallington' },
  '0266': { name: 'Washington Township', key: 'washington-township' },
  '0267': { name: 'Westwood', key: 'westwood' },
  '0268': { name: 'Woodcliff Lake', key: 'woodcliff-lake' },
  '0269': { name: 'Wood-Ridge', key: 'wood-ridge' },
  '0270': { name: 'Wyckoff', key: 'wyckoff' },
};

/** A source's counties: its ID, the layer's COUNTY values, and their towns. */
export interface ParcelCounty {
  sourceId: string;
  counties: readonly string[];
  towns: Towns;
  schedule: string;
  revision: number;
}

// 2: sites not for visitors left out (ADR-0017).
export const HUDSON: ParcelCounty = { sourceId: 'nj-parcels-hudson-parking', counties: ['HUDSON'], towns: HUDSON_TOWNS, schedule: '55 5 * * 3', revision: 2 };
// 2: Nutley's permit lot left out (ADR-0017). 3: pools, ballfields, and rinks as other uses (Glen Ridge's site).
export const ESSEX: ParcelCounty = { sourceId: 'nj-parcels-essex-parking', counties: ['ESSEX'], towns: ESSEX_TOWNS, schedule: '58 5 * * 3', revision: 3 };
export const BERGEN: ParcelCounty = { sourceId: 'nj-parcels-bergen-parking', counties: ['BERGEN'], towns: BERGEN_TOWNS, schedule: '1 6 * * 3', revision: 1 };
/** The other 18 counties (ADR-0020), in one source: each county's candidates are one query. */
export const REST_OF_NJ: ParcelCounty = {
  sourceId: 'nj-parcels-rest-of-nj-parking',
  counties: Object.keys(REST_OF_NJ_TOWNS).sort(),
  towns: Object.assign({}, ...Object.values(REST_OF_NJ_TOWNS)) as Towns,
  schedule: '4 6 * * 3',
  revision: 1,
};

/**
 * ING-13: how Hudson's assessors write parking: "PARKING AREA", "PRKNG LOT 23PS", "MUNICIPAL PKG.", "PARK'G",
 * "GARAGE#B-810 PS" (spaces), "MUNI PARK LOT", "PAVED LOT". A bare "GARAGE" is usually a public works garage.
 */
export const SAYS_PARKING = /PARKING|PRKNG|\bPKG\b|PARK'?G|GARAGE ?#|\d+ ?P\.?S\b|MUNI(CIPAL)? (PARK )?LOT|PAVED (LOT|PARKING)|\bPARK LOT\b/i;

/** The layer is filtered by LIKE, which can't say all of SAYS_PARKING; this is wider, and SAYS_PARKING sorts after. */
const LIKE_PARKING = ['%PARKING%', '%PRKNG%', '%PKG%', "%PARK''G%", '%PARKG%', '%PARK LOT%', '%GARAGE#%', '%GARAGE #%', '%PS%', '%P.S%', '%MUNI%LOT%', '%PAVED%'];
export const candidatesWhere = (county: string) =>
  `COUNTY='${county}' AND PROP_CLASS='15C' AND (${LIKE_PARKING.flatMap((pattern) => [`BLDG_DESC LIKE '${pattern}'`, `FAC_NAME LIKE '${pattern}'`]).join(' OR ')})`;
const CANDIDATE_FIELDS = 'PAMS_PIN,PCL_MUN,PCLBLOCK,PCLLOT,PROP_LOC,BLDG_DESC,FAC_NAME';
const NEIGHBOUR_FIELDS = 'PAMS_PIN,PCL_MUN,PCLBLOCK,PROP_CLASS,BLDG_DESC,FAC_NAME';
/** The layer answers 404 to a query URL much over 2,000 characters, so the neighbours are asked for in parts. */
const MAX_QUERY_URL = 1_800;
const BLOCKS_PER_CLAUSE = 40;

export function parcelSitesSource(config: ParcelCounty): SourceDefinition {
  return {
    id: config.sourceId,
    publisher: 'NJ Office of Information Technology, Office of GIS (NJOGIS)',
    title: 'Parcels and MOD-IV Composite of NJ',
    datasetUrl: arcgisItemPage(NJ_PARCELS_ITEM_ID),
    // The item's terms: a disclaimer, not survey data, credit to NJOGIS requested, and the State's Conditions of Use.
    termsUrl: arcgisItemPage(NJ_PARCELS_ITEM_ID),
    creditText: null,
    modificationCodes: ['sites_from_parcels', 'unconfirmed_public_use', 'sites_not_for_visitors_excluded', 'merged_across_sources'],
    // Published every few months. A weekly check is plenty, and unchanged data is skipped (ING-7).
    schedule: config.schedule,
    revision: config.revision,
    fetch: (http) => fetchCandidates(http, config),
    apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
      applyNormalized(tx, config.sourceId, normalizeCandidates(snapshot.body, config), snapshot.fetchedAt),
  };
}

export const njParcelsHudsonParking = parcelSitesSource(HUDSON);
export const njParcelsEssexParking = parcelSitesSource(ESSEX);
export const njParcelsBergenParking = parcelSitesSource(BERGEN);
export const njParcelsRestOfNjParking = parcelSitesSource(REST_OF_NJ);

/**
 * Each county's candidate parcels, then the other public parcels on their blocks, in as many queries as the URL length
 * allows. Stored together, each response exactly as received (specs/03).
 */
async function fetchCandidates(http: UpstreamHttp, config: ParcelCounty): Promise<FetchedData> {
  const { layerUrl, editedAt } = await resolveArcgisLayer(http, NJ_PARCELS_ITEM_ID);
  const decode = (body: Uint8Array) => new TextDecoder().decode(body);
  const candidates: string[] = [];
  for (const county of config.counties) {
    candidates.push(decode((await queryArcgisLayer(http, layerUrl, {
      where: candidatesWhere(county),
      outFields: CANDIDATE_FIELDS,
      orderByFields: 'PAMS_PIN',
      returnGeometry: 'true',
      returnCentroid: 'true',
    })).body));
  }
  const blocks = new Map<string, Set<string>>();
  for (const { attributes } of candidates.flatMap((part) => features(part))) {
    const town = text(attributes, 'PCL_MUN');
    const block = text(attributes, 'PCLBLOCK').replace(/'/g, '');
    if (town in config.towns && block && SAYS_PARKING.test(describe(attributes))) blocks.set(town, (blocks.get(town) ?? new Set()).add(block));
  }
  if (blocks.size === 0) throw new IngestionError('normalize.empty', 'no candidate parcels');

  const clauses = [...blocks.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([town, set]) => {
    const sorted = [...set].sort();
    return Array.from({ length: Math.ceil(sorted.length / BLOCKS_PER_CLAUSE) }, (_, index) =>
      `(PCL_MUN='${town}' AND PCLBLOCK IN (${sorted.slice(index * BLOCKS_PER_CLAUSE, (index + 1) * BLOCKS_PER_CLAUSE).map((block) => `'${block}'`).join(',')}))`);
  });
  const params = (part: string[]) => ({
    where: `PROP_CLASS LIKE '15%' AND (${part.join(' OR ')})`,
    outFields: NEIGHBOUR_FIELDS,
    orderByFields: 'PAMS_PIN',
    returnGeometry: 'false',
  });
  const urlLength = (part: string[]) => {
    const url = new URL(`${layerUrl}/query`);
    for (const [name, value] of Object.entries({ ...params(part), outSR: '4326', f: 'json' })) url.searchParams.set(name, value);
    return url.toString().length;
  };
  const parts: string[][] = [];
  for (const clause of clauses) {
    const last = parts.at(-1);
    if (last && urlLength([...last, clause]) <= MAX_QUERY_URL) last.push(clause);
    else parts.push([clause]);
  }
  const neighbours: string[] = [];
  for (const part of parts) neighbours.push(decode((await queryArcgisLayer(http, layerUrl, params(part))).body));
  const body = new TextEncoder().encode(JSON.stringify({ candidates, neighbours }));
  return { body, contentType: 'application/json', upstreamUpdatedAt: editedAt };
}

interface Parcel {
  pin: string;
  town: string;
  block: string;
  lot: string;
  location: string;
  description: string;
  point: { lat: number; lng: number };
  /** Each shape's centroid, when a parcel comes as several (their mean is `point`). */
  shapes: { lat: number; lng: number }[];
  corners: { lat: number; lng: number }[];
}

/** Railroad or right-of-way land isn't a parking lot (ING-13). */
const RIGHT_OF_WAY = /R\.?O\.?W|RAILROAD|RIGHT OF WAY/i;
/**
 * Not a public lot (ADR-0018, ADR-0019, ADR-0020): land a town took for unpaid taxes ("PARKING TAX LIEN FORECLOSURE" in
 * Newark) was a private lot, "FUTURE PARKING" (Oradell) isn't a lot yet, and a parcel recorded as a residence, or with
 * a disabled veteran's exemption (a home's), isn't one either.
 */
const NOT_A_LOT = /TAX LIEN|FORECLOS|FUTURE PARKING|RESIDEN|DISABLED VET/i;
/**
 * Another use the parking serves, when the site's own parcels say so (ADR-0020): a water works, well, water tower, or
 * filtering plant ("WATER UTILITY PRKG"), Green Acres park land, a museum or historical society, or a rescue squad
 * ("SQUAD PARKNG LOT"). Elsewhere on the block they don't count: pump stations, rescue squads, and Green Acres land sit
 * beside downtown and beach lots (Toms River, Chatham, Madison, Long Branch).
 */
const OWN_OTHER_USE =
  /FILTER|WATER (?:WORKS|UTILITY|TOWER|TREATMENT)|\bWELL\b|\bW TWR\b|GREEN ACRES|\bGR AC\b|MUSEUM|HIST(?:ORICAL)? SOC|SQUAD|RESCUE/i;
/**
 * Another public use on the block that the parking most likely serves (ING-13): also a pool, a ballfield, a rink, or a
 * park written "PK" ("PARKING VET PK", Ridgefield Park) (ADR-0019); and, since ADR-0020, any field ("ROBINSON FIELD",
 * "BALLFIELDS") or tennis court, and a church named by its denomination ("LIBERTY BAPTIST", "RECTORY/PARISH CNTR").
 */
const SERVES = new RegExp([
  'SCHOOL|COLLEGE|POLICE|FIRE|HOUSING|POST|COURT|LIBRARY|HOSPITAL|ADMIN|OFFICE|COMMUNITY|\\bDEPT\\b|DEPARTMENT|\\bDPW\\b',
  'PUBLIC WORKS|MAINTENANCE|\\bGARAGES?\\b|\\bPARKS?\\b|\\bPK\\b(?! ?LOT)|PLAYGROUND|RECREATION|POOL|\\bRINK\\b|CHURCH|CEMET',
  '\\bFIELDS?\\b|\\bFLDS\\b|BALL ?FIELDS?|TENNIS',
  'BAPTIST|METHODIST|LUTHERAN|PRESBYTER|EPISCOPAL|SYNAGOGUE|MOSQUE|RECTORY|CONVENT|PARISH',
].join('|'), 'i');
/**
 * ADR-0017: sites their own town says aren't for visitors (rented, reserved, or private), by the site's first PIN.
 * Checked by hand on 2026-11-07. A town's page is used only to leave a site out; nothing from it is shown.
 */
export const NOT_FOR_VISITORS: Readonly<Record<string, string>> = {
  '0902_16_2.01': 'East Newark, 10-12 Sering Ave: the Borough says parking lot areas throughout the Borough are private (Residential Parking page)',
  '0902_8_47': 'East Newark, 411 John St: as above',
  '0903_31_11': 'Guttenberg, 127 71st St: "The town lot on 71st Street offers reserved, paid parking only" (Town news, 2020-01-08)',
  '0908_26_9': 'North Bergen, 1314 14th St: a rental lot on the Parking Authority\'s Parking Lots page',
  '0908_8_66': 'North Bergen, 600 Liberty Ave: a rental lot on the Parking Authority\'s Parking Lots page',
  '0716_2003_1': 'Nutley, 11 East Plaza: Municipal Parking Lot #6, "Permit Parking" only (Public Works\' Parking page)',
};

/** Wording for the parking itself, which isn't another use: "PARKING GARAGE", "GARAGE#B-810", "PARK LOT". */
const PARKING_ITSELF = /PARKING GARAGES?|GARAGE ?#\S*|\bPARK LOT\b|PARK'G/gi;

export function normalizeCandidates(body: Uint8Array, config: ParcelCounty): Normalized {
  const envelope = parseJson(body);
  // One response per county; snapshots stored before ADR-0020 hold one county's response as a string.
  const candidateParts: unknown[] = typeof envelope.candidates === 'string' ? [envelope.candidates] : Array.isArray(envelope.candidates) ? envelope.candidates : [];
  const isText = (part: unknown) => typeof part === 'string';
  if (candidateParts.length === 0 || !candidateParts.every(isText) || !Array.isArray(envelope.neighbours) || !envelope.neighbours.every(isText)) {
    throw new IngestionError('normalize.unexpected_format', 'snapshot is missing a query response');
  }
  const candidateFeatures = (candidateParts as string[]).flatMap((part) => features(part));
  const byPin = new Map<string, Parcel>();
  let invalidRows = 0;
  for (const feature of candidateFeatures) {
    if (!SAYS_PARKING.test(describe(feature.attributes))) continue;
    // A condominium unit ("0266_2506_7_CPA02", a single deeded parking space in Washington Township) isn't a lot.
    if (/_C[A-Z0-9]+$/.test(text(feature.attributes, 'PAMS_PIN'))) continue;
    const parcel = readParcel(feature, config.towns);
    if (!parcel) {
      invalidRows += 1;
      continue;
    }
    // One parcel can come as several shapes with the same PIN (Washington Township, Bergen): they're one parcel.
    const seen = byPin.get(parcel.pin);
    if (seen) {
      seen.shapes.push(parcel.point);
      seen.corners.push(...parcel.corners);
      seen.point = {
        lat: seen.shapes.reduce((sum, point) => sum + point.lat, 0) / seen.shapes.length,
        lng: seen.shapes.reduce((sum, point) => sum + point.lng, 0) / seen.shapes.length,
      };
    } else byPin.set(parcel.pin, parcel);
  }
  const parcels = [...byPin.values()];

  // Every public parcel's description on the block, the candidates' own included: a parcel recorded as
  // "parking lot" with facility "post office" is the post office's lot.
  const blockUses = new Map<string, string[]>();
  for (const part of envelope.neighbours as string[]) {
    for (const { attributes } of features(part)) {
      const block = blockKey(text(attributes, 'PCL_MUN'), text(attributes, 'PCLBLOCK'));
      blockUses.set(block, [...(blockUses.get(block) ?? []), describe(attributes).replace(PARKING_ITSELF, '')]);
    }
  }

  const records: SourceRecordInput[] = [];
  for (const site of sitesOf(parcels)) {
    if (site.some((parcel) => RIGHT_OF_WAY.test(parcel.description) || NOT_A_LOT.test(parcel.description) || OWN_OTHER_USE.test(parcel.description))) continue;
    const uses = [...(blockUses.get(blockKey(site[0]!.town, site[0]!.block)) ?? []), ...site.map((parcel) => parcel.description.replace(PARKING_ITSELF, ''))];
    if (uses.some((use) => SERVES.test(use))) continue;
    if (site[0]!.pin in NOT_FOR_VISITORS) continue; // modification `sites_not_for_visitors_excluded`
    records.push(toRecord(site, config.towns));
  }
  return { rowsRead: candidateFeatures.length, records, invalidRows };
}

const blockKey = (town: string, block: string) => `${town}:${block}`;

/** Candidate parcels on one block whose outlines touch, joined transitively (specs/06). */
function sitesOf(parcels: Parcel[]): Parcel[][] {
  const touch = (a: Parcel, b: Parcel) =>
    metersBetween(a.point, b.point) <= 600 && a.corners.some((u) => b.corners.some((v) => metersBetween(u, v) <= 1.5));
  const sites: Parcel[][] = [];
  const byBlock = new Map<string, Parcel[]>();
  for (const parcel of [...parcels].sort((a, b) => (a.pin < b.pin ? -1 : 1))) {
    const block = blockKey(parcel.town, parcel.block);
    byBlock.set(block, [...(byBlock.get(block) ?? []), parcel]);
  }
  for (const group of byBlock.values()) {
    const left = [...group];
    while (left.length > 0) {
      const site = [left.shift()!];
      for (let grew = true; grew; ) {
        grew = false;
        for (const parcel of [...left]) {
          if (site.some((member) => touch(parcel, member))) {
            site.push(parcel);
            left.splice(left.indexOf(parcel), 1);
            grew = true;
          }
        }
      }
      sites.push(site);
    }
  }
  return sites;
}

function toRecord(site: Parcel[], towns: Towns): SourceRecordInput {
  const first = site[0]!; // the lowest PAMS_PIN
  const town = towns[first.town]!;
  return {
    recordId: first.pin,
    facilityKey: `${town.key}-site-${`${first.block}-${first.lot}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    priority: 3,
    name: titleCase(first.location),
    // Never matched by name: an address isn't a lot's name. Only by distance (ING-14).
    matchTokens: [],
    kind: site.some((parcel) => /GARAGE|\bDECK\b/i.test(parcel.description)) ? 'garage' : 'lot',
    operatorName: null,
    operatorType: 'unknown',
    addressLine: null,
    locality: town.name,
    region: 'NJ',
    timeZone: NEW_YORK_TIME,
    lat: site.reduce((sum, parcel) => sum + parcel.point.lat, 0) / site.length,
    lng: site.reduce((sum, parcel) => sum + parcel.point.lng, 0) / site.length,
    spaces: null,
    officialUrl: null,
    meterPeriods: [],
    rates: [],
    confirmed: false,
    lotNumber: null,
    withheldReason: null,
  };
}

function readParcel({ attributes, centroid, geometry }: RawFeature, towns: Towns): Parcel | null {
  const pin = text(attributes, 'PAMS_PIN');
  const town = text(attributes, 'PCL_MUN');
  const block = text(attributes, 'PCLBLOCK');
  const location = text(attributes, 'PROP_LOC');
  const { x, y } = (centroid ?? {}) as { x?: unknown; y?: unknown };
  if (!pin || !(town in towns) || !block || !location || typeof x !== 'number' || typeof y !== 'number') return null;
  const rings = ((geometry ?? {}) as { rings?: unknown }).rings;
  const corners = Array.isArray(rings)
    ? rings.flatMap((ring) => (Array.isArray(ring) ? ring : [])).flatMap((point) =>
        Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number' ? [{ lat: point[1], lng: point[0] }] : [])
    : [];
  return {
    pin,
    town,
    block,
    lot: text(attributes, 'PCLLOT'),
    location: location.replace(/\s+/g, ' '),
    description: describe(attributes),
    point: { lat: y, lng: x },
    shapes: [{ lat: y, lng: x }],
    corners,
  };
}

interface RawFeature {
  attributes: Record<string, unknown>;
  centroid?: unknown;
  geometry?: unknown;
}

function features(body: Uint8Array | string): RawFeature[] {
  const list = parseJson(body).features;
  if (!Array.isArray(list)) throw new IngestionError('normalize.unexpected_format', 'response has no features');
  return list.filter((feature): feature is RawFeature => typeof (feature as RawFeature)?.attributes === 'object' && (feature as RawFeature).attributes !== null);
}

/** The assessor's building description and facility name together. */
function describe(attributes: Record<string, unknown>): string {
  return `${text(attributes, 'BLDG_DESC')} ${text(attributes, 'FAC_NAME')}`;
}

function text(attributes: Record<string, unknown>, field: string): string {
  const value = attributes[field];
  return typeof value === 'string' ? value.trim() : '';
}
