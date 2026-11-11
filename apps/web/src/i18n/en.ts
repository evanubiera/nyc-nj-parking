// The English message catalog (WEB-1). Every string people see or hear comes from here.
// Text marked [Placeholder, …] waits on the open question it names (docs/open-questions.md).
export const en = {
  'app.title': 'NYC and NJ public parking',
  'app.name': 'NYC and NJ public parking',
  'skipLink.label': 'Skip to main content',

  'search.heading': 'Find public parking near you',
  'search.intro':
    "Garages, lots, and fields run by cities, counties, the state, and transit agencies. This release covers NYC Department of Transportation garages and fields; NJ Transit's station and park-and-ride lots and NJDOT's park-and-rides across New Jersey; city lots and garages in Jersey City, West New York, Bayonne, Union City, Hoboken, Harrison, Bloomfield, South Orange, Nutley, Verona, Westwood, and Oradell; and, across New Jersey, unconfirmed sites from tax records.",
  'search.radius.label': 'Search within',
  'search.radius.option': '{km, number} km',
  // WEB-13: how to search. A town or address is the default (WEB-11); the device's location is shared only through the
  // dialog (WEB-4).
  'searchBy.label': 'Search by',
  'searchBy.place': 'Town or address',
  'searchBy.city': 'City or town',
  'searchBy.area': 'County or NYC borough',
  'searchBy.location': 'My current location',
  'search.useLocation': 'Use my current location',
  'area.label': 'County or borough',
  'area.placeholder': 'Choose a county or borough',
  'area.loading': 'Loading counties and boroughs…',
  'area.group.NJ': 'New Jersey',
  'area.group.NY': 'New York City',
  'city.label': 'City or town',
  'city.labelNeighbourhood': 'Neighbourhood',
  'city.placeholder': 'Choose one',
  'city.chooseAreaFirst': 'Choose a county or borough first',
  'search.in': 'Showing all of {label}',
  // WEB-11, ADR-0013: address search.
  'address.label': 'Search near a town or address',
  'address.placeholder': 'Hoboken, NJ or 174 Newark Ave',
  'address.suggestions': 'Suggestions',
  'address.area': '{area}, {state}',
  'address.count': '{count, plural, one {# suggestion} other {# suggestions}}. Use the up and down arrows to choose.',
  'address.none': 'No matching town or address. Try adding the town and state, such as Hoboken, NJ.',
  'address.notFound': "That address couldn't be found. Try another, or tap the map.",
  'address.credit': 'Addresses from NYC GeoSearch and the NJ Office of GIS.',
  'search.near': 'Searching near {label}',
  // WEB-8. The options reuse the operator labels below.
  'search.operators.legend': 'Run by',
  'search.operators.none': 'Choose at least one kind of operator to search.',
  // WEB-9: sites from tax records that no operator has confirmed (ADR-0012).
  'search.unconfirmed.toggle': 'Show unconfirmed sites (from tax records)',
  'search.mapHint': 'Or tap the map to search there.',

  'location.dialog.title': 'Search near your current location?',
  'location.dialog.body':
    "To search near you, this site needs your device's location. It's rounded to about 100 m before it leaves your device, used only for this search, and never stored.",
  'location.dialog.browser': 'Your browser may ask you to allow it.',
  'location.dialog.share': 'Share my location',
  'location.dialog.cancel': 'Not now',
  'location.locating': 'Finding your location…',
  'location.denied': "Location sharing is off for this site. Tap the map to search there instead, or allow location for this site in your browser's settings.",
  'location.deniedNoMap':
    "Location sharing is off for this site. To search near you, allow location for this site in your browser's settings, then try again.",
  'location.unavailable': "Your device couldn't find its location. Try again in a moment.",
  'location.unsupported': "This browser can't share its location, so searching near you isn't possible here.",

  'results.searching': 'Looking for public parking…',
  'results.heading': '{count, plural, one {# place} other {# places}} within {distance}',
  'results.empty': 'No public parking found within {distance}. Try a wider search.',
  'results.headingArea': '{count, plural, one {# place} other {# places}} in {area}',
  'results.emptyArea': 'No public parking found in {area}.',
  'results.error.location.out_of_area': 'That location is outside New York City and New Jersey.',
  'results.error.generic': "Search isn't working right now. Try again in a few minutes.",

  'facility.meta': '{kind} · {operator} · {distance}',
  'facility.metaNoDistance': '{kind} · {operator}',
  'facility.kind.garage': 'Garage',
  'facility.kind.lot': 'Lot',
  'facility.kind.field': 'Parking field',
  'facility.operatorType.municipal': 'City-run',
  'facility.operatorType.county': 'County-run',
  'facility.operatorType.state': 'State-run',
  'facility.operatorType.transit_agency': 'Transit agency',
  'facility.operatorType.public_authority': 'Public authority',
  // REC-9, WEB-9: an unconfirmed site from tax records, whose owner isn't recorded (ADR-0012).
  'facility.operatorType.unknown': 'Owner not recorded',
  'facility.unconfirmed':
    'Unconfirmed: tax records list this as public land used for parking. It may be for staff or permit holders only.',
  'facility.distance.meters': '{meters, number} m away',
  'facility.distance.kilometers': '{km, number, ::.0} km away',
  'facility.address': '{line}, {locality}',
  'facility.spaces': '{count, plural, one {# space} other {# spaces}}',
  // WEB-12: rates as the source states them. {hours} is "12 hours" for up-to rates.
  'rate.heading': 'Rates',
  'rate.per_hour': '{price} per hour, {days}, {times}',
  'rate.up_to_duration': 'Up to {hours}: {price}, {days}, {times}',
  'rate.daily_max': '{price} a day at most, {days}',
  'rate.monthly_permit': '{price} a month with a permit',
  'rate.overnight_pass': 'Overnight pass: {price}, {days}, {times}',
  // REC-8: an NJ Transit station's lots share a name, so their number tells them apart.
  'facility.nameWithLot': '{name}, lot {lot}',

  // WEB-6: these are when you pay at the meters, never opening hours.
  // REC-4: opening hours, as a source states them. "{days}" is "every day" or "Mon–Fri".
  'hours.allDay': 'Open 24 hours, {days}',
  'hours.period': 'Open {days}, {times}',
  'meter.heading': 'Metered hours',
  'meter.period': 'Pay at the meter {days}, {times}',
  'meter.periodCommercial': 'Commercial vehicles pay at the meter {days}, {times}',
  // A time range, or the whole day when it runs from 00:00 to 24:00.
  'time.range': '{from} to {to}',
  'time.allDay': 'around the clock',
  'meter.limit': 'Time limit: {hours}',
  'meter.limitVaries': 'Time limit: {hours}, depending on the meter',
  'meter.hours': '{count, plural, one {# hour} other {# hours}}',
  'meter.dayRange': '{first}–{last}',
  'meter.everyDay': 'every day',
  // WEB-6: says what the result doesn't show, so nobody takes a missing rate as free (decided 2026-11-04).
  'details.missing': 'Not shown here: {items}. Check with the operator before you park.',
  // An unconfirmed site has no known operator to check with (ADR-0012).
  'details.missing.unconfirmed': 'Not shown here: {items}. Check the signs on site before you park.',
  'details.item.hours': 'hours',
  'details.item.rates': 'rates',
  'details.item.spaces': 'number of spaces',
  'facility.officialLink': 'Hours and rates on the operator’s page',
  // Starts with the link's visible text, so voice control finds it (WCAG 2.5.3).
  'facility.officialLinkLabel': 'Hours and rates on the operator’s page, for {name}',

  // WEB-10: driving directions in the person's own map app. The app names are proper names.
  'directions.label': 'Directions:',
  'directions.app.google': 'Google Maps',
  'directions.app.apple': 'Apple Maps',
  'directions.app.waze': 'Waze',
  // Starts with the link's visible text, so voice control finds it (WCAG 2.5.3).
  'directions.linkLabel': '{app} directions to {name}',

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
  'sources.change.location_from_outline': 'We place each lot at the centre of its outline.',
  'sources.change.private_or_unowned_excluded':
    'We leave out lots recorded as privately owned (in whole or in part) or with no owner, and entries with no parking spaces.',
  'sources.change.lot_numbers_reformatted': 'We show lot numbers without leading zeros, and only where a station has more than one lot.',
  'sources.change.duplicates_removed': 'Where a lot is listed twice under one name, we show it once.',
  'sources.change.municipalities_reformatted': 'We reformat municipality names written in capitals.',
  'sources.change.town_names_standardized':
    'We write each town as the rest of the app does: "Oradell Borough" is Oradell, and "Clinton Twp" is Clinton Township.',
  'sources.change.sites_from_parcels':
    'We combine touching parcels into one site, and keep only public land described as parking with no school, public building, park, playground, or church on the same block.',
  'sources.change.locations_from_records':
    "The source has no map points, so we placed each lot or garage on the matching public parcel in the State's tax records, or with the State's geocoder.",
  'sources.change.rates_converted_to_hourly': 'We show meter rates per hour: 25¢ per 20 minutes is $0.75 per hour.',
  'sources.change.sites_not_for_visitors_excluded': 'We leave out sites their town says are rented, reserved, or private.',
  'sources.change.names_from_streets': "The ordinance doesn't name its lots, so we name each by its street.",
  'sources.change.no_hourly_parking_excluded':
    "We leave out garages the page lists as not taking hourly parkers, and lots for monthly permit holders only.",
  'sources.change.unconfirmed_public_use':
    "We show these sites as unconfirmed: the records don't say who owns them or whether the public may park there.",
  'sources.loading': 'Loading the data sources…',
  'sources.error': "The data sources can't be shown right now.",
  'sources.back': 'Back to search',

  'footer.sources': 'Data sources',

  // The map (S1-9b). MapLibre's own control labels come from here too (WEB-1).
  'map.label': 'Map of public parking. Tap a point to search there.',
  'map.searchPoint': 'Search point',
  'map.facility': '{position}. {name}, {distance}',
  'map.facilityUnconfirmed': '{position}. {name}, {distance}, unconfirmed',
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
