// The English message catalog (WEB-1). Every string people see or hear comes from here.
// Text marked [Placeholder, …] waits on the open question it names (docs/open-questions.md).
export const en = {
  'app.title': 'NYC and NJ public parking',
  'app.name': 'NYC and NJ public parking',
  'skipLink.label': 'Skip to main content',

  'search.heading': 'Find public parking near you',
  'search.intro':
    'Garages, lots, and fields run by cities, counties, the state, and transit agencies. This release covers NYC Department of Transportation garages and fields.',
  'search.radius.label': 'Search within',
  'search.radius.option': '{km, number} km',
  'search.useLocation': 'Use my location',
  'search.mapHint': 'Or tap the map to search there.',

  'location.locating': 'Finding your location…',
  'location.denied': "Location sharing is off for this site. Tap the map to search there instead, or allow location for this site in your browser's settings.",
  'location.deniedNoMap':
    "Location sharing is off for this site. To search near you, allow location for this site in your browser's settings, then try again.",
  'location.unavailable': "Your device couldn't find its location. Try again in a moment.",
  'location.unsupported': "This browser can't share its location, so searching near you isn't possible here.",

  'results.searching': 'Looking for public parking…',
  'results.heading': '{count, plural, one {# place} other {# places}} within {distance}',
  'results.empty': 'No public parking found within {distance}. Try a wider search.',
  'results.error.location.out_of_area': 'That location is outside New York City and New Jersey.',
  'results.error.generic': "Search isn't working right now. Try again in a few minutes.",

  'facility.meta': '{kind} · {operator} · {distance}',
  'facility.kind.garage': 'Garage',
  'facility.kind.lot': 'Lot',
  'facility.kind.field': 'Parking field',
  'facility.operatorType.municipal': 'City-run',
  'facility.operatorType.county': 'County-run',
  'facility.operatorType.state': 'State-run',
  'facility.operatorType.transit_agency': 'Transit agency',
  'facility.operatorType.public_authority': 'Public authority',
  'facility.distance.meters': '{meters, number} m away',
  'facility.distance.kilometers': '{km, number, ::.0} km away',
  'facility.address': '{line}, {locality}',

  // WEB-6: these are when you pay at the meters, never opening hours.
  'meter.heading': 'Metered hours',
  'meter.period': 'Pay at the meter {days}, {from} to {to}',
  'meter.periodCommercial': 'Commercial vehicles pay at the meter {days}, {from} to {to}',
  'meter.limit': 'Time limit: {hours}',
  'meter.limitVaries': 'Time limit: {hours}, depending on the meter',
  'meter.hours': '{count, plural, one {# hour} other {# hours}}',
  'meter.dayRange': '{first}–{last}',
  'meter.everyDay': 'every day',
  'hours.unknown': "Opening hours and rates aren't in the open data yet.",
  'facility.officialLink': 'Hours and rates on the operator’s page',
  'facility.officialLinkLabel': 'Hours and rates for {name} on the operator’s page',

  'credits.line': 'Data: {sources}',
  'credits.source': '{title}, as of {date}',
  'credits.sourceNoDate': '{title}',

  'sources.heading': 'Data sources',
  'sources.intro':
    'These public datasets are behind the suggestions. We check each one on a schedule, never while you search, so a change can take a day or more to appear.',
  'sources.publisher': 'Published by {publisher}',
  'sources.dataset': 'Dataset page',
  'sources.terms': 'Terms of use',
  'sources.dataDate': 'Data as of {date}',
  'sources.dataDateUnknown': "The dataset doesn't give a date for its data.",
  'sources.credit': 'Credit: {text}',
  'sources.changesHeading': 'What we change',
  'sources.change.names_reformatted': 'We reformat names to match how the operator writes them.',
  'sources.change.addresses_reformatted': 'We reformat street addresses and remove the city and ZIP code.',
  'sources.change.merged_across_sources': 'We combine records from different datasets that describe the same facility.',
  'sources.change.meter_hours_parsed': 'We turn the meters’ hours into days, times, and time limits.',
  'sources.change.location_from_meters': 'Where only the meters list a facility, we place it at the average position of its meters.',
  'sources.change.inactive_meters_excluded': 'We leave out meters marked inactive.',
  'sources.loading': 'Loading the data sources…',
  'sources.error': "The data sources can't be shown right now.",
  'sources.back': 'Back to search',

  'footer.sources': 'Data sources',

  // The map (S1-9b). MapLibre's own control labels come from here too (WEB-1).
  'map.label': 'Map of public parking. Tap a point to search there.',
  'map.searchPoint': 'Search point',
  'map.facility': '{position}. {name}, {distance}',
  'map.zoomIn': 'Zoom in',
  'map.zoomOut': 'Zoom out',
  'map.resetBearing': 'Point the map north',
  'map.toggleAttribution': 'Show map credits',
  'map.gestures.mobile': 'Use two fingers to move the map',
  'map.gestures.windows': 'Use Ctrl and scroll to zoom the map',
  'map.gestures.mac': 'Use ⌘ and scroll to zoom the map',
  'map.marker': 'Map marker',
  'status.checking': 'Checking the service…',
  'status.ok': 'The service is running.',
  'status.unavailable': "The service isn't available right now.",

  // ATT-1. The wording must come from a lawyer (PRD-2). Don't replace it with our own.
  'disclaimer.text': '[Placeholder, PRD-2] The accuracy disclaimer will appear here once a lawyer has written it.',
} as const;

export type MessageId = keyof typeof en;

// Makes react-intl check message IDs against this catalog at compile time.
declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: MessageId;
    }
  }
}
